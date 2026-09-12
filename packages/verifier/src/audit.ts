import { decodeAbiParameters, hexToBytes, type Address, type Hex } from "viem";
import {
  commitmentOf,
  encodePolicyBytes,
  policyHashOf,
  recoverReceiptSigner,
  receiptDigest,
  volTermBp,
  jitterBpOf,
  tjitterBpOf,
  type Policy,
} from "keel-controller";
import type { ReconstructedRun } from "./reconstruct.ts";

const POLICY_TUPLE_V1 = [
  { type: "uint16" }, { type: "uint32" }, { type: "uint32" }, { type: "uint32" },
  { type: "uint32" }, { type: "uint32" }, { type: "uint32" }, { type: "uint32" },
  { type: "uint32" }, { type: "uint32" }, { type: "uint32" }, { type: "uint32" },
  { type: "uint32" }, { type: "uint32" }, { type: "bytes32" },
] as const;
const POLICY_TUPLE_V2 = [...POLICY_TUPLE_V1, { type: "uint32" }] as const; // + tjitter_bp

/** Inverse of encodePolicyBytes — recover the Policy (+ bound codehash) from revealed bytes.
 * Version-aware: v1 → no tjitter_bp (legacy deterministic target), v2 → tjitter_bp appended. */
export function decodePolicyBytes(policyBytes: Hex): { policy: Policy; controllerCodeHash: Hex } {
  const words = (policyBytes.length - 2) / 64; // 32-byte words in the blob
  const tuple = words >= 16 ? POLICY_TUPLE_V2 : POLICY_TUPLE_V1;
  const v = decodeAbiParameters(tuple, policyBytes) as unknown as (number | bigint | Hex)[];
  const version = Number(v[0]);
  const n = (i: number) => Number(v[i]);
  const policy: Policy = {
    base_bp: n(1), kvol_bp: n(2), volcap_bp: n(3), jitter_bp: n(4), tmax_bp: n(5),
    emerg_bp: n(6), buffer_bp: n(7), target_cap_bp: n(8), halflife: n(9), cooldown: n(10),
    max_repay_bp: n(11), max_deposit: n(12), t_est_s: n(13),
  };
  if (Number(version) >= 2) policy.tjitter_bp = n(15);
  return { policy, controllerCodeHash: v[14] as Hex };
}

function clamp(x: number, lo: number, hi: number) {
  return x < lo ? lo : x > hi ? hi : x;
}

export interface AuditRow {
  round: number;
  price: bigint;
  hfBpPre: bigint;
  armBp: bigint;
  targetBp: bigint;
  emergency: boolean;
  acted: boolean;
  expectedAct: boolean;
  consistent: boolean;
}

export interface AuditReport {
  participant: Address;
  hasCommit: boolean;
  hasReveal: boolean;
  commitmentOk?: boolean; // keccak(policyHash‖salt) == on-chain commit
  policyHashOk?: boolean;
  signersOk: boolean; // every receipt recovers to the committed signer (from calldata sig)
  digestsOk: boolean; // recomputed EIP-712 digest == emitted digest
  hfReportsOk: boolean; // every receipt's self-reported hfBp matches the reconstructed HF
  liquidated: boolean;
  rows: AuditRow[]; // present only when policy+salt available
  roundsConsistent: boolean;
  verdict: "ALL ROUNDS CONSISTENT" | "COMMITMENT MISMATCH" | "SIGNER MISMATCH" | "RECEIPT HF MISMATCH" | "ROUND INCONSISTENT" | "NO REVEAL — RECEIPTS ONLY";
}

export interface AuditOpts {
  policy?: Policy;
  salt?: Hex; // bytes32
  controllerCodeHash?: Hex;
  receiptsAddr: Address; // EIP-712 verifyingContract
}

/** Pure audit: no chain I/O. Feed it a ReconstructedRun and (optionally) the revealed policy+salt. */
export async function audit(run: ReconstructedRun, opts: AuditOpts): Promise<AuditReport> {
  // resolve policy+salt from explicit opts or from the on-chain reveal.
  let policy = opts.policy;
  let salt = opts.salt;
  let codehash = opts.controllerCodeHash;
  if ((!policy || !salt) && run.reveal) {
    const d = decodePolicyBytes(run.reveal.policy);
    policy ??= d.policy;
    codehash ??= d.controllerCodeHash;
    salt ??= run.reveal.salt;
  }

  // --- commitment ---------------------------------------------------------
  let commitmentOk: boolean | undefined;
  let policyHashOk: boolean | undefined;
  if (policy && salt && codehash && run.commit) {
    const c = commitmentOf(policy, salt, codehash);
    commitmentOk = c.commit.toLowerCase() === run.commit.hash.toLowerCase();
    policyHashOk = policyHashOf(encodePolicyBytes(policy, codehash)).toLowerCase()
      === (run.reveal?.policyHash.toLowerCase() ?? policyHashOf(encodePolicyBytes(policy, codehash)).toLowerCase());
  }

  // --- receipts: independent signer + digest -----------------------------
  let signersOk = true;
  let digestsOk = true;
  for (const or of run.receipts) {
    if (run.commit) {
      const rec = await recoverReceiptSigner(or.receipt, or.sig, opts.receiptsAddr);
      if (rec.toLowerCase() !== run.commit.signer.toLowerCase()) signersOk = false;
    }
    const dg = receiptDigest(or.receipt, opts.receiptsAddr);
    if (dg.toLowerCase() !== or.digest.toLowerCase()) digestsOk = false;
  }

  // --- per-round decision replay (deterministic: no solver/timestamp) -----
  const rows: AuditRow[] = [];
  let roundsConsistent = true;
  if (policy && salt) {
    const saltBytes = hexToBytes(salt);
    let lastActionRound = -1;
    for (const r of run.rounds) {
      const volTerm = volTermBp(run.prices, r.round, policy);
      const jitter = jitterBpOf(saltBytes, r.round, policy.jitter_bp);
      const tjitter = tjitterBpOf(saltBytes, r.round, policy.tjitter_bp ?? 0);
      const armBp = BigInt(clamp(policy.base_bp + volTerm + jitter, policy.base_bp, policy.tmax_bp));
      const targetBp = BigInt(
        clamp(Number(armBp) + policy.buffer_bp + volTerm + tjitter, Number(armBp) + policy.buffer_bp, policy.target_cap_bp),
      );
      const emergency = r.hfBpPre < BigInt(policy.emerg_bp);
      const cooled = lastActionRound < 0 || r.round - lastActionRound > policy.cooldown;
      const expectedAct = emergency || (r.hfBpPre <= armBp && cooled);
      const consistent = expectedAct === r.acted;
      if (!consistent) roundsConsistent = false;
      if (r.acted) lastActionRound = r.round;
      rows.push({ round: r.round, price: r.price, hfBpPre: r.hfBpPre, armBp, targetBp, emergency, acted: r.acted, expectedAct, consistent });
    }
  } else {
    roundsConsistent = false; // can't audit rounds without the reveal
  }

  const hfReportsOk = run.rounds.every((r) => !r.hfBpMismatch);

  const verdict: AuditReport["verdict"] =
    !signersOk ? "SIGNER MISMATCH"
    : commitmentOk === false ? "COMMITMENT MISMATCH"
    : !hfReportsOk ? "RECEIPT HF MISMATCH"
    : !(policy && salt) ? "NO REVEAL — RECEIPTS ONLY"
    : !roundsConsistent ? "ROUND INCONSISTENT"
    : "ALL ROUNDS CONSISTENT";

  return {
    participant: run.participant,
    hasCommit: run.commit !== undefined,
    hasReveal: run.reveal !== undefined || (opts.policy !== undefined && opts.salt !== undefined),
    commitmentOk,
    policyHashOk,
    signersOk,
    digestsOk,
    hfReportsOk,
    liquidated: run.liquidated,
    rows,
    roundsConsistent,
    verdict,
  };
}

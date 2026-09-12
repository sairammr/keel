import { encodeAbiParameters, encodePacked, keccak256, toHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { secp256k1 } from "@noble/curves/secp256k1";
import type { Policy } from "./types";

// v1: 14 numeric fields + codehash. v2 appends tjitter_bp (restore-target jitter).
// Encoding is version-aware so a v1 policy revealed on-chain re-encodes byte-identically
// and its commitment still verifies after the v2 upgrade.
const POLICY_ABI_V1 = [
  { type: "uint16" }, // version = 1
  { type: "uint32" }, // base_bp
  { type: "uint32" }, // kvol_bp
  { type: "uint32" }, // volcap_bp
  { type: "uint32" }, // jitter_bp
  { type: "uint32" }, // tmax_bp
  { type: "uint32" }, // emerg_bp
  { type: "uint32" }, // buffer_bp
  { type: "uint32" }, // target_cap_bp
  { type: "uint32" }, // halflife
  { type: "uint32" }, // cooldown
  { type: "uint32" }, // max_repay_bp
  { type: "uint32" }, // max_deposit
  { type: "uint32" }, // t_est_s
  { type: "bytes32" }, // controllerCodeHash
] as const;

const POLICY_ABI_V2 = [...POLICY_ABI_V1, { type: "uint32" }] as const; // + tjitter_bp

export function encodePolicyBytes(
  policy: Policy,
  controllerCodeHash: `0x${string}`,
): `0x${string}` {
  const base = [
    policy.base_bp,
    policy.kvol_bp,
    policy.volcap_bp,
    policy.jitter_bp,
    policy.tmax_bp,
    policy.emerg_bp,
    policy.buffer_bp,
    policy.target_cap_bp,
    policy.halflife,
    policy.cooldown,
    policy.max_repay_bp,
    policy.max_deposit,
    policy.t_est_s,
  ] as const;
  const tj = policy.tjitter_bp ?? 0;
  return tj > 0
    ? encodeAbiParameters(POLICY_ABI_V2, [2, ...base, controllerCodeHash, tj] as const)
    : encodeAbiParameters(POLICY_ABI_V1, [1, ...base, controllerCodeHash] as const);
}

export function policyHashOf(policyBytes: `0x${string}`): `0x${string}` {
  return keccak256(policyBytes);
}

export function commitmentOf(
  policy: Policy,
  salt: `0x${string}`,
  controllerCodeHash: `0x${string}`,
): {
  policyHash: `0x${string}`;
  commit: `0x${string}`;
  receiptKey: `0x${string}`;
  signer: `0x${string}`;
} {
  const policyHash = policyHashOf(encodePolicyBytes(policy, controllerCodeHash));
  const commit = keccak256(encodePacked(["bytes32", "bytes32"], [policyHash, salt]));

  const raw = keccak256(encodePacked(["bytes32", "string"], [salt, "keel/receipt/v1"]));
  const reduced = BigInt(raw) % secp256k1.CURVE.n;
  if (reduced === 0n) throw new Error("receiptKey reduced to zero");
  const receiptKey = toHex(reduced, { size: 32 });

  const signer = privateKeyToAccount(receiptKey).address;
  return { policyHash, commit, receiptKey, signer };
}

#!/usr/bin/env bun
// KEEL verifier CLI — reconstruct a participant's run from chain events and audit it.
// Reads public chain state only. Exits non-zero on any inconsistency (commitment, signer, round).
//
//   bun run packages/verifier/src/cli.ts \
//     --rpc <url> --lending 0x.. --policyCommit 0x.. --receipts 0x.. --participant 0x.. \
//     --from <block> [--policy '<json>'] [--salt 0x..] [--codehash 0x..]
//
// With no --policy/--salt it uses the on-chain Revealed event if present; otherwise it
// verifies commitment + receipts only and reports "NO REVEAL — RECEIPTS ONLY".
import type { Address, Hex } from "viem";
import { reconstruct } from "./reconstruct.ts";
import { audit } from "./audit.ts";
import type { Policy } from "keel-controller";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
function req(name: string): string {
  const v = arg(name);
  if (!v) throw new Error(`missing --${name}`);
  return v;
}

const hf = (bp: bigint) => (Number(bp) / 10000).toFixed(3);

async function main() {
  const targets = {
    rpcUrl: req("rpc"),
    lending: req("lending") as Address,
    policyCommit: req("policyCommit") as Address,
    receipts: req("receipts") as Address,
    participant: req("participant") as Address,
    fromBlock: BigInt(req("from")),
  };
  const policy = arg("policy") ? (JSON.parse(arg("policy")!) as Policy) : undefined;
  const salt = arg("salt") as Hex | undefined;
  const controllerCodeHash = arg("codehash") as Hex | undefined;

  console.log(`\n=== KEEL verify · participant ${targets.participant} ===`);
  const run = await reconstruct(targets);
  console.log(
    `commit ${run.commit ? run.commit.hash.slice(0, 12) + "… @block " + run.commit.blockNumber : "NONE"}` +
      ` · signer ${run.commit?.signer ?? "?"} · reveal ${run.reveal ? "yes" : "no"}` +
      ` · price levels ${run.prices.length} · receipts ${run.receipts.length}` +
      ` · liquidated ${run.liquidated}`,
  );

  const rep = await audit(run, { receiptsAddr: targets.receipts, policy, salt, controllerCodeHash });

  console.log(`\ncommitment ${rep.commitmentOk === undefined ? "n/a" : rep.commitmentOk ? "OK ✓" : "MISMATCH ✕"}` +
    ` · signers ${rep.signersOk ? "OK ✓" : "MISMATCH ✕"} · digests ${rep.digestsOk ? "OK ✓" : "MISMATCH ✕"}`);

  if (rep.rows.length) {
    console.log(`\nrnd  price    HF     arm    target  emrg  acted  expect  ok`);
    for (const r of rep.rows) {
      console.log(
        `${String(r.round).padStart(2)}   ${String(r.price).padStart(6)}  ${hf(r.hfBpPre)}  ${hf(r.armBp)}  ${hf(r.targetBp)}` +
          `   ${r.emergency ? "Y" : "·"}     ${r.acted ? "Y" : "·"}      ${r.expectedAct ? "Y" : "·"}     ${r.consistent ? "✓" : "✕"}`,
      );
    }
  }

  console.log(`\n${rep.verdict}\n`);
  const failed =
    !rep.signersOk || !rep.digestsOk || rep.commitmentOk === false ||
    (rep.rows.length > 0 && !rep.roundsConsistent);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error("\n" + (e?.message ?? e));
  process.exit(1);
});

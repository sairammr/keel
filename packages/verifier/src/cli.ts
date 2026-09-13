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

  // on-camera formatting — colors only when stdout is a TTY
  const tty = process.stdout.isTTY || !!process.env.FORCE_COLOR;
  const paint = (code: string) => (s: string) => (tty ? `\x1b[${code}m${s}\x1b[0m` : s);
  const bold = paint("1"), dim = paint("2"), blue = paint("38;5;69"),
    green = paint("38;5;42"), red = paint("38;5;203"), gray = paint("38;5;245");
  const OKM = green("✓"), BADM = red("✕");
  const mark = (ok?: boolean) => (ok === undefined ? gray("n/a") : ok ? OKM : BADM);
  const W = 74;
  const rule = blue("─".repeat(W));

  console.log("");
  console.log(blue("╔" + "═".repeat(W) + "╗"));
  console.log(blue("║") + bold("  KEEL VERIFY — independent audit from public Sepolia logs".padEnd(W)) + blue("║"));
  console.log(blue("╚" + "═".repeat(W) + "╝"));
  console.log(gray("  participant  ") + targets.participant);

  const run = await reconstruct(targets);
  console.log(gray("  commit       ") + (run.commit ? `${run.commit.hash.slice(0, 20)}…  ${dim("@block " + run.commit.blockNumber)}` : red("NONE")));
  console.log(gray("  signer       ") + (run.commit?.signer ?? "?"));
  console.log(gray("  reveal       ") + (run.reveal ? green("yes — policy + salt public") : dim("not yet")));
  console.log(gray("  observed     ") + `${run.prices.length} price levels · ${run.receipts.length} signed receipts · liquidated ${run.liquidated ? red("YES") : green("no")}`);

  const rep = await audit(run, { receiptsAddr: targets.receipts, policy, salt, controllerCodeHash });

  console.log("\n" + rule);
  console.log(
    `  ${mark(rep.commitmentOk)} commitment = keccak(policyHash ‖ salt)   ` +
    `${mark(rep.signersOk)} every signer = committed   ${mark(rep.digestsOk)} EIP-712 digests`,
  );
  console.log(rule);

  if (rep.rows.length) {
    console.log(bold("\n  rnd   price     HF      arm     target   emrg  acted  expect   ok"));
    console.log(dim("  " + "─".repeat(68)));
    for (const r of rep.rows) {
      const row =
        `  ${String(r.round).padStart(2, "0")}   ${("$" + (Number(r.price) / 100).toFixed(0)).padStart(6)}   ` +
        `${hf(r.hfBpPre)}   ${blue(hf(r.armBp))}   ${dim(hf(r.targetBp))}     ` +
        `${r.emergency ? "Y" : "·"}      ${r.acted ? bold("Y") : "·"}      ${r.expectedAct ? bold("Y") : "·"}     ` +
        (r.consistent ? OKM : BADM);
      console.log(row);
    }
  }

  const good = rep.verdict === "ALL ROUNDS CONSISTENT";
  console.log("");
  const box = good ? green : rep.verdict === "NO REVEAL — RECEIPTS ONLY" ? gray : red;
  console.log(box("┌" + "─".repeat(W) + "┐"));
  console.log(box("│") + bold(`  ${good ? "✓" : "✕"} ${rep.verdict}`.padEnd(W)) + box("│"));
  console.log(box("└" + "─".repeat(W) + "┘"));
  console.log("");
  const failed =
    !rep.signersOk || !rep.digestsOk || rep.commitmentOk === false ||
    (rep.rows.length > 0 && !rep.roundsConsistent);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error("\n" + (e?.message ?? e));
  process.exit(1);
});

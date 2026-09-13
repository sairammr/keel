#!/usr/bin/env bun
// LIVE demo driver — ADMIN ONLY. It never repays or deposits; the KEEL workflow
// (fallback-runner / cre simulate loop in another terminal) does all defending.
//
//   Terminal A:  set -a; source .env.demo; set +a; ./scripts/fallback-runner.sh staging-settings 30
//   Terminal B:  KEEL_DEPLOY_KEY=… KEEL_DEMO_ADDRESS=… bun run scripts/demo-live.ts
//
// Phases: wait for the workflow's commit-first-tick → start() → price rounds
// (update + checkAllHF, sleeping so the workflow can react) → stop() → reveal
// (KEEL_POLICY + KEEL_SALT from env, participant key) → print the verify command.
import { readFileSync } from "node:fs";
import { createPublicClient, createWalletClient, http, defineChain, parseAbi, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { encodePolicyBytes } from "../packages/controller/src/commitment.ts";
import { parsePackedPolicy } from "../workflow/src/policy.ts";
import { banner, section, line, endSection, kv, hf, hfBar, money, OK, DOT, bold, dim, gray, green, blue, yellow } from "./ui.ts";

const cfg = JSON.parse(readFileSync(new URL("../workflow/config.staging.json", import.meta.url).pathname, "utf8"));
const ADMIN_KEY = process.env.KEEL_DEPLOY_KEY as Hex;
const PARTICIPANT = process.env.KEEL_DEMO_ADDRESS as Address;
const DEMO_KEY = process.env.KEEL_DEMO_KEY as Hex | undefined; // for the reveal at the end
if (!ADMIN_KEY || !PARTICIPANT) throw new Error("need KEEL_DEPLOY_KEY and KEEL_DEMO_ADDRESS");

// Price path (vUSD/vETH ×100): decline → deep wick → recovery. HF dips force real defends.
const PATH = [185000, 170000, 155000, 145000, 180000];
const WAIT_S = Number(process.env.DEMO_WAIT_S ?? 75); // > runner interval so the workflow gets a tick per round

const sepolia = defineChain({ id: 11155111, name: "sepolia", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: { default: { http: [cfg.rpc_url] } } });
const pub = createPublicClient({ chain: sepolia, transport: http(cfg.rpc_url) });
const admin = createWalletClient({ account: privateKeyToAccount(ADMIN_KEY), chain: sepolia, transport: http(cfg.rpc_url) });

const LENDING = parseAbi([
  "function start()", "function stop()", "function updatevETHPrice(uint256)", "function checkAllHF()",
  "function scenarioStartTime() view returns (uint256)",
  "function getUserPosition(address) view returns ((uint256 collateral,uint256 debt,uint256 hf,uint256 numOperations,uint256 lastUpdateTime,uint256 cumulativeDebtTime))",
]);
const PC = parseAbi([
  "function commits(address) view returns ((bytes32 hash,address signer,uint64 blockNumber,uint64 timestamp))",
  "function reveal(bytes policy, bytes32 salt)",
]);
const ZERO = "0x" + "0".repeat(64);
const ES = (h: string) => `https://sepolia.etherscan.io/tx/${h}`;
const sleep = (s: number) => new Promise((r) => setTimeout(r, s * 1000));
const send = async (fn: string, args: unknown[] = []) => {
  const h = await admin.writeContract({ address: cfg.lending, abi: LENDING, functionName: fn as never, args: args as never });
  await pub.waitForTransactionReceipt({ hash: h });
  line(`${OK} ${bold(fn)}(${args.join(",")})`);
  line(`   ${dim(ES(h))}`);
  return h;
};
const hfOf = async () => (await pub.readContract({ address: cfg.lending, abi: LENDING, functionName: "getUserPosition", args: [PARTICIPANT] })).hf;

banner("KEEL · LIVE SCENARIO", "the enclave defends — this terminal only moves the market");
section("STAGE");
kv("lending", cfg.lending);
kv("participant", PARTICIPANT);
kv("price path", PATH.map((p) => "$" + p / 100).join(" → "));
kv("round wait", `${WAIT_S}s (workflow reacts on its own tick)`);
endSection();

// 1. wait for the WORKFLOW to commit (its first tick posts commit + approvals)
section("PHASE 1 · THE SEAL — waiting for the enclave's commit-first-tick");
process.stdout.write("\x1b[38;5;69m│\x1b[0m  ");
for (;;) {
  const c = await pub.readContract({ address: cfg.policyCommit, abi: PC, functionName: "commits", args: [PARTICIPANT] });
  if (c.hash !== ZERO) {
    console.log("");
    line(`${OK} policy hash ${green(bold("SEALED"))} on-chain — ${bold("BEFORE start()")}`);
    kv("commitment", c.hash);
    kv("block", String(c.blockNumber));
    break;
  }
  process.stdout.write(dim("· "));
  await sleep(10);
}
endSection();

// 2. start + rounds
section("PHASE 2 · THE STORM — price rounds");
if ((await pub.readContract({ address: cfg.lending, abi: LENDING, functionName: "scenarioStartTime" })) === 0n) await send("start");
let r = 0;
for (const p of PATH) {
  r++;
  line("");
  line(`${DOT} ${bold(`ROUND ${r}/${PATH.length}`)}  price → ${money(p)}`);
  await send("updatevETHPrice", [BigInt(p)]);
  const pre = await hfOf();
  line(`   HF ${hf(pre)}  ${hfBar(pre)}`);
  line(`   ${gray(`waiting ${WAIT_S}s — the workflow decides alone…`)}`);
  await sleep(WAIT_S);
  await send("checkAllHF");
  const post = await hfOf();
  line(`   HF ${hf(post)}  ${hfBar(post)}  ${post >= 108n ? green("safe") : post >= 103n ? yellow("watching") : green(bold("defended at the edge"))}`);
}
line("");
await send("stop");
endSection();

// 3. reveal (participant key) — makes the run independently verifiable
section("PHASE 3 · THE REVEAL — open the envelope");
const pol = process.env.KEEL_POLICY, salt = process.env.KEEL_SALT as Hex | undefined;
if (DEMO_KEY && pol && salt) {
  const demo = createWalletClient({ account: privateKeyToAccount(DEMO_KEY), chain: sepolia, transport: http(cfg.rpc_url) });
  const bytes = encodePolicyBytes(parsePackedPolicy(pol), cfg.controllerCodeHash);
  const h = await demo.writeContract({ address: cfg.policyCommit, abi: PC, functionName: "reveal", args: [bytes, salt] });
  await pub.waitForTransactionReceipt({ hash: h });
  line(`${OK} ${bold("reveal(policy, salt)")} posted — the sealed policy is now public`);
  line(`   ${dim(ES(h))}`);
} else {
  line(yellow("skip reveal — set KEEL_DEMO_KEY + KEEL_POLICY + KEEL_SALT to auto-reveal"));
}
endSection();

section("PHASE 4 · THE AUDIT — run this on camera");
line(blue(bold("bun run verify")) + ` --rpc ${cfg.rpc_url} \\`);
line(`    --lending ${cfg.lending} \\`);
line(`    --policyCommit ${cfg.policyCommit} --receipts ${cfg.receipts} \\`);
line(`    --participant ${PARTICIPANT} --from ${cfg.startBlock}`);
line("");
line(gray("expected verdict: ") + green(bold("ALL ROUNDS CONSISTENT")));
endSection();
console.log("");

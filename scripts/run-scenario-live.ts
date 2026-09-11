#!/usr/bin/env bun
// Drive a REAL scenario on the deployed Sepolia STAGING copy with the shared controller.
// Commit-before-start → price crash → real repay/deposit txs + EIP-712 receipts → checkAllHF
// (survive) → stop → reveal. Every action is a real on-chain tx; hashes are printed with
// Etherscan links. This is the honest on-chain demonstration (no DON needed — same controller code
// the enclave runs, driven from the funded wallet).
//
//   KEEL_DEPLOY_KEY=0x… bun run scripts/run-scenario-live.ts
//
// Single wallet is BOTH admin (start/stop/price/checkAllHF) and participant (commit/repay/receipt).
import { readFileSync } from "node:fs";
import {
  createPublicClient, createWalletClient, http, defineChain, getContract,
  parseAbi, decodeEventLog, type Abi, type Address, type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  commitmentOf, encodePolicyBytes, policyHashOf, decide, hfBpOf, hf100Of,
  solve, signReceipt, receiptDigest, P0, type Receipt, type DecideInput,
} from "../packages/controller/src/index.ts";
import { orderLegs } from "../workflow/src/plan.ts";
import { DEFAULT_POLICY } from "../packages/controller/src/fixture.ts";

const KEY = (process.env.KEEL_DEPLOY_KEY ?? readFileSync(new URL("../.env.deploy", import.meta.url).pathname, "utf8")
  .match(/KEEL_DEPLOY_KEY=(0x[0-9a-fA-F]{64})/)?.[1]) as Hex | undefined;
if (!KEY) throw new Error("set KEEL_DEPLOY_KEY (or put it in .env.deploy)");

const cfg = JSON.parse(readFileSync(new URL("../workflow/config.staging.json", import.meta.url).pathname, "utf8")) as {
  rpc_url: string; lending: Address; vETH: Address; vUSD: Address; policyCommit: Address; receipts: Address; controllerCodeHash: Hex;
};
const RPC = process.env.RPC_URL ?? cfg.rpc_url;
const sepolia = defineChain({ id: 11155111, name: "sepolia", nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: { default: { http: [RPC] } } });

const account = privateKeyToAccount(KEY);
const pub = createPublicClient({ chain: sepolia, transport: http(RPC) });
const wallet = createWalletClient({ account, chain: sepolia, transport: http(RPC) });
const me = account.address;
const ES = (h: string) => `https://sepolia.etherscan.io/tx/${h}`;

const LENDING = parseAbi([
  // struct return (single tuple) → viem yields an OBJECT {collateral,debt,…}, matching the contract
  "function getUserPosition(address) view returns ((uint256 collateral,uint256 debt,uint256 hf,uint256 numOperations,uint256 lastUpdateTime,uint256 cumulativeDebtTime))",
  "function scenarioStartTime() view returns (uint256)",
  "function start()", "function stop()", "function updatevETHPrice(uint256)", "function checkAllHF()",
  "function deposit(uint256 amount)", "function repay(uint256 amount)",
]);
const TOKEN = parseAbi(["function approve(address,uint256) returns (bool)"]);
const POLICYCOMMIT = parseAbi([
  "function commits(address) view returns (bytes32 hash,address signer,uint64 blockNumber,uint64 timestamp)",
  "function commit(bytes32 hash,address signer)", "function reveal(bytes policyBytes,bytes32 salt)",
]);
const RECEIPTS = parseAbi([
  "function post((bytes32 commit,uint64 round,uint64 blockObserved,uint256 price,uint256 hfBp,uint8 action,uint256 amount,uint64 actionNonce) r,bytes sig)",
  "function count(address) view returns (uint256)",
]);

async function send(to: Address, abi: Abi, fn: string, args: unknown[] = []): Promise<Hex> {
  const { request } = await pub.simulateContract({ account, address: to, abi, functionName: fn, args });
  const hash = await wallet.writeContract(request);
  await pub.waitForTransactionReceipt({ hash });
  return hash;
}

const PATH = (process.env.PRICE_PATH?.split(",").map((s) => BigInt(s.trim()))) ?? [200000n, 192000n, 184000n, 178000n, 172000n, 168000n];
const SALT = ("0x" + "5a".repeat(32)) as Hex; // staging salt (revealed after the run; production salt stays sealed)
const saltBytes = new Uint8Array(32).fill(0x5a);
const ACTION = { repay: 1, deposit: 2 } as const;

async function main() {
  console.log(`\n=== KEEL LIVE scenario on Sepolia ===\nwallet=${me}\nlending=${cfg.lending}\n`);
  const lending = getContract({ address: cfg.lending, abi: LENDING, client: pub });
  const pc = getContract({ address: cfg.policyCommit, abi: POLICYCOMMIT, client: pub });
  const rc = getContract({ address: cfg.receipts, abi: RECEIPTS, client: pub });

  const { commit, signer, policyHash, receiptKey } = commitmentOf(DEFAULT_POLICY, SALT, cfg.controllerCodeHash);

  // 1. commit BEFORE start (unless already committed).
  // commits() has MULTIPLE named returns → viem returns a tuple ARRAY [hash,signer,block,ts].
  const existing = (await pc.read.commits([me])) as readonly [Hex, Address, bigint, bigint];
  if (existing[0] === (("0x" + "00".repeat(32)) as Hex)) {
    const ch = await send(cfg.policyCommit, POLICYCOMMIT as Abi, "commit", [commit, signer]);
    const cblk = await pub.getBlockNumber();
    console.log(`commit  block ${cblk}  ${ES(ch)}`);
    await send(cfg.vUSD, TOKEN as Abi, "approve", [cfg.lending, (1n << 255n)]);
    await send(cfg.vETH, TOKEN as Abi, "approve", [cfg.lending, (1n << 255n)]);
    console.log("approvals posted (vUSD, vETH)");
  } else {
    console.log("commit already present, skipping");
  }

  // 2. start (if not started)
  let started = (await lending.read.scenarioStartTime()) as bigint;
  if (started === 0n) {
    const sh = await send(cfg.lending, LENDING as Abi, "start");
    console.log(`start   ${ES(sh)}`);
    started = (await lending.read.scenarioStartTime()) as bigint;
  }

  // 3. price path
  let lastActionRound = -1;
  let acted = 0;
  let lastReceipt: Receipt | null = null;
  let lastSig: Hex | null = null;
  for (let round = 0; round < PATH.length; round++) {
    const P = PATH[round]!;
    if (round > 0) await send(cfg.lending, LENDING as Abi, "updatevETHPrice", [P]);

    const pos = (await lending.read.getUserPosition([me])) as { collateral: bigint; debt: bigint };
    const C = pos.collateral, D = pos.debt;
    const hfBp = hfBpOf(C, D, P);
    const blk = await pub.getBlock();
    const input: DecideInput = {
      policy: DEFAULT_POLICY, salt: saltBytes, prices: PATH.slice(0, round + 1), round,
      collateral: C, debt: D, hfBp, lastActionRound, nowS: Number(blk.timestamp), startedS: Number(started),
      balances: { vETH: 0n, vUSD: 0n }, // reserves read below only if acting
    };
    // real balances (needed for solver caps)
    const balAbi = parseAbi(["function balanceOf(address) view returns (uint256)"]);
    input.balances = {
      vETH: (await pub.readContract({ address: cfg.vETH, abi: balAbi, functionName: "balanceOf", args: [me] })) as bigint,
      vUSD: (await pub.readContract({ address: cfg.vUSD, abi: balAbi, functionName: "balanceOf", args: [me] })) as bigint,
    };
    const d = decide(input);
    console.log(`round ${round}: P=${P} C=${C} D=${D} hfBp=${hfBp} (undef hf100=${hf100Of(500n, 700000n, P)}) -> ${d.reason}${d.act ? ` ${d.kind} ${d.amount}` : ""}`);

    if (d.act) {
      const target = d.emergency ? (d.armBp + BigInt(DEFAULT_POLICY.buffer_bp) > BigInt(DEFAULT_POLICY.emerg_bp + DEFAULT_POLICY.buffer_bp) ? d.armBp + BigInt(DEFAULT_POLICY.buffer_bp) : BigInt(DEFAULT_POLICY.emerg_bp + DEFAULT_POLICY.buffer_bp)) : d.targetBp;
      const sr = solve({ C, D, P, targetBp: target, policy: DEFAULT_POLICY, balances: input.balances, nowS: Number(blk.timestamp), startedS: Number(started), ignoreCaps: d.emergency });
      const legs = orderLegs(sr);
      // sequential sends ⇒ action tx at nonce N, its receipt at N+1 (adjacency) automatically.
      for (let i = 0; i < legs.length; i++) {
        const leg = legs[i]!;
        const ah = leg.kind === "deposit"
          ? await send(cfg.lending, LENDING as Abi, "deposit", [leg.amount])
          : await send(cfg.lending, LENDING as Abi, "repay", [leg.amount]);
        const actionNonce = await pub.getTransactionCount({ address: me }); // next nonce (receipt will use it)
        const receipt: Receipt = {
          commit, round: BigInt(round), blockObserved: await pub.getBlockNumber(), price: P, hfBp,
          action: ACTION[leg.kind], amount: leg.amount, actionNonce: BigInt(actionNonce - 1),
        };
        const sig = await signReceipt(receipt, receiptKey, cfg.receipts);
        const before = (await rc.read.count([me])) as bigint;
        const rh = await send(cfg.receipts, RECEIPTS as Abi, "post", [receipt, sig]);
        const after = (await rc.read.count([me])) as bigint;
        console.log(`  ${leg.kind} ${leg.amount}  action ${ES(ah)}  receipt(${before}->${after}) ${ES(rh)}`);
        lastReceipt = receipt; lastSig = sig;
      }
      lastActionRound = round; acted++;
    }

    // liquidation sweep — survival = debt unchanged
    const dBefore = ((await lending.read.getUserPosition([me])) as { debt: bigint }).debt;
    await send(cfg.lending, LENDING as Abi, "checkAllHF");
    const after = (await lending.read.getUserPosition([me])) as { debt: bigint; hf: bigint };
    console.log(`  checkAllHF: debt ${dBefore}->${after.debt} hf=${after.hf} ${after.debt === dBefore && after.hf > 100n ? "SURVIVED" : "LIQUIDATED"}`);
  }

  // 4. stop + reveal
  const sh = await send(cfg.lending, LENDING as Abi, "stop");
  console.log(`stop    ${ES(sh)}`);
  const policyBytes = encodePolicyBytes(DEFAULT_POLICY, cfg.controllerCodeHash);
  if (policyHashOf(policyBytes) !== policyHash) throw new Error("policyBytes hash != committed policyHash");
  const revh = await send(cfg.policyCommit, POLICYCOMMIT as Abi, "reveal", [policyBytes, SALT]);
  console.log(`reveal  ${ES(revh)}`);
  console.log(`\nactions taken: ${acted}; last receipt digest ${lastReceipt ? receiptDigest(lastReceipt, cfg.receipts) : "n/a"}`);
  console.log("LIVE SCENARIO COMPLETE");
  void lastSig;
}

main().catch((e) => { console.error("\n" + (e?.message ?? e)); process.exit(1); });

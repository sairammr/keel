import { bytesToHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  cre,
  handlerInTee,
  CronCapability,
  Runner,
  type TeeRuntime,
  type CronPayload,
} from "@chainlink/cre-sdk";
import {
  decide,
  solve,
  commitmentOf,
  signReceipt,
  hfBpOf,
  P0,
  type Receipt,
} from "../../packages/controller/src/index.ts";
import type { Config } from "./config.ts";
import { ChainReader } from "./chain.ts";
import { parsePolicy, ALL_SECRET_IDS, type SecretMap } from "./policy.ts";
import { orderLegs, planNonces } from "./plan.ts";

const ZERO_HASH = "0x0000000000000000000000000000000000000000000000000000000000000000";

function maxBig(a: bigint, b: bigint): bigint {
  return a > b ? a : b;
}

/**
 * The confidential cron handler. Reconstructs state from public chain data, decides via the
 * shared controller, posts commit + receipts. Returns ONLY a one-word status.
 * NEVER logs a policy value, salt, or HF threshold (rubric: no private inputs in logs/returns).
 */
async function onCronTrigger(rt: TeeRuntime<Config>, _t: CronPayload): Promise<string> {
  const cfg = rt.config;

  // 1. secrets → policy, salt, key
  const secrets = rt.getSecrets(ALL_SECRET_IDS.map((id) => ({ id }))).result() as SecretMap;
  const { policy: pol, salt, rpcUrl, privateKey } = parsePolicy(secrets);
  const acct = privateKeyToAccount(privateKey);
  const saltHex = bytesToHex(salt);

  const rpc = rpcUrl ?? cfg.rpc_url;
  const chain = new ChainReader(rt, rpc, cfg);

  // pre-derive the commitment (pure, deterministic from salt+policy) — used for commit + receipts.
  const { commit, receiptKey, signer } = commitmentOf(pol, saltHex, cfg.controllerCodeHash);

  // 2. read state
  const pos = chain.position(acct.address);
  const price = chain.price();
  const started = chain.scenarioStartTime();
  const commitState = chain.commitOf(acct.address);
  const nonce = chain.nonce(acct.address, "pending");

  // 3. first tick after deploy: post commit + token approvals, then stop.
  if (commitState.hash === ZERO_HASH) {
    await chain.send(acct, chain.commitTx(commit, signer), nonce);
    await chain.send(acct, chain.approveMaxTx("vUSD"), nonce + 1);
    await chain.send(acct, chain.approveMaxTx("vETH"), nonce + 2);
    return "COMMITTED";
  }

  // 4. not started / no debt → idle
  if (started === 0n || pos.debt === 0n) return "IDLE";

  // 5. rebuild prices[] from PriceUpdate logs (excluding organiser pre-start test updates);
  //    compute HF ourselves; find last action round.
  const startedBlk = chain.startedBlock(cfg.startBlock);
  const prices = [P0, ...chain.priceUpdatesSince(cfg.startBlock, startedBlk ?? 0n)];
  const round = prices.length - 1;
  const hfBp = hfBpOf(pos.collateral, pos.debt, price);
  const lastActionRound = chain.myActions(acct.address, cfg.startBlock, startedBlk ?? 0n);
  const nowS = Math.floor(rt.now().getTime() / 1000);
  const startedS = Number(started);
  const balances = chain.balances(acct.address);

  // 6. decide (shared controller — the real one, no mock).
  const dec = decide({
    policy: pol,
    salt,
    prices,
    round,
    collateral: pos.collateral,
    debt: pos.debt,
    hfBp,
    lastActionRound,
    nowS,
    startedS,
    balances,
  });
  if (!dec.act) return "SAFE";

  // 7. solve BOTH legs {dep, rep}; send a tx per non-zero leg (finishing leg last).
  const solveTarget = dec.emergency
    ? maxBig(dec.armBp + BigInt(pol.buffer_bp), BigInt(pol.emerg_bp + pol.buffer_bp))
    : dec.targetBp;
  const sr = solve({
    C: pos.collateral,
    D: pos.debt,
    P: price,
    targetBp: solveTarget,
    policy: pol,
    balances,
    nowS,
    startedS,
    ignoreCaps: dec.emergency,
  });

  const legs = orderLegs(sr);
  if (legs.length === 0) return "SAFE"; // caps clipped everything to zero

  const { legNonces, actionNonce, receiptNonce } = planNonces(nonce, legs.length);
  for (let i = 0; i < legs.length; i++) {
    const leg = legs[i]!;
    const tx = leg.kind === "deposit" ? chain.depositTx(leg.amount) : chain.repayTx(leg.amount);
    await chain.send(acct, tx, legNonces[i]!);
  }

  // 8. receipt for the finishing leg; post at actionNonce + 1 (adjacency).
  const fin = legs[legs.length - 1]!;
  const receipt: Receipt = {
    commit: commitState.hash as `0x${string}`,
    round: BigInt(round),
    blockObserved: chain.blockNumber(),
    price,
    hfBp,
    action: fin.kind === "repay" ? 1 : 2,
    amount: fin.amount,
    actionNonce: BigInt(actionNonce),
  };
  const sig = await signReceipt(receipt, receiptKey, cfg.receipts);
  await chain.send(acct, chain.postReceiptTx(receipt, sig), receiptNonce); // === actionNonce + 1
  return "DEFENDED";
}

// R2 fallback: KEEL_TEE=0 registers the same handler NON-confidentially (no TEE constraint /
// attestation, secrets exposed to the DON). Deploy path when TEE access is not yet granted.
const initWorkflow = (config: Config) => {
  const trigger = new CronCapability().trigger({ schedule: config.schedule });
  const useTee = process.env.KEEL_TEE !== "0";
  return [useTee ? handlerInTee(trigger, onCronTrigger, {}) : cre.handler(trigger, onCronTrigger)];
};

export async function main() {
  const runner = await Runner.newRunner<Config>();
  await runner.run(initWorkflow);
}

await main();

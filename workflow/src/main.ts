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
import { ChainReader, type Tx } from "./chain.ts";
import { parsePolicy, ALL_SECRET_IDS, type SecretMap } from "./policy.ts";
import { orderLegs, planNonces } from "./plan.ts";

const ZERO_HASH = "0x0000000000000000000000000000000000000000000000000000000000000000";

function maxBig(a: bigint, b: bigint): bigint {
  return a > b ? a : b;
}

// receipt action codes: 1 repay, 2 deposit, 3 withdraw, 4 borrow
const ACTION_CODE = { repay: 1, deposit: 2, withdraw: 3, borrow: 4 } as const;

/**
 * The confidential cron handler. Reconstructs state from public chain data in ONE batched read,
 * decides via the shared controller, and broadcasts commit / actions + per-leg receipts in ONE
 * batched send — ≤ 2 HTTP requests per tick (CRE quota is 5). Returns ONLY a one-word status;
 * never logs a policy value, salt, or HF threshold.
 */
async function onCronTrigger(rt: TeeRuntime<Config>, _t: CronPayload): Promise<string> {
  const cfg = rt.config;

  // 1. secrets → policy, salt, key (4 secrets, packed policy — within the 5-secret quota)
  const secrets = rt.getSecrets(ALL_SECRET_IDS.map((id) => ({ id }))).result() as SecretMap;
  const { policy: pol, salt, rpcUrl, privateKey } = parsePolicy(secrets);
  const acct = privateKeyToAccount(privateKey);
  const saltHex = bytesToHex(salt);

  const chain = new ChainReader(rt, rpcUrl ?? cfg.rpc_url, cfg);
  const { commit, receiptKey, signer } = commitmentOf(pol, saltHex, cfg.controllerCodeHash);

  // 2. REQUEST 1: one batched read of the entire tick state
  const st = chain.readAll(acct.address);

  // 3. commit-first-tick: post commit + token approvals (must land before scenario start), then stop.
  if (st.commit.hash === ZERO_HASH) {
    const txs: Tx[] = [chain.commitTx(commit, signer), chain.approveMaxTx("vUSD"), chain.approveMaxTx("vETH")];
    const signed = await Promise.all(txs.map((tx, i) => chain.sign(acct, tx, st.nonce + i, st.gasPrice)));
    chain.sendRawBatch(signed); // REQUEST 2
    return "COMMITTED";
  }

  // 4. gate: idle unless open, started, not-yet-stopped, a participant, and carrying debt
  if (
    !st.challengeOpen ||
    st.scenarioStartTime === 0n ||
    st.scenarioEndTime !== 0n ||
    !st.isUser ||
    st.position.debt === 0n
  ) {
    return "IDLE";
  }

  // 5. rebuild the ladder (P0 prepended), compute HF ourselves
  const prices = [P0, ...st.priceLevels];
  const round = prices.length - 1;
  const hfBp = hfBpOf(st.position.collateral, st.position.debt, st.price);
  const nowS = Math.floor(rt.now().getTime() / 1000);

  // 6. decide (the real shared controller)
  const dec = decide({
    policy: pol,
    salt,
    prices,
    round,
    collateral: st.position.collateral,
    debt: st.position.debt,
    hfBp,
    lastActionRound: st.lastActionRound,
    nowS,
    startedS: Number(st.scenarioStartTime),
    balances: st.balances,
  });
  if (!dec.act) return "SAFE";

  // 7. solve both legs; one tx per non-zero leg, finishing leg last
  const solveTarget = dec.emergency
    ? maxBig(dec.armBp + BigInt(pol.buffer_bp), BigInt(pol.emerg_bp + pol.buffer_bp))
    : dec.targetBp;
  const sr = solve({
    C: st.position.collateral,
    D: st.position.debt,
    P: st.price,
    targetBp: solveTarget,
    policy: pol,
    balances: st.balances,
    nowS,
    startedS: Number(st.scenarioStartTime),
    ignoreCaps: dec.emergency,
  });

  const legs = orderLegs(sr);
  if (legs.length === 0) return "SAFE"; // caps clipped everything to zero

  // 8. per-leg action + receipt (receipt at legNonce+1). Sign all, broadcast in one batch.
  const noncePlan = planNonces(st.nonce, legs.length);
  const signed: Promise<`0x${string}`>[] = [];
  for (let i = 0; i < legs.length; i++) {
    const leg = legs[i]!;
    const { legNonce, receiptNonce } = noncePlan[i]!;
    const tx = leg.kind === "deposit" ? chain.depositTx(leg.amount) : chain.repayTx(leg.amount);
    const receipt: Receipt = {
      commit: st.commit.hash as `0x${string}`,
      round: BigInt(round),
      blockObserved: st.blockNumber,
      price: st.price,
      hfBp,
      action: ACTION_CODE[leg.kind],
      amount: leg.amount,
      actionNonce: BigInt(legNonce),
    };
    signed.push(chain.sign(acct, tx, legNonce, st.gasPrice));
    signed.push(
      signReceipt(receipt, receiptKey, cfg.receipts).then((sig) =>
        chain.sign(acct, chain.postReceiptTx(receipt, sig), receiptNonce, st.gasPrice),
      ),
    );
  }
  chain.sendRawBatch(await Promise.all(signed)); // REQUEST 2

  return dec.emergency ? "EMERGENCY" : "DEFENDED";
}

// R2 fallback: KEEL_TEE=0 registers the handler NON-confidentially (secrets exposed to the DON).
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

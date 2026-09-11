// Recorded on-chain run for the /replay chain source. Reconstructs a participant's real
// Sepolia run via packages/verifier and reshapes it into the engine Tick shape (so HfChart
// renders it unchanged) plus per-action Etherscan tx links. No engine, no synthetic data.
import { reconstruct, audit } from "keel-verifier";
import { hfBpOf } from "keel-controller";
import type { Tick } from "./engine";
import { DEPLOYMENT, etherscanTx } from "./deployment";

// Tick.kind supports repay/deposit/withdraw; borrow (4) has no engine tick kind → undefined.
const TICK_KIND: Record<number, "repay" | "deposit" | "withdraw" | undefined> = {
  1: "repay",
  2: "deposit",
  3: "withdraw",
};

export interface ChainRun {
  participant: string;
  verdict: string;
  actions: number;
  liquidated: boolean;
  commitHash?: string;
  ticks: Tick[];
  txByRound: Record<number, string>; // round → Etherscan url
}

export async function chainReplay(
  participant: `0x${string}` = DEPLOYMENT.participant,
): Promise<ChainRun | null> {
  try {
    const run = await reconstruct({
      rpcUrl: DEPLOYMENT.rpc,
      lending: DEPLOYMENT.lending,
      policyCommit: DEPLOYMENT.policyCommit,
      receipts: DEPLOYMENT.receipts,
      participant,
      fromBlock: DEPLOYMENT.fromBlock,
    });
    const rep = await audit(run, { receiptsAddr: DEPLOYMENT.receipts });
    const recByRound = new Map(run.receipts.map((r) => [Number(r.receipt.round), r]));
    const armByRound = new Map(rep.rows.map((r) => [r.round, r]));

    const txByRound: Record<number, string> = {};
    const ticks: Tick[] = run.rounds.map((r) => {
      const rec = recByRound.get(r.round);
      const arm = armByRound.get(r.round);
      if (rec) txByRound[r.round] = etherscanTx(rec.txHash);
      const cAfter = rec?.receipt.action === 2 ? r.cPre + rec.receipt.amount : r.cPre;
      const dAfter = rec?.receipt.action === 1 ? r.dPre - rec.receipt.amount : r.dPre;
      const hfAfter = hfBpOf(cAfter, dAfter, r.price);
      return {
        round: r.round,
        priceUsd: Number(r.price) / 100,
        hfBp: Number(r.hfBpPre),
        hfBpAfter: Number(hfAfter),
        C: Number(r.cPre) / 100,
        D: Number(r.dPre) / 100,
        acted: r.acted,
        kind: rec ? TICK_KIND[rec.receipt.action] : undefined,
        amountUsd: rec
          ? rec.receipt.action === 2
            ? (Number(rec.receipt.amount) / 100) * (Number(r.price) / 100)
            : Number(rec.receipt.amount) / 100
          : undefined,
        amountRaw: rec?.receipt.amount.toString(),
        actionCode: rec?.receipt.action,
        armBp: arm ? Number(arm.armBp) : Number(r.hfBpPre),
        targetBp: arm ? Number(arm.targetBp) : Number(r.hfBpPre),
        reason: r.acted ? "DEFENDED" : "SAFE",
        emergency: false,
        liquidated: false,
      };
    });

    return {
      participant,
      verdict: rep.verdict,
      actions: run.rounds.filter((r) => r.acted).length,
      liquidated: run.liquidated,
      commitHash: run.commit?.hash,
      ticks,
      txByRound,
    };
  } catch {
    return null;
  }
}

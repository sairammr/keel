// Adapter over the REAL hunter package. m1/m2 are the actual Bayesian models (fixed
// threshold + joint threshold/jitter); attack() drives the real controller. This module
// runs the real scenario engine to gather observations, calls the real inference, and
// reshapes the output for the client (posteriors carried in bp units so the heat strip
// renders unchanged).
import {
  runScenario as realRun,
  makeStarter,
  KEEL,
  type Scenario as RealScenario,
} from "keel-scenario";
import { m1, m2, obsFromTrace, obsFromChain, attack as realAttack, scaleEconomics } from "keel-hunter";
import { reconstruct } from "keel-verifier";
import type { Policy } from "keel-controller";
import { STARTER } from "./policy";
import { DEPLOYMENT } from "./deployment";

export interface Posterior {
  grid: number[]; // trigger grid, bp
  heat: number[];
  modeBp: number;
  hpdLoBp: number;
  hpdHiBp: number;
  widthBp: number; // 90% HPD width of the trigger (M1)
  widthHf: number;
  bMode: number;
  bWidthBp: number; // 90% HPD width of jitter b (M2)
  huntPriceUsd: number;
  spreadBp: number; // observed acted-HF spread
}

type ObsIn = { price: number; hfBp: number; hfBpPre?: number; action?: unknown };

function traceObs(trace: {
  ticks: { price: bigint; hfBp: bigint; hfBpPre?: bigint; action?: unknown }[];
}): ObsIn[] {
  return trace.ticks.map((t) => ({
    price: Number(t.price) / 100,
    hfBp: Number(t.hfBp),
    // pre-action HF is what the hunter must see (post-action HF is biased upward — P2.1)
    hfBpPre: t.hfBpPre != null ? Number(t.hfBpPre) : undefined,
    action: t.action,
  }));
}

// Real m1 + m2 over a bag of observations → bp-scaled serializable posterior.
function infer(obs: { h: number; a: 0 | 1 }[]): Posterior {
  const r1 = m1(obs);
  const r2 = m2(obs);
  const acted = obs.filter((o) => o.a === 1).map((o) => o.h);
  const spread = acted.length > 1 ? (Math.max(...acted) - Math.min(...acted)) * 10000 : 0;
  return {
    grid: r1.grid.map((h) => Math.round(h * 10000)),
    heat: Array.from(r1.post),
    modeBp: Math.round(r1.mode * 10000),
    hpdLoBp: Math.round(r1.hpd90.lo * 10000),
    hpdHiBp: Math.round(r1.hpd90.hi * 10000),
    widthBp: Math.round(r1.hpd90.width * 10000),
    widthHf: Math.round(r1.hpd90.width * 1000) / 1000,
    bMode: Math.round(((r2.hpd90b.lo + r2.hpd90b.hi) / 2) * 10000),
    bWidthBp: Math.round(r2.hpd90b.width * 10000),
    huntPriceUsd: Math.round(r2.huntPrice),
    spreadBp: Math.round(spread),
  };
}

// Posterior for one run (real trace → obs → inference).
export function posteriorForRun(trace: {
  ticks: { price: bigint; hfBp: bigint; hfBpPre?: bigint; action?: unknown }[];
}): Posterior {
  return infer(obsFromTrace(traceObs(trace)));
}

const OPTS = { cronPeriod: 300 };

// Per-scenario posteriors for the replay hunter strip.
export function scenarioPosteriors(
  scenario: RealScenario,
  policy: Policy,
  salt: Uint8Array,
): { keel: Posterior; starter: Posterior } {
  const k = realRun(scenario, policy, salt, OPTS, KEEL);
  const s = realRun(scenario, policy, salt, OPTS, makeStarter(STARTER.armBp, STARTER.targetBp));
  return { keel: posteriorForRun(k), starter: posteriorForRun(s) };
}

// Cross-market intelligence: aggregate observations across the whole scenario suite so
// the fixed threshold collapses to a point while Keel's jitter keeps the band open.
export function crossMarketIntel(
  scenarios: RealScenario[],
  policy: Policy,
  salt: Uint8Array,
): { keel: Posterior; starter: Posterior } {
  const kObs: { h: number; a: 0 | 1 }[] = [];
  const sObs: { h: number; a: 0 | 1 }[] = [];
  for (const scen of scenarios) {
    const k = realRun(scen, policy, salt, OPTS, KEEL);
    const s = realRun(scen, policy, salt, OPTS, makeStarter(STARTER.armBp, STARTER.targetBp));
    kObs.push(...obsFromTrace(traceObs(k)));
    sObs.push(...obsFromTrace(traceObs(s)));
  }
  return { keel: infer(kObs), starter: infer(sObs) };
}

// Real on-chain intel: reconstruct a participant's run from Sepolia events and run the
// same M1/M2 inference over its actual (HF, acted?) observations. No engine — the
// observations are the real log stream the verifier rebuilds.
export interface ChainIntel {
  keel: Posterior;
  rounds: number;
  actions: number;
  participant: string;
  fromBlock: string;
}

export async function chainIntel(
  participant: `0x${string}` = DEPLOYMENT.participant,
): Promise<ChainIntel | null> {
  try {
    const run = await reconstruct({
      rpcUrl: DEPLOYMENT.rpc,
      lending: DEPLOYMENT.lending,
      policyCommit: DEPLOYMENT.policyCommit,
      receipts: DEPLOYMENT.receipts,
      participant,
      fromBlock: DEPLOYMENT.fromBlock,
    });
    const obs = obsFromChain(run.rounds);
    return {
      keel: infer(obs),
      rounds: run.rounds.length,
      actions: run.rounds.filter((r) => r.acted).length,
      participant,
      fromBlock: DEPLOYMENT.fromBlock.toString(),
    };
  } catch {
    return null;
  }
}

// --- Attack (real controller-driven tap simulation) ---
export interface AttackTap {
  round: number;
  priceUsd: number;
  acted: boolean;
  kind?: string;
  amountVeth: number;
  hfBp: number;
  reserveAfter: number;
}
export interface AttackResult {
  taps: AttackTap[];
  capitalBurnedUsd: number; // $ of vETH deposited (reserve spent)
  debtForfeitedUsd: number; // $ of debt repaid under attack (debt-time score burned)
  reserveVethTrace: number[];
  forcedActions: number;
  huntPriceUsd: number;
  deepestPushUsd: number; // how far the attacker had to crash price
  reserveStart: number;
  scaledBurnedUsd: number; // ×1000 economic framing
  scaledDebtUsd: number;
}

export function runAttack(
  policy: Policy,
  salt: Uint8Array,
  huntPriceUsd: number,
  reserve0 = 300,
): AttackResult {
  const r = realAttack(policy, salt, { huntPrice: huntPriceUsd }, { reserve0, maxTaps: 8 });
  const scaled = scaleEconomics(r);
  const deepest = r.taps.length ? Math.min(...r.taps.map((t) => t.priceTap)) : huntPriceUsd;
  return {
    taps: r.taps.map((t) => ({
      round: t.round,
      priceUsd: t.priceTap,
      acted: t.acted,
      kind: t.kind,
      amountVeth: Math.round((t.amount / 100) * 1000) / 1000,
      hfBp: t.hfBp,
      reserveAfter: Math.round(t.reserveAfter * 1000) / 1000,
    })),
    capitalBurnedUsd: Math.round(r.capitalBurned * 100) / 100,
    debtForfeitedUsd: Math.round(r.debtForfeited * 100) / 100,
    reserveVethTrace: r.reserveVeth,
    forcedActions: r.forcedActions,
    huntPriceUsd: Math.round(huntPriceUsd),
    deepestPushUsd: Math.round(deepest),
    reserveStart: reserve0 / 100,
    scaledBurnedUsd: Math.round(scaled.scaled.capitalBurned),
    scaledDebtUsd: Math.round(scaled.scaled.debtForfeited),
  };
}

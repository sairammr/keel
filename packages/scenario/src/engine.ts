// runScenario — drives the ContractMirror through a Scenario under a Strategy.
// No mocks: state transitions and liquidation come straight from ContractMirror
// (the bit-exact ChallengeLending mirror). Keel uses controller decide()+solve().
import {
  decide,
  solve,
  hfBpOf,
  P0,
  type Policy,
  type DecideInput,
  type Decision,
} from "../../controller/src/index.ts";
import { ContractMirror, type Reserves } from "./mirror.ts";
import { scoreRun, type Tick, type Score, type ScoreInput } from "./scoring.ts";
import type { Scenario } from "./scenario.ts";

export interface Strategy {
  name: string;
  decide: (input: DecideInput) => Decision;
  // both legs to apply (deposit then repay). Keel replicates decide's solveTarget.
  plan: (input: DecideInput, d: Decision) => { dep: bigint; rep: bigint };
}

export interface Trace {
  ticks: Tick[];
  score: Score;
  liquidated: boolean;
}

export interface EngineOpts {
  cronPeriod: number; // seconds between cron evaluations
  faucetVETH?: bigint; // ×100, default 10 vETH
  faucetVUSD?: bigint; // ×100, default 20000 vUSD
  startTime?: number; // scenario start unix seconds (nonzero so accrual engages)
}

// Keel: recompute the exact solveTarget decide() used, then solve for BOTH legs.
export function keelPlan(input: DecideInput, d: Decision): { dep: bigint; rep: bigint } {
  const p = input.policy;
  const armBpN = Number(d.armBp);
  const solveTarget = d.emergency
    ? BigInt(Math.max(armBpN + p.buffer_bp, p.emerg_bp + p.buffer_bp))
    : d.targetBp;
  const r = solve({
    C: input.collateral,
    D: input.debt,
    P: input.prices[input.round]!,
    targetBp: solveTarget,
    policy: p,
    balances: input.balances,
    nowS: input.nowS,
    startedS: input.startedS,
    ignoreCaps: d.emergency,
  });
  return { dep: r.dep, rep: r.rep };
}

export const KEEL: Strategy = { name: "keel", decide, plan: keelPlan };

// Default Keel policy for tests/tuning (spec).
export const DEFAULT_KEEL_POLICY: Policy = {
  base_bp: 10700,
  kvol_bp: 10000,
  volcap_bp: 200,
  jitter_bp: 300,
  tjitter_bp: 300,
  tmax_bp: 11100,
  emerg_bp: 10300,
  buffer_bp: 500,
  target_cap_bp: 12500,
  halflife: 4,
  cooldown: 1,
  max_repay_bp: 3000,
  max_deposit: 250,
  t_est_s: 10800,
};

const mulberry32 = (seed: number): (() => number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export function runScenario(
  scenario: Scenario,
  policy: Policy,
  salt: Uint8Array,
  opts: EngineOpts,
  strategy: Strategy = KEEL,
): Trace {
  const reserves: Reserves = {
    vETH: opts.faucetVETH ?? 1000n, // 10 vETH ×100
    vUSD: opts.faucetVUSD ?? 2_000_000n, // 20000 vUSD ×100
  };
  const t0 = opts.startTime ?? 1_000_000;
  const cron = opts.cronPeriod;
  // cron-latency jitter is seeded off the salt so a run is fully deterministic.
  const rng = mulberry32(((salt[0]! << 8) | salt[1]!) ^ 0x9e37);

  const mirror = new ContractMirror(reserves, P0);
  mirror.start(t0);

  const prices: bigint[] = [P0];
  const ticks: Tick[] = [];
  let lastActionRound = -1;
  let clock = t0;

  for (const step of scenario.steps) {
    mirror.updatePrice(step.price);
    prices.push(step.price);
    const round = prices.length - 1;
    const nticks = Math.max(1, Math.ceil(step.dtSeconds / cron));

    for (let k = 0; k < nticks; k++) {
      const latency = Math.floor(rng() * cron);
      const tickTime = Math.min(clock + step.dtSeconds, clock + k * cron + latency);
      mirror.now = tickTime;

      const P = mirror.P;
      const hfBpPre = hfBpOf(mirror.C, mirror.D, P); // HF the controller observes, before any action
      const input: DecideInput = {
        policy,
        salt,
        prices,
        round,
        collateral: mirror.C,
        debt: mirror.D,
        hfBp: hfBpPre,
        lastActionRound,
        nowS: tickTime,
        startedS: t0,
        balances: mirror.reserves,
      };

      const d = strategy.decide(input);
      let dep = 0n;
      let rep = 0n;
      if (d.act) {
        const plan = strategy.plan(input, d);
        dep = plan.dep;
        rep = plan.rep;
        if (dep > 0n) mirror.deposit(dep);
        if (rep > 0n) mirror.repay(rep);
        lastActionRound = round;
      }

      mirror.checkAllHF();

      ticks.push({
        round,
        price: P,
        hf100: mirror.hf100(),
        hfBpPre,
        hfBp: hfBpOf(mirror.C, mirror.D, P),
        collateral: mirror.C,
        debt: mirror.D,
        armBp: d.armBp,
        targetBp: d.targetBp,
        action: d.act && d.kind ? { kind: d.kind, amount: d.amount ?? 0n } : undefined,
        dep,
        rep,
      });
    }
    clock += step.dtSeconds;
  }

  mirror.stop(clock);

  const scoreInput: ScoreInput = {
    ticks,
    liquidated: mirror.liquidated,
    debtTimeIntegral: mirror.cumulativeDebtTime,
    duration: mirror.duration,
  };
  return { ticks, score: scoreRun(scoreInput), liquidated: mirror.liquidated };
}

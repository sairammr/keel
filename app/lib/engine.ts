// Adapter over the REAL scenario engine. runScenario drives ContractMirror (the
// bit-exact ChallengeLending mirror) through the real controller decide()+solve(); this
// module only reshapes the resulting Trace into JSON-serializable rows for the client.
import {
  runScenario as realRun,
  makeStarter,
  KEEL,
  type Scenario as RealScenario,
  type Trace,
  type Score,
} from "keel-scenario";
import type { Policy } from "keel-controller";
import { STARTER } from "./policy";

export type { Score };

export interface Tick {
  round: number;
  priceUsd: number;
  hfBp: number; // health after this round's action (trigger-in-force units)
  hfBpAfter: number;
  C: number;
  D: number;
  acted: boolean;
  kind?: "repay" | "deposit" | "withdraw";
  amountUsd?: number;
  amountRaw?: string;
  actionCode?: number; // 1 repay, 2 deposit, 3 withdraw
  armBp: number; // secret trigger in force
  targetBp: number;
  reason: string;
  emergency: boolean;
  liquidated: boolean;
}

export interface Run {
  ticks: Tick[];
  score: Score;
  actions: number;
  capitalUsd: number;
  liquidated: boolean;
}

const OPTS = { cronPeriod: 300 };
const round2 = (x: number) => Math.round(x * 100) / 100;

// Collapse the multi-tick-per-round trace into one row per price level (the level's
// final state), preserving whichever tick fired an action.
function shape(trace: Trace): Run {
  const byRound = new Map<number, Tick>();
  let capitalUsd = 0;

  for (const t of trace.ticks) {
    const price = Number(t.price);
    const dep = Number(t.dep);
    const rep = Number(t.rep);
    if (dep > 0 || rep > 0) capitalUsd += (dep * price) / 100 / 100 + rep / 100;

    const acted = !!t.action;
    const kind = t.action?.kind;
    const amountRaw = kind === "deposit" ? t.dep : kind === "repay" ? t.rep : undefined;
    const amountUsd =
      kind === "deposit"
        ? round2((dep * price) / 100 / 100)
        : kind === "repay"
          ? round2(rep / 100)
          : undefined;

    const row: Tick = {
      round: t.round,
      priceUsd: price / 100,
      hfBp: Number(t.hfBp),
      hfBpAfter: Number(t.hfBp),
      C: round2(Number(t.collateral) / 100),
      D: round2(Number(t.debt) / 100),
      acted,
      kind,
      amountUsd,
      amountRaw: amountRaw?.toString(),
      actionCode: kind === "deposit" ? 2 : kind === "repay" ? 1 : kind === "withdraw" ? 3 : undefined,
      armBp: Number(t.armBp),
      targetBp: Number(t.targetBp),
      reason: acted ? "DEFENDED" : Number(t.hfBp) <= Number(t.armBp) ? "CAPPED" : "SAFE",
      emergency: Number(t.hfBp) < 10300,
      liquidated: Number(t.hf100) <= 100,
    };
    const prev = byRound.get(t.round);
    // keep the acting row if present; otherwise the latest state for the round
    if (!prev || acted) byRound.set(t.round, row);
  }

  const ticks = [...byRound.values()].sort((a, b) => a.round - b.round);
  return {
    ticks,
    score: trace.score,
    actions: trace.score.nActions,
    capitalUsd: round2(capitalUsd),
    liquidated: trace.liquidated,
  };
}

export function runKeel(scenario: RealScenario, policy: Policy, salt: Uint8Array): Run {
  return shape(realRun(scenario, policy, salt, OPTS, KEEL));
}

export function runStarterRun(
  scenario: RealScenario,
  policy: Policy,
  salt: Uint8Array,
): Run {
  return shape(realRun(scenario, policy, salt, OPTS, makeStarter(STARTER.armBp, STARTER.targetBp)));
}

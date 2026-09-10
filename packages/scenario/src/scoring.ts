// Scoring mirror — spec §4.6. ALL formula assumptions are isolated here so a single
// edit swaps them if the organiser's answers differ (see CONSTS block).
import { P0, INIT_DEBT, type ActionKind } from "../../controller/src/index.ts";

// ---- isolated formula constants (one-line swap on organiser clarification) ----
const W_SURVIVE = 40;
const W_DEBTTIME = 20;
const W_CAPEFF = 15;
const W_DISCIPLINE = 10;
const DISCIPLINE_STEP = 0.25; // penalty per action beyond the first
// capital-efficiency denominator: 5·P0 (init collateral value) + 7000·100 (init debt), ×100 vUSD
const CAPEFF_DENOM = Number(5n * P0 + 7000n * 100n); // 1_700_000
// -------------------------------------------------------------------------------

export interface Tick {
  round: number;
  price: bigint;
  hf100: bigint;
  hfBp: bigint;
  collateral: bigint;
  debt: bigint;
  armBp: bigint;
  targetBp: bigint;
  action?: { kind: ActionKind; amount: bigint }; // finishing leg (display)
  dep: bigint; // vETH deposited this tick (×100), 0 if none
  rep: bigint; // vUSD repaid this tick (×100), 0 if none
}

export interface Score {
  survive: number;
  debtTime: number;
  capEff: number;
  discipline: number;
  total: number;
  liquidated: boolean;
  nActions: number;
}

export interface ScoreInput {
  ticks: Tick[];
  liquidated: boolean;
  debtTimeIntegral: bigint; // cumulativeDebtTime (×100 vUSD · seconds)
  duration: number; // seconds
}

function clamp0(x: number): number {
  return x < 0 ? 0 : x;
}

export function scoreRun(run: ScoreInput): Score {
  // capital deployed = Σ dep·P/100 + Σ rep  (×100 vUSD)
  let capital = 0;
  let nActions = 0;
  for (const t of run.ticks) {
    if (t.dep > 0n || t.rep > 0n) nActions += 1;
    capital += Number((t.dep * t.price) / 100n) + Number(t.rep);
  }

  const survive = run.liquidated ? 0 : W_SURVIVE;

  const debtTime =
    run.duration === 0
      ? 0
      : W_DEBTTIME * (Number(run.debtTimeIntegral) / (Number(INIT_DEBT) * run.duration));

  const capEff = W_CAPEFF * (1 - capital / CAPEFF_DENOM);

  const discipline = W_DISCIPLINE * Math.max(0, 1 - DISCIPLINE_STEP * Math.max(0, nActions - 1));

  const s = {
    survive: clamp0(survive),
    debtTime: clamp0(debtTime),
    capEff: clamp0(capEff),
    discipline: clamp0(discipline),
  };
  return {
    ...s,
    total: s.survive + s.debtTime + s.capEff + s.discipline,
    liquidated: run.liquidated,
    nActions,
  };
}

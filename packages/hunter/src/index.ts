// KEEL hunter — adversary panel doing real Bayesian inference over public chain observations.
export { m1, hpd, bGrid, EPS, N_B, type Obs } from "./m1";
export { m2, wGrid, predictive, N_W, H_PER_DOLLAR } from "./m2";
export { attack, scaleEconomics, type Tap, type AttackPosterior, type AttackOpts } from "./attack";

import { H_PER_DOLLAR } from "./m2";
import type { Obs } from "./m1";

type Tick = { price: number; hfBp: number; action?: unknown };

/**
 * Convert a scenario-engine trace into M1/M2 observations: one Obs per distinct
 * price level, a=1 iff an action landed while price sat at that level.
 * h is the health factor at the level (hfBp/10000, falling back to price/1794.87).
 */
export function obsFromTrace(ticks: Tick[]): Obs[] {
  const byPrice = new Map<number, { h: number; a: 0 | 1 }>();
  for (const t of ticks) {
    const h = t.hfBp ? t.hfBp / 10000 : t.price * H_PER_DOLLAR;
    const acted = t.action != null;
    const prev = byPrice.get(t.price);
    if (!prev) byPrice.set(t.price, { h, a: acted ? 1 : 0 });
    else if (acted) prev.a = 1;
  }
  return [...byPrice.values()];
}

/**
 * Observations from a reconstructed on-chain run (packages/verifier's per-round table).
 * Each round is already one price level: h = pre-action HF, a = 1 iff an action landed.
 * Kept structurally decoupled from the verifier (takes the minimal {hfBpPre, acted} shape)
 * so the hunter package has no chain/RPC dependency.
 */
export function obsFromChain(rounds: { hfBpPre: bigint | number; acted: boolean }[]): Obs[] {
  return rounds.map((r) => ({ h: Number(r.hfBpPre) / 10000, a: (r.acted ? 1 : 0) as 0 | 1 }));
}

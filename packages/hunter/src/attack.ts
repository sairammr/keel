// Attack simulation (spec §6) driving the REAL controller.
// Hunter taps the price just below the inferred hunt price, watches the defender
// (decide+solve) respond, then reverts. Repeats until the vETH reserve is drained
// or the tap budget runs out.

import { decide, hfBpOf, type Policy } from "../../controller/src/index.ts";

export type Tap = {
  round: number;
  priceTap: number; // dollars
  acted: boolean;
  kind?: string;
  amount: number; // vETH ×100 deposited (or vUSD ×100 repaid)
  hfBp: number;
  reserveAfter: number; // vETH ×100
};

export type AttackPosterior = { huntPrice: number }; // dollars

export type AttackOpts = {
  reserve0?: number; // defender vETH reserve, ×100 (default 300 = 3.00 vETH)
  maxTaps?: number; // default 6
  tapFrac?: number; // p_tap = huntPrice * tapFrac (default 0.97, a real push below)
};

const C0 = 500n; // 5.00 vETH ×100
const D0 = 700000n; // 7,000.00 vUSD ×100
const MIN_RESERVE = 100n; // 1.00 vETH ×100
const P0 = 200000n; // $2,000.00 ×100

export function attack(
  target: Policy,
  salt: Uint8Array,
  posterior: AttackPosterior,
  opts: AttackOpts = {},
): {
  taps: Tap[];
  capitalBurned: number; // dollars of reserve value the defender spent
  reserveVeth: number[]; // vETH reserve trajectory, whole vETH
  forcedActions: number;
} {
  const reserve0 = BigInt(opts.reserve0 ?? 300);
  const maxTaps = opts.maxTaps ?? 6;
  const tapFrac = opts.tapFrac ?? 0.97;

  const pTapDollars = posterior.huntPrice * tapFrac;
  const pTap = BigInt(Math.round(pTapDollars * 100)); // ×100

  // Persistent single-borrower position. Each tap pushes price to p_tap, the defender
  // (decide+solve) may act, then price reverts to the prior level. Deposits accumulate
  // on C, so a decisive defender (Keel: one restore lifts HF clear of its arm) is
  // immune after ≤1 action per price level, while a naive fixed-threshold bot that only
  // dribbles small top-ups gets milked tap after tap. The vETH reserve bleeds on every
  // forced action. The ladder accumulates, so Keel's per-round jitter differs tap-to-tap.
  let C = C0;
  const D = D0;
  let reserve = reserve0;
  let lastActionRound = -1;
  const prices: bigint[] = [P0];

  const taps: Tap[] = [];
  const reserveVeth: number[] = [Number(reserve) / 100];
  let capitalBurned = 0;
  let forcedActions = 0;

  for (let t = 0; t < maxTaps; t++) {
    if (reserve < MIN_RESERVE) break;

    // --- push price down to the tap level ---
    prices.push(pTap);
    const round = prices.length - 1;
    const hfBp = hfBpOf(C, D, pTap);

    const dec = decide({
      policy: target,
      salt,
      prices,
      round,
      collateral: C,
      debt: D,
      hfBp,
      lastActionRound,
      nowS: 1,
      startedS: 1,
      balances: { vETH: reserve, vUSD: 0n },
    });

    let acted = false;
    let amount = 0n;
    if (dec.act && dec.amount && dec.amount > 0n && dec.kind === "deposit") {
      acted = true;
      forcedActions++;
      const dep = dec.amount < reserve ? dec.amount : reserve;
      amount = dep;
      C += dep;
      reserve -= dep;
      capitalBurned += (Number(dep) / 100) * (Number(pTap) / 100);
      lastActionRound = round;
    }

    taps.push({
      round,
      priceTap: Number(pTap) / 100,
      acted,
      kind: dec.kind,
      amount: Number(amount),
      hfBp: Number(hfBp),
      reserveAfter: Number(reserve) / 100,
    });

    // --- revert price back up to the prior level ---
    prices.push(prices[round - 1]!);
    reserveVeth.push(Number(reserve) / 100);
  }

  return { taps, capitalBurned, reserveVeth, forcedActions };
}

/** Economic framing: report raw sim numbers and a ×N scaled view (default 1000). */
export function scaleEconomics(
  r: { capitalBurned: number; reserveVeth: number[]; forcedActions: number },
  factor = 1000,
): {
  raw: { capitalBurned: number; forcedActions: number };
  scaled: { capitalBurned: number; reserveDrained: number };
} {
  const drained = (r.reserveVeth[0]! - r.reserveVeth[r.reserveVeth.length - 1]!) * factor;
  return {
    raw: { capitalBurned: r.capitalBurned, forcedActions: r.forcedActions },
    scaled: { capitalBurned: r.capitalBurned * factor, reserveDrained: drained },
  };
}

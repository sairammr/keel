// Attack simulation (spec §6) driving the REAL controller.
// Hunter taps the price just below the inferred hunt price, watches the defender
// (decide+solve) respond, then reverts. Repeats until the vETH reserve is drained
// or the tap budget runs out.

import { decide, hfBpOf, THETA, LIQ_BP, type Policy } from "../../controller/src/index.ts";

export type Tap = {
  round: number;
  priceTap: number; // dollars
  acted: boolean;
  kind?: string; // "deposit" | "repay"
  amount: number; // deposit: vETH ×100 · repay: vUSD ×100
  hfBp: number;
  reserveAfter: number; // vETH reserve ×100
};

export type AttackPosterior = { huntPrice: number }; // dollars

export type AttackOpts = {
  reserve0?: number; // defender vETH reserve, ×100 (default 300 = 3.00 vETH)
  reserveUsd0?: number; // defender vUSD reserve, ×100 (default 300000 = $3,000) — funds repay legs
  maxTaps?: number; // default 6
  tapFrac?: number; // p_tap = huntPrice * tapFrac (default 0.97, a real push below)
};

export type AttackResult = {
  taps: Tap[];
  capitalBurned: number; // dollars of vETH the defender deposited (reserve value spent)
  debtForfeited: number; // dollars of debt repaid during fake dips (debt-time score burned)
  reserveVeth: number[]; // vETH reserve trajectory, whole vETH
  forcedActions: number; // deposit + repay legs the taps forced
};

const C0 = 500n; // 5.00 vETH ×100
const D0 = 700000n; // 7,000.00 vUSD ×100
const MIN_VETH = 50n; // 0.50 vETH ×100
const MIN_VUSD = 5000n; // $50 ×100
const P0 = 200000n; // $2,000.00 ×100

export function attack(
  target: Policy,
  salt: Uint8Array,
  posterior: AttackPosterior,
  opts: AttackOpts = {},
): AttackResult {
  const reserve0 = BigInt(opts.reserve0 ?? 300);
  const reserveUsd0 = BigInt(opts.reserveUsd0 ?? 300000);
  const maxTaps = opts.maxTaps ?? 6;
  const tapFrac = opts.tapFrac ?? 0.97;

  // The attacker targets a fixed health factor — the hunt HF, just below the inferred
  // trigger. It pushes price to whatever level puts the CURRENT position at that HF, so as
  // the defender adds collateral the attacker must push progressively DEEPER to re-pin it
  // (the real stop-hunt: each defence raises the bar, each tap costs the attacker more).
  // A fixed-threshold bot whose trigger is pinned is forced on every tap; Keel's per-round
  // jitter means most taps land clear of its (secret) arm and force nothing. Both reserves
  // are funded, so a repay leg (de-levers but burns debt-time score) is counted honestly.
  let C = C0;
  let D = D0;
  // Pin the defender at the hunt HF — but never below the liquidation line: a push past it
  // liquidates the position (a one-shot bounty, not a milk). When the 90%-confidence hunt
  // price is itself below liq (as it is for Keel, whose jitter forces the attacker that
  // deep), the attacker can only press to the liquidation edge.
  const rawTarget = hfBpOf(C0, D0, BigInt(Math.round(posterior.huntPrice * tapFrac * 100)));
  const targetHfBp = rawTarget > LIQ_BP + 20n ? rawTarget : LIQ_BP + 20n;
  let reserve = reserve0;
  let reserveUsd = reserveUsd0;
  let lastActionRound = -1;
  const prices: bigint[] = [P0];

  const taps: Tap[] = [];
  const reserveVeth: number[] = [Number(reserve) / 100];
  let capitalBurned = 0;
  let debtForfeited = 0;
  let forcedActions = 0;

  for (let t = 0; t < maxTaps; t++) {
    if (reserve < MIN_VETH && reserveUsd < MIN_VUSD) break;

    // --- push price to whatever re-pins CURRENT (C,D) at the target HF: P = hf·D/(C·θ) ---
    const pTap = (targetHfBp * D) / (C * THETA);
    // A push below the liquidation price would liquidate the position — a one-shot bounty
    // that ends the hunt, not a milk. So the attacker only keeps tapping while it can
    // re-pin the trigger ABOVE the liq floor. A defender that restores decisively (Keel:
    // high buffer+vol target) drives the next re-pin below the floor fast → the milk stops.
    const liqFloor = (LIQ_BP * D) / (C * THETA);
    if (pTap <= liqFloor) break;
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
      balances: { vETH: reserve, vUSD: reserveUsd }, // both legs fundable — solver picks
    });

    let acted = false;
    let amount = 0n;
    if (dec.act && dec.amount && dec.amount > 0n) {
      if (dec.kind === "deposit") {
        const dep = dec.amount < reserve ? dec.amount : reserve;
        if (dep > 0n) {
          acted = true;
          amount = dep;
          C += dep;
          reserve -= dep;
          capitalBurned += (Number(dep) / 100) * (Number(pTap) / 100);
        }
      } else if (dec.kind === "repay") {
        let rep = dec.amount < reserveUsd ? dec.amount : reserveUsd;
        if (rep > D) rep = D;
        if (rep > 0n) {
          acted = true;
          amount = rep;
          D -= rep;
          reserveUsd -= rep;
          debtForfeited += Number(rep) / 100; // dollars of debt-time score burned
        }
      }
      if (acted) {
        forcedActions++;
        lastActionRound = round;
      }
    }

    taps.push({
      round,
      priceTap: Number(pTap) / 100,
      acted,
      kind: acted ? dec.kind : undefined,
      amount: Number(amount),
      hfBp: Number(hfBp),
      reserveAfter: Number(reserve) / 100,
    });

    // --- revert price back up to the prior level ---
    prices.push(prices[round - 1]!);
    reserveVeth.push(Number(reserve) / 100);
  }

  return { taps, capitalBurned, debtForfeited, reserveVeth, forcedActions };
}

/** Economic framing: report raw sim numbers and a ×N scaled view (default 1000). */
export function scaleEconomics(
  r: { capitalBurned: number; debtForfeited: number; reserveVeth: number[]; forcedActions: number },
  factor = 1000,
): {
  raw: { capitalBurned: number; debtForfeited: number; forcedActions: number };
  scaled: { capitalBurned: number; debtForfeited: number; reserveDrained: number };
} {
  const drained = (r.reserveVeth[0]! - r.reserveVeth[r.reserveVeth.length - 1]!) * factor;
  return {
    raw: { capitalBurned: r.capitalBurned, debtForfeited: r.debtForfeited, forcedActions: r.forcedActions },
    scaled: { capitalBurned: r.capitalBurned * factor, debtForfeited: r.debtForfeited * factor, reserveDrained: drained },
  };
}

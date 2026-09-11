import { expect, test, describe } from "bun:test";
import { m1, m2, attack, obsFromTrace, obsFromChain, type Obs } from "./index";
import type { Policy } from "../../controller/src/index.ts";

const H_PER_DOLLAR = 1 / 1794.87;
const price = (h: number) => h / H_PER_DOLLAR; // dollars for a given HF

// ---- data generators ----
// True fixed threshold: act iff h <= threshold (a hunter's M1 assumption made real).
const fixedObs = (threshold: number, hs: number[]): Obs[] =>
  hs.map((h) => ({ h, a: (h <= threshold ? 1 : 0) as 0 | 1 }));

// Threshold b + upward jitter in [0, jmax], per-level draw → act boundary varies in [b, b+jmax].
// Deliberately contradictory for a single-threshold reader.
const JITTER: [number, number][] = [
  [1.13, 0.0], [1.12, 0.0],
  [1.11, 0.03], [1.105, 0.0], [1.10, 0.025], [1.095, 0.005],
  [1.09, 0.02], [1.085, 0.001], [1.08, 0.0],
  [1.075, 0.0], [1.07, 0.0], [1.06, 0.0],
];
const jitterObs = (b: number): Obs[] =>
  JITTER.map(([h, j]) => ({ h, a: (h <= b + j ? 1 : 0) as 0 | 1 }));

const KEEL: Policy = {
  base_bp: 10700, kvol_bp: 10000, volcap_bp: 200, jitter_bp: 300, tmax_bp: 11100,
  emerg_bp: 10300, buffer_bp: 500, target_cap_bp: 12500, halflife: 4, cooldown: 1,
  max_repay_bp: 3000, max_deposit: 250, t_est_s: 10800,
};
// Honest fixed-threshold bot (official-template semantics): a constant public trigger
// (1.08), a shallow restore (buffer 200 → ~1.10), same solver + real caps as Keel. No
// hobble — it defends decisively, it just can't hide WHERE it acts.
const STARTER: Policy = {
  base_bp: 10800, kvol_bp: 0, volcap_bp: 0, jitter_bp: 0, tmax_bp: 10800,
  emerg_bp: 10300, buffer_bp: 200, target_cap_bp: 12500, halflife: 4, cooldown: 1,
  max_repay_bp: 3000, max_deposit: 250, t_est_s: 10800,
};
const SALT = new Uint8Array(32).fill(7);

describe("M1 — fixed-threshold posterior", () => {
  test("collapses on true fixed threshold 1.08", () => {
    // descending ladder straddling 1.08; a=0 above kills the upper tail, tight 0.0005 bracket pins it
    const obs = fixedObs(1.08, [1.13, 1.11, 1.09, 1.081, 1.0805, 1.08, 1.0795, 1.07, 1.06]);
    const r = m1(obs);
    expect(r.mode).toBeCloseTo(1.08, 3);
    expect(r.hpd90.width).toBeLessThanOrEqual(0.005);
  });

  test("does NOT collapse on jittered data (stays wide)", () => {
    const r = m1(jitterObs(1.08));
    // single fixed threshold cannot fit an upward-jittered boundary → posterior stays wide
    expect(r.hpd90.width).toBeGreaterThanOrEqual(0.03);
  });
});

describe("M2 — threshold + unknown jitter", () => {
  test("bounds jitter and hunts near the floor", () => {
    const r = m2(jitterObs(1.08));
    const floorPrice = price(1.08);
    // marginal over b stays at least as wide as the injected jitter
    expect(r.hpd90b.width).toBeGreaterThanOrEqual(0.03);
    // hunt price is a deeper/cheaper push than M1's threshold, yet near the floor b
    expect(r.huntPrice).toBeLessThan(floorPrice);
    expect(r.huntPrice).toBeGreaterThan(0.95 * floorPrice);
  });
});

describe("attack — real controller under the hunter's push", () => {
  const deepest = (a: { taps: { priceTap: number }[] }) =>
    Math.min(...a.taps.map((t) => t.priceTap));

  test("the stop-hunt forces the pinned fixed-threshold bot to keep spending", () => {
    const hunt = m1(fixedObs(1.08, [1.13, 1.11, 1.09, 1.081, 1.0805, 1.08, 1.0795, 1.07])).mode;
    const a = attack(STARTER, SALT, { huntPrice: price(hunt) }, { reserve0: 300 });
    expect(a.forcedActions).toBeGreaterThanOrEqual(2);
    // reported acted taps and the forced counter agree
    expect(a.taps.filter((t) => t.acted).length).toBe(a.forcedActions);
  });

  test("Keel hides WHERE it acts: the attacker must push deeper and Keel de-levers", () => {
    // The M1 hunter pins the starter exactly; the Keel-aware M2 hunter must aim deeper.
    const starterHunt = m1(fixedObs(1.08, [1.13, 1.11, 1.09, 1.081, 1.0805, 1.08, 1.0795, 1.07])).mode;
    const keelHunt = m2(jitterObs(1.08)).huntPrice;
    const aStart = attack(STARTER, SALT, { huntPrice: price(starterHunt) }, { reserve0: 300 });
    const aKeel = attack(KEEL, SALT, { huntPrice: keelHunt }, { reserve0: 300 });

    // Keel-aware hunt price is a deeper push than the discoverable fixed threshold.
    expect(keelHunt).toBeLessThan(price(starterHunt));
    // To force Keel the attacker must crash the price further than for the starter.
    expect(deepest(aKeel)).toBeLessThan(deepest(aStart));
    // Under the deep push Keel's decisive restore de-levers (repays) — burning debt-time
    // score, not silently bleeding a reserve like the milked fixed-threshold bot.
    expect(aKeel.debtForfeited).toBeGreaterThan(aStart.debtForfeited);
    expect(aKeel.taps.filter((t) => t.acted).length).toBe(aKeel.forcedActions);
  });
});

describe("numerical safety", () => {
  test("no NaN/Inf; posteriors normalise to 1", () => {
    const r1 = m1(jitterObs(1.08));
    const r2 = m2(jitterObs(1.08));
    const s1 = r1.post.reduce((a, b) => a + b, 0);
    const s2 = r2.post2d.reduce((a, b) => a + b, 0);
    expect(s1).toBeCloseTo(1, 9);
    expect(s2).toBeCloseTo(1, 9);
    for (const v of r1.post) expect(Number.isFinite(v)).toBe(true);
    for (const v of r2.post2d) expect(Number.isFinite(v)).toBe(true);
    expect(Number.isFinite(r2.huntPrice)).toBe(true);
    for (const v of r2.marginalB) expect(Number.isFinite(v)).toBe(true);
  });

  test("obsFromChain maps reconstructed rounds to (h, a) observations", () => {
    const obs = obsFromChain([
      { hfBpPre: 11140n, acted: false },
      { hfBpPre: 10697n, acted: true },
      { hfBpPre: 11297, acted: false },
    ]);
    expect(obs.length).toBe(3);
    expect(obs[1]!.h).toBeCloseTo(1.0697, 4);
    expect(obs[1]!.a).toBe(1);
    expect(obs[0]!.a).toBe(0);
  });

  test("obsFromTrace collapses a trace to one Obs per price level", () => {
    const obs = obsFromTrace([
      { price: 2000, hfBp: 11140 },
      { price: 1940, hfBp: 10800, action: { kind: "deposit" } },
      { price: 1940, hfBp: 10800 },
    ]);
    expect(obs.length).toBe(2);
    const acted = obs.find((o) => o.a === 1);
    expect(acted).toBeDefined();
    expect(acted!.h).toBeCloseTo(1.08, 4);
  });
});

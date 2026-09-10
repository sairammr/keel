import { expect, test } from "bun:test";
import { ContractMirror } from "./mirror.ts";
import { hf100Of, INIT_COLLATERAL, INIT_DEBT, P0 } from "../../controller/src/index.ts";

const rng = (() => {
  let a = 12345 >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
})();
const ri = (lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));

test("1. mirror hf100 === controller hf100Of on 20 random (C,D,P)", () => {
  for (let i = 0; i < 20; i++) {
    const C = BigInt(ri(1, 5000));
    const D = BigInt(ri(1, 5_000_000));
    const P = BigInt(ri(50_000, 400_000));
    const m = new ContractMirror({ vETH: 0n, vUSD: 0n }, P);
    m.C = C;
    m.D = D;
    expect(m.hf100()).toBe(hf100Of(C, D, P));
  }
});

test("2. liquidates exactly when hf100 <= 100 (boundary)", () => {
  // C=500,D=700000: hf100=100 at P≈179487. Integer flooring makes hf100=100 a plateau;
  // find the exact transition: highest P still liquidating, lowest P surviving.
  const C = INIT_COLLATERAL;
  const D = INIT_DEBT;
  let firstSurvive = 0n; // smallest P with hf100 > 100
  for (let p = 179_000n; p <= 182_000n; p++) {
    if (hf100Of(C, D, p) > 100n) {
      firstSurvive = p;
      break;
    }
  }
  expect(firstSurvive).toBeGreaterThan(0n);
  const lastLiq = firstSurvive - 1n; // highest P still hf100 <= 100

  expect(hf100Of(C, D, lastLiq)).toBeLessThanOrEqual(100n);
  expect(hf100Of(C, D, firstSurvive)).toBeGreaterThan(100n);

  const below = new ContractMirror({ vETH: 0n, vUSD: 0n }, lastLiq);
  below.checkAllHF();
  expect(below.liquidated).toBe(true);

  const above = new ContractMirror({ vETH: 0n, vUSD: 0n }, firstSurvive);
  above.checkAllHF();
  expect(above.liquidated).toBe(false);
});

test("3. property: 200 random sequences — no negatives, debt-time monotone, sticky flag", () => {
  for (let s = 0; s < 200; s++) {
    const m = new ContractMirror({ vETH: 5000n, vUSD: 10_000_000n }, P0);
    m.start(1_000_000);
    let prevDebtTime = m.cumulativeDebtTime;
    let wasLiquidated = false;
    for (let op = 0; op < ri(3, 12); op++) {
      m.now += ri(1, 300);
      const roll = rng();
      try {
        if (roll < 0.3) m.updatePrice(BigInt(ri(120_000, 260_000)));
        else if (roll < 0.55) m.deposit(BigInt(ri(0, 200)));
        else if (roll < 0.8) m.repay(BigInt(ri(0, Number(m.D > 5000n ? 5000n : m.D))));
        else if (roll < 0.9 && m.C > 0n) m.withdrawCollateral(BigInt(ri(0, 50)));
        else m.checkAllHF();
      } catch {
        // reverts (LTV / balance) are legitimate — state must remain consistent
      }
      expect(m.C >= 0n).toBe(true);
      expect(m.D >= 0n).toBe(true);
      expect(m.reserves.vETH >= 0n).toBe(true);
      expect(m.reserves.vUSD >= 0n).toBe(true);
      expect(m.cumulativeDebtTime >= prevDebtTime).toBe(true);
      prevDebtTime = m.cumulativeDebtTime;
      if (wasLiquidated) expect(m.liquidated).toBe(true); // sticky
      wasLiquidated = m.liquidated;
    }
  }
});

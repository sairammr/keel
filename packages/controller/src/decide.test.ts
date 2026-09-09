import { expect, test } from "bun:test";
import { decide } from "./decide";
import { hfBpOf } from "./hf";
import { DEFAULT_POLICY } from "./fixture";
import { LIQ_BP, type DecideInput } from "./types";

const salt = new Uint8Array(32).fill(3);
const C = 500n;
const D = 700000n;

function mk(prices: bigint[], lastActionRound = -1): DecideInput {
  const round = prices.length - 1;
  const P = prices[round]!;
  return {
    policy: DEFAULT_POLICY,
    salt,
    prices,
    round,
    collateral: C,
    debt: D,
    hfBp: hfBpOf(C, D, P),
    lastActionRound,
    nowS: 0,
    startedS: 1,
    balances: { vETH: 100000n, vUSD: 10_000_000n },
  };
}

test("safe at P0 → act:false", () => {
  const d = decide(mk([200000n]));
  expect(d.act).toBe(false);
  expect(d.reason).toBe("SAFE");
});

test("idle when not started", () => {
  const inp = mk([200000n]);
  inp.startedS = 0;
  expect(decide(inp).reason).toBe("IDLE");
});

test("armBp always within [base, tmax]", () => {
  const prices: bigint[] = [200000n];
  for (let p = 199000; p >= 175000; p -= 1000) {
    prices.push(BigInt(p));
    const d = decide(mk([...prices]));
    expect(d.armBp).toBeGreaterThanOrEqual(BigInt(DEFAULT_POLICY.base_bp));
    expect(d.armBp).toBeLessThanOrEqual(BigInt(DEFAULT_POLICY.tmax_bp));
  }
});

test("acts before liquidation as price falls", () => {
  const prices: bigint[] = [200000n];
  let acted = false;
  for (let p = 199000; p >= 180000; p -= 500) {
    prices.push(BigInt(p));
    const d = decide(mk([...prices]));
    if (d.act) {
      expect(hfBpOf(C, D, BigInt(p))).toBeGreaterThan(LIQ_BP);
      acted = true;
      break;
    }
  }
  expect(acted).toBe(true);
});

test("emergency always acts when hfBp < emerg", () => {
  // P chosen so hfBp < emerg_bp (10300)
  const P = 184000n;
  expect(hfBpOf(C, D, P)).toBeLessThan(BigInt(DEFAULT_POLICY.emerg_bp));
  const d = decide(mk([200000n, P]));
  expect(d.act).toBe(true);
  expect(d.emergency).toBe(true);
  expect(d.reason).toBe("EMERGENCY");
});

test("cooldown blocks 2nd action same round", () => {
  // hfBp between emerg and arm → non-emergency trigger
  const P = 188500n;
  const bp = hfBpOf(C, D, P);
  expect(bp).toBeGreaterThan(BigInt(DEFAULT_POLICY.emerg_bp));
  const first = decide(mk([200000n, P], -1));
  expect(first.act).toBe(true);
  expect(first.emergency).toBe(false);
  // acted this round (round=1); ask again same round
  const second = decide(mk([200000n, P], 1));
  expect(second.act).toBe(false);
  expect(second.reason).toBe("SAFE");
});

import { expect, test } from "bun:test";
import { solve } from "./solver";
import { DEFAULT_POLICY } from "./fixture";

const C = 500n;
const D = 700000n;
const P = 190000n;
const targetBp = 10700n;

const bigBalances = { vETH: 100000n, vUSD: 10_000_000n };
const openPolicy = { ...DEFAULT_POLICY, max_deposit: 100000, max_repay_bp: 10000 };

test("resulting HF ≥ target+100 for chosen candidate (generous caps)", () => {
  const r = solve({
    C, D, P, targetBp, policy: openPolicy, balances: bigBalances,
    nowS: 0, startedS: 0,
  });
  expect(r.resultingHfBp).toBeGreaterThanOrEqual(targetBp + 100n);
});

test("respects caps and balances", () => {
  const policy = { ...DEFAULT_POLICY, max_deposit: 5, max_repay_bp: 100 };
  const balances = { vETH: 5n, vUSD: 5000n };
  const r = solve({
    C, D, P, targetBp: 12000n, policy, balances, nowS: 0, startedS: 0,
  });
  expect(r.dep).toBeLessThanOrEqual(5n);
  expect(r.rep).toBeLessThanOrEqual((D * 100n) / 10000n);
  expect(r.rep).toBeLessThanOrEqual(5000n);
});

test("deposit cheaper early, repay cheaper late", () => {
  const early = solve({
    C, D, P, targetBp, policy: openPolicy, balances: bigBalances,
    nowS: 0, startedS: 0, // f = 1
  });
  const late = solve({
    C, D, P, targetBp, policy: openPolicy, balances: bigBalances,
    nowS: DEFAULT_POLICY.t_est_s, startedS: 0, // f = 0.15
  });
  expect(early.kind).toBe("deposit");
  expect(late.kind).toBe("repay");
});

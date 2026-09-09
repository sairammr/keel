import { expect, test } from "bun:test";
import { hf100Of, hfBpOf } from "./hf";

test("hf100Of at P0 = 111", () => {
  expect(hf100Of(500n, 700000n, 200000n)).toBe(111n);
});

test("hfBpOf at P0 ≈ 11142/11143", () => {
  const bp = hfBpOf(500n, 700000n, 200000n);
  expect(bp === 11142n || bp === 11143n).toBe(true);
});

test("liquidation boundary at P=181300", () => {
  expect([100n, 101n]).toContain(hf100Of(500n, 700000n, 181300n));
});

test("D=0 sentinel", () => {
  expect(hfBpOf(500n, 0n, 200000n)).toBe(1_000_000n);
});

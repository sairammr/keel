import { expect, test } from "bun:test";
import { volTermBp } from "./vol";
import { DEFAULT_POLICY } from "./fixture";

test("flat prices → vol term decays monotonically toward 0", () => {
  const prices = Array(120).fill(200000n) as bigint[];
  let prev = Infinity;
  for (let r = 1; r < 120; r++) {
    const t = volTermBp(prices, r, DEFAULT_POLICY);
    expect(t).toBeLessThanOrEqual(prev);
    prev = t;
  }
  expect(volTermBp(prices, 119, DEFAULT_POLICY)).toBe(0);
});

test("6% jump hits vcap", () => {
  const prices = [200000n, 212000n];
  expect(volTermBp(prices, 1, DEFAULT_POLICY)).toBe(DEFAULT_POLICY.volcap_bp);
});

import { expect, test } from "bun:test";
import { jitterBpOf } from "./jitter";

const salt = new Uint8Array(32).fill(7);
const JMAX = 300;

test("deterministic", () => {
  expect(jitterBpOf(salt, 5, JMAX)).toBe(jitterBpOf(salt, 5, JMAX));
});

test("in [0, jmax)", () => {
  for (let r = 0; r < 1000; r++) {
    const j = jitterBpOf(salt, r, JMAX);
    expect(j).toBeGreaterThanOrEqual(0);
    expect(j).toBeLessThan(JMAX);
  }
});

test("different rounds differ", () => {
  expect(jitterBpOf(salt, 1, JMAX)).not.toBe(jitterBpOf(salt, 2, JMAX));
});

test("uniform-ish mean ≈ jmax/2 ± 10%", () => {
  let sum = 0;
  for (let r = 0; r < 1000; r++) sum += jitterBpOf(salt, r, JMAX);
  const mean = sum / 1000;
  expect(Math.abs(mean - JMAX / 2)).toBeLessThan(JMAX * 0.1);
});

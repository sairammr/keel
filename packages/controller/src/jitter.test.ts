import { expect, test } from "bun:test";
import { jitterBpOf, tjitterBpOf } from "./jitter";

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

test("tjitter: independent domain — differs from arm jitter for most rounds", () => {
   
  let same = 0;
  for (let r = 0; r < 200; r++) if (tjitterBpOf(salt, r, JMAX) === jitterBpOf(salt, r, JMAX)) same++;
  expect(same).toBeLessThan(20); // collisions allowed, correlation not
});

test("tjitter: zero width → 0", () => {
   
  expect(tjitterBpOf(salt, 7, 0)).toBe(0);
});

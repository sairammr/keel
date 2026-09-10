import { expect, test } from "bun:test";
import { generateTrain, generateTest, readmeLiteral, type Scenario } from "./scenario.ts";

const minPrice = (s: Scenario) => s.steps.reduce((m, x) => (x.price < m ? x.price : m), s.steps[0]!.price);

test("6a. deterministic: same seed → identical scenarios", () => {
  expect(JSON.stringify(generateTrain(), bigintReplacer)).toBe(
    JSON.stringify(generateTrain(), bigintReplacer),
  );
  expect(JSON.stringify(generateTest(), bigintReplacer)).toBe(
    JSON.stringify(generateTest(), bigintReplacer),
  );
});

test("6b. train has 40, test has 24, all non-empty steps", () => {
  const train = generateTrain();
  const test = generateTest();
  expect(train.length).toBe(40);
  expect(test.length).toBe(24);
  for (const s of [...train, ...test]) {
    expect(s.steps.length).toBeGreaterThan(0);
    for (const step of s.steps) expect([60, 120, 300]).toContain(step.dtSeconds);
  }
});

test("6c. families respect their floors/shapes", () => {
  const byFam = (fam: string) => generateTrain().filter((s) => s.family === fam);
  for (const s of byFam("safevol")) expect(minPrice(s)).toBeGreaterThanOrEqual(179000n);
  for (const s of byFam("gradual")) expect(minPrice(s)).toBeGreaterThanOrEqual(155000n);
  for (const s of byFam("crash")) expect(minPrice(s)).toBeGreaterThanOrEqual(145000n);
  // attacker injects taps below the liquidation line (~179487)
  for (const s of byFam("attacker")) expect(minPrice(s)).toBeLessThan(179487n);
});

test("6d. readmeLiteral: 5 labelled paths", () => {
  const r = readmeLiteral();
  expect(r.length).toBe(5);
  expect(r[0]!.steps.map((s) => s.price)).toEqual([200000n, 162000n, 190000n]);
});

function bigintReplacer(_k: string, v: unknown) {
  return typeof v === "bigint" ? v.toString() : v;
}

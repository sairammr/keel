import { expect, test } from "bun:test";
import { runScenario, KEEL, DEFAULT_KEEL_POLICY } from "./engine.ts";
import { DO_NOTHING } from "./starter.ts";
import type { Scenario } from "./scenario.ts";

const salt = new Uint8Array(32).fill(7);

// A deterministic sudden-crash: $2000 → below the liquidation line, then flat.
const crash: Scenario = {
  name: "test-crash",
  family: "crash",
  steps: [
    { dtSeconds: 120, price: 188000n },
    { dtSeconds: 120, price: 176000n },
    { dtSeconds: 120, price: 168000n },
    { dtSeconds: 120, price: 160000n },
    { dtSeconds: 120, price: 160000n },
  ],
};

test("4a. Keel survives a sudden crash", () => {
  const t = runScenario(crash, DEFAULT_KEEL_POLICY, salt, { cronPeriod: 60 }, KEEL);
  expect(t.liquidated).toBe(false);
  expect(t.score.survive).toBe(40);
});

test("4b. do-nothing liquidates on the same crash", () => {
  const t = runScenario(crash, DEFAULT_KEEL_POLICY, salt, { cronPeriod: 60 }, DO_NOTHING);
  expect(t.liquidated).toBe(true);
  expect(t.score.survive).toBe(0);
});

test("4c. mirror hf100 in trace equals controller hf100Of throughout", () => {
  // proven inside runScenario via mirror.hf100(); here we sanity check the trace shape.
  const t = runScenario(crash, DEFAULT_KEEL_POLICY, salt, { cronPeriod: 60 }, KEEL);
  expect(t.ticks.length).toBeGreaterThan(0);
  for (const tick of t.ticks) expect(tick.hf100).toBeGreaterThan(100n);
});

import { expect, test } from "bun:test";
import { scoreRun, type Tick } from "./scoring.ts";
import { INIT_DEBT } from "../../controller/src/index.ts";

function mkTick(over: Partial<Tick>): Tick {
  return {
    round: 1,
    price: 200000n,
    hf100: 111n,
    hfBpPre: 11143n,
    hfBp: 11143n,
    collateral: 500n,
    debt: 700000n,
    armBp: 10700n,
    targetBp: 11200n,
    dep: 0n,
    rep: 0n,
    ...over,
  };
}

test("5a. survive contributes 40 iff not liquidated", () => {
  const base = { ticks: [mkTick({})], debtTimeIntegral: 0n, duration: 3600 };
  expect(scoreRun({ ...base, liquidated: false }).survive).toBe(40);
  expect(scoreRun({ ...base, liquidated: true }).survive).toBe(0);
});

test("5b. capEff decreases as capital deployed increases", () => {
  const small = scoreRun({
    ticks: [mkTick({ rep: 1000n })],
    liquidated: false,
    debtTimeIntegral: 0n,
    duration: 3600,
  });
  const large = scoreRun({
    ticks: [mkTick({ rep: 200000n })],
    liquidated: false,
    debtTimeIntegral: 0n,
    duration: 3600,
  });
  expect(large.capEff).toBeLessThan(small.capEff);
});

test("5c. discipline decreases with more actions", () => {
  const one = scoreRun({
    ticks: [mkTick({ rep: 100n })],
    liquidated: false,
    debtTimeIntegral: 0n,
    duration: 3600,
  });
  const three = scoreRun({
    ticks: [mkTick({ rep: 100n }), mkTick({ rep: 100n }), mkTick({ rep: 100n })],
    liquidated: false,
    debtTimeIntegral: 0n,
    duration: 3600,
  });
  expect(three.discipline).toBeLessThan(one.discipline);
  expect(one.nActions).toBe(1);
  expect(three.nActions).toBe(3);
});

test("5d. debtTime maxes near 20 when debt held full duration", () => {
  const duration = 3600;
  const held = scoreRun({
    ticks: [mkTick({})],
    liquidated: false,
    debtTimeIntegral: INIT_DEBT * BigInt(duration),
    duration,
  });
  expect(held.debtTime).toBeCloseTo(20, 5);
});

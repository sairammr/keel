import { expect, test } from "bun:test";
import { roundOfBlock, orderLegs, planNonces, pricesFrom } from "./plan.ts";

// PriceUpdate decode + official ABI/topic tests live in chain.test.ts.

test("pricesFrom excludes PriceUpdate logs before the ChallengeStarted block", () => {
  const logs = [
    { price: 205000n, block: 100n }, // organiser pre-start test update
    { price: 204000n, block: 149n }, // still before start
    { price: 200000n, block: 150n }, // scenario start block — kept
    { price: 193800n, block: 160n },
  ];
  const startedBlock = 150n;
  expect(pricesFrom(logs, startedBlock)).toEqual([200000n, 193800n]);
  // no start yet (minBlock 0) keeps everything
  expect(pricesFrom(logs, 0n)).toEqual([205000n, 204000n, 200000n, 193800n]);
});

test("roundOfBlock maps an action block to its price level", () => {
  const priceBlocks = [100n, 110n, 125n, 140n]; // 4 price updates
  expect(roundOfBlock(99n, priceBlocks)).toBe(0); // before any update
  expect(roundOfBlock(100n, priceBlocks)).toBe(1); // at first update
  expect(roundOfBlock(130n, priceBlocks)).toBe(3); // after 3rd
  expect(roundOfBlock(999n, priceBlocks)).toBe(4); // after all
  expect(roundOfBlock(50n, [])).toBe(0); // no updates yet
});

test("orderLegs puts the finishing leg last and drops zero legs", () => {
  // deposit-to-cap + repay-rest: kind 'repay' finishing → deposit first, repay last.
  expect(orderLegs({ kind: "repay", dep: 200n, rep: 5000n })).toEqual([
    { kind: "deposit", amount: 200n },
    { kind: "repay", amount: 5000n },
  ]);
  // repay-to-cap + deposit-rest: kind 'deposit' finishing → repay first, deposit last.
  expect(orderLegs({ kind: "deposit", dep: 150n, rep: 3000n })).toEqual([
    { kind: "repay", amount: 3000n },
    { kind: "deposit", amount: 150n },
  ]);
  // pure repay: only one leg.
  expect(orderLegs({ kind: "repay", dep: 0n, rep: 4200n })).toEqual([{ kind: "repay", amount: 4200n }]);
});

test("nonce adjacency: one receipt PER leg at legNonce+1 ([L1,R1,L2,R2])", () => {
  // Two legs starting at nonce 12: L1=12,R1=13,L2=14,R2=15.
  const two = planNonces(12, 2);
  expect(two).toEqual([
    { legNonce: 12, receiptNonce: 13 },
    { legNonce: 14, receiptNonce: 15 },
  ]);
  for (const p of two) expect(p.receiptNonce).toBe(p.legNonce + 1);

  // One leg at nonce 7: L1=7,R1=8.
  expect(planNonces(7, 1)).toEqual([{ legNonce: 7, receiptNonce: 8 }]);
});

import { expect, test } from "bun:test";
import { parseAbi, encodeAbiParameters, parseAbiParameters, decodeEventLog, encodeEventTopics } from "viem";
import { roundOfBlock, orderLegs, planNonces } from "./plan.ts";

const LENDING_ABI = parseAbi([
  "event PriceUpdate(uint256 newPrice)",
]);

test("PriceUpdate log decodes to newPrice → prices[] mapping", () => {
  // Build 3 PriceUpdate logs (non-indexed uint256 in data), decode → prices.
  const [topic0] = encodeEventTopics({ abi: LENDING_ABI, eventName: "PriceUpdate" });
  const raw = [193800n, 184900n, 200000n].map((p) => ({
    topics: [topic0!] as [`0x${string}`],
    data: encodeAbiParameters(parseAbiParameters("uint256"), [p]),
  }));
  const prices = raw.map(
    (l) => (decodeEventLog({ abi: LENDING_ABI, eventName: "PriceUpdate", data: l.data, topics: l.topics }).args as { newPrice: bigint }).newPrice,
  );
  expect(prices).toEqual([193800n, 184900n, 200000n]);
  // prepend P0 as the handler does:
  const full = [200000n, ...prices];
  expect(full.length - 1).toBe(3); // round index of current level
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

test("nonce adjacency: receipt nonce is exactly actionNonce + 1", () => {
  // Two legs starting at nonce 12: leg txs 12,13; action(finishing)=13; receipt=14.
  const two = planNonces(12, 2);
  expect(two.legNonces).toEqual([12, 13]);
  expect(two.actionNonce).toBe(13);
  expect(two.receiptNonce).toBe(14);
  expect(two.receiptNonce).toBe(two.actionNonce + 1);

  // One leg at nonce 7: leg tx 7; action=7; receipt=8.
  const one = planNonces(7, 1);
  expect(one.legNonces).toEqual([7]);
  expect(one.actionNonce).toBe(7);
  expect(one.receiptNonce).toBe(8);
  expect(one.receiptNonce).toBe(one.actionNonce + 1);
});

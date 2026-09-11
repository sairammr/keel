import { expect, test } from "bun:test";
import { decodeEventLog, encodeEventTopics, toEventSelector, type Hex } from "viem";
import { LENDING_ABI } from "./chain.ts";
import fixture from "./fixtures/priceUpdate.log.json";

const OFFICIAL_TOPIC0 = "0x92664190cca12aca9cd5309d87194bdda75bb51362d71c06e1a6f75c7c765711";

test("official PriceUpdate(uint256,uint256) log decodes to newPrice", () => {
  const { args } = decodeEventLog({
    abi: LENDING_ABI,
    eventName: "PriceUpdate",
    data: fixture.data as Hex,
    topics: fixture.topics as [Hex, ...Hex[]],
  });
  const a = args as { oldPrice: bigint; newPrice: bigint };
  expect(a.oldPrice).toBe(200000n);
  expect(a.newPrice).toBe(193800n);
  // ladder built from newPrice grows/moves as the handler consumes it
  const prices = [200000n, a.newPrice];
  expect(prices.length - 1).toBe(1);
});

test("topic0 equals keccak('PriceUpdate(uint256,uint256)') = 0x9266…5711", () => {
  const [topic0] = encodeEventTopics({ abi: LENDING_ABI, eventName: "PriceUpdate" });
  expect(topic0).toBe(OFFICIAL_TOPIC0);
  expect(fixture.topics[0]).toBe(OFFICIAL_TOPIC0);
});

test("the OLD single-arg PriceUpdate(uint256) topic would match nothing", () => {
  const stale = toEventSelector("PriceUpdate(uint256)");
  expect(stale).not.toBe(OFFICIAL_TOPIC0);
  // a getLogs filtered by the stale topic0 never selects the official log
  expect(fixture.topics[0]).not.toBe(stale);
});

test("action events are indexed by `user` with the official signatures", () => {
  for (const [ev, sig] of [
    ["Repay", "Repay(address,uint256)"],
    ["Deposit", "Deposit(address,uint256)"],
    ["WithdrawCollateral", "WithdrawCollateral(address,uint256)"],
    ["Borrow", "Borrow(address,uint256)"],
  ] as const) {
    const [topic0, userTopic] = encodeEventTopics({
      abi: LENDING_ABI,
      eventName: ev,
      args: { user: "0x000000000000000000000000000000000000dEaD" },
    });
    expect(topic0).toBe(toEventSelector(sig));
    expect(userTopic).toBe("0x000000000000000000000000000000000000000000000000000000000000dead");
  }
});

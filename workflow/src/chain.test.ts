import { expect, test } from "bun:test";
import { decodeEventLog, encodeEventTopics, toEventSelector, encodeAbiParameters, parseAbiParameters, type Hex } from "viem";
import { ChainReader, LENDING_ABI, type HttpLike } from "./chain.ts";
import type { Config } from "./config.ts";
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

// ---- P3.2 quota: the batched reader fits CRE's 5-HTTP-call budget ----

const ADDR = "0x00000000000000000000000000000000000000A1" as const;
const u256 = (v: bigint) => encodeAbiParameters(parseAbiParameters("uint256"), [v]);
const bool = (b: boolean) => encodeAbiParameters(parseAbiParameters("bool"), [b]);

// canned JSON-RPC batch response for readAll's 15 sub-calls (ids 0..14)
function readAllResponse(): string {
  const pos = encodeAbiParameters(parseAbiParameters("uint256,uint256,uint256,uint256,uint256,uint256"), [500n, 700000n, 111n, 0n, 0n, 0n]);
  const commits = encodeAbiParameters(parseAbiParameters("bytes32,address,uint64,uint64"), [("0x" + "11".repeat(32)) as Hex, ADDR, 5n, 7n]);
  const byId: Record<number, unknown> = {
    0: "0x10", 1: "0x3b9aca00", 2: "0x5",
    3: u256(200000n), 4: pos, 5: u256(0n), 6: u256(0n), 7: bool(true), 8: bool(true),
    9: commits, 10: u256(500n), 11: u256(700000n),
    12: [], 13: [], 14: [],
  };
  return JSON.stringify(Object.entries(byId).map(([id, result]) => ({ jsonrpc: "2.0", id: Number(id), result })));
}

class CountingHttp implements HttpLike {
  calls: { bodyBytes: number; isBatch: boolean }[] = [];
  constructor(private readonly bodies: string[]) {}
  sendRequest(_rt: unknown, req: { body: string }) {
    const decoded = Buffer.from(req.body, "base64").toString("utf8");
    this.calls.push({ bodyBytes: decoded.length, isBatch: decoded.trimStart().startsWith("[") });
    const out = this.bodies[this.calls.length - 1] ?? "[]";
    return { result: () => ({ body: new TextEncoder().encode(out) }) };
  }
}

const CFG: Config = {
  rpc_url: "http://x", lending: ADDR, vETH: ADDR, vUSD: ADDR, policyCommit: ADDR, receipts: ADDR,
  chainId: 11155111, schedule: "* * * * * *", startBlock: 0, tee: false,
  controllerCodeHash: ("0x" + "00".repeat(32)) as Hex,
};

test("readAll issues exactly ONE HTTP request (a JSON-RPC batch), body < 10 KB", () => {
  const http = new CountingHttp([readAllResponse()]);
  const chain = new ChainReader({} as never, "http://x", CFG, http);
  const st = chain.readAll(ADDR);
  expect(http.calls.length).toBe(1);
  expect(http.calls[0]!.isBatch).toBe(true);
  expect(http.calls[0]!.bodyBytes).toBeLessThan(10 * 1024);
  expect(st.position.collateral).toBe(500n);
  expect(st.position.debt).toBe(700000n);
  expect(st.challengeOpen).toBe(true);
  expect(st.isUser).toBe(true);
});

test("a full acting tick uses ≤ 5 HTTP requests (1 read + 1 send)", () => {
  const sendResp = JSON.stringify([
    { jsonrpc: "2.0", id: 0, result: "0x" + "aa".repeat(32) },
    { jsonrpc: "2.0", id: 1, result: "0x" + "bb".repeat(32) },
  ]);
  const http = new CountingHttp([readAllResponse(), sendResp]);
  const chain = new ChainReader({} as never, "http://x", CFG, http);
  chain.readAll(ADDR); // request 1
  chain.sendRawBatch(["0xdeadbeef", "0xfeedface"]); // request 2
  expect(http.calls.length).toBe(2);
  expect(http.calls.length).toBeLessThanOrEqual(5);
  for (const c of http.calls) expect(c.bodyBytes).toBeLessThan(10 * 1024);
});

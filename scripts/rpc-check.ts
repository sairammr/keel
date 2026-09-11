#!/usr/bin/env bun
// Deploy-checklist gate: does this RPC serve the exact full-range eth_getLogs the handler issues?
// Public RPCs cap eth_getLogs at 50 000 blocks; the private keel_rpc_url must not.
//   bun run rpc-check --rpc <url> --from <startBlock> [--lending 0x…]
// Exits 0 if the PriceUpdate scan from --from to latest succeeds, 1 otherwise.

const PRICE_UPDATE_TOPIC0 = "0x92664190cca12aca9cd5309d87194bdda75bb51362d71c06e1a6f75c7c765711";
const OFFICIAL_LENDING = "0x88574e7Cc0027afd04951daa09B64d4441931ba1";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const rpc = arg("rpc");
const from = arg("from");
const lending = arg("lending") ?? OFFICIAL_LENDING;
if (!rpc || from === undefined) {
  console.error("usage: bun run rpc-check --rpc <url> --from <startBlock> [--lending 0x…]");
  process.exit(2);
}

const body = {
  jsonrpc: "2.0",
  id: 1,
  method: "eth_getLogs",
  params: [{ address: lending, topics: [PRICE_UPDATE_TOPIC0], fromBlock: `0x${Number(from).toString(16)}`, toBlock: "latest" }],
};

const res = await fetch(rpc, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const json = (await res.json()) as { result?: unknown[]; error?: { message: string } };
if (json.error) {
  console.error(`FAIL: eth_getLogs from ${from} rejected: ${json.error.message}`);
  process.exit(1);
}
console.log(`OK: eth_getLogs ${from}→latest served ${json.result?.length ?? 0} PriceUpdate logs`);
process.exit(0);

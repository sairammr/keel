#!/usr/bin/env bun
// P1.4 fidelity check: is our verbatim ChallengeLending copy byte-for-byte the deployed official one?
// Compares runtime (deployed) bytecode with the CBOR metadata trailer stripped from both — the
// trailer is a hash of the source layout (file paths, comments) and legitimately differs between a
// local build and the organisers' build; everything before it is the actual EVM code.
//
//   FOUNDRY_PROFILE=official forge build --skip test --skip script   # produces out-official/…
//   bun run script/fidelity.ts [--rpc <url>]
//
// Prints MATCH (provably faithful) or a diff summary; exits 0 on MATCH or metadata-only diff, 1 else.
import { keccak256, type Hex } from "viem";
import artifact from "../out-official/ChallengeLending.sol/ChallengeLending.json";

const OFFICIAL = "0x88574e7Cc0027afd04951daa09B64d4441931ba1";
const rpcIdx = process.argv.indexOf("--rpc");
const RPC = rpcIdx >= 0 ? process.argv[rpcIdx + 1]! : "https://ethereum-sepolia-rpc.publicnode.com";

/** Strip the Solidity CBOR metadata trailer: last 2 bytes are its length L; drop L+2 bytes. */
function stripMetadata(hex: string): string {
  const h = hex.replace(/^0x/, "").toLowerCase();
  if (h.length < 4) return h;
  const len = parseInt(h.slice(-4), 16); // bytes
  const strip = (len + 2) * 2; // hex chars
  return strip < h.length ? h.slice(0, h.length - strip) : h;
}

const localFull = (artifact as { deployedBytecode: { object: string } }).deployedBytecode.object;

const res = await fetch(RPC, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getCode", params: [OFFICIAL, "latest"] }),
});
const onchainFull = ((await res.json()) as { result: string }).result;

const local = stripMetadata(localFull);
const onchain = stripMetadata(onchainFull);
const localHash = keccak256(`0x${local}` as Hex);
const onchainHash = keccak256(`0x${onchain}` as Hex);

console.log(`local  (stripped): ${local.length / 2} bytes  keccak ${localHash}`);
console.log(`onchain(stripped): ${onchain.length / 2} bytes  keccak ${onchainHash}`);

if (localHash === onchainHash) {
  console.log("MATCH — local ChallengeLending is byte-for-byte the deployed official contract.");
  process.exit(0);
}

// Not identical: was it only the metadata trailer (i.e. full bytecodes differ but stripped parts equal)?
const localMetaLen = localFull.replace(/^0x/, "").length - local.length;
const onchainMetaLen = onchainFull.replace(/^0x/, "").length - onchain.length;
console.log(`DIFF — stripped code differs (metadata trailers: local ${localMetaLen / 2}B, onchain ${onchainMetaLen / 2}B).`);
// find first differing nibble for a hint
const n = Math.min(local.length, onchain.length);
let i = 0;
while (i < n && local[i] === onchain[i]) i++;
console.log(`first divergence at nibble ${i} (of ${local.length}/${onchain.length}); local=${local.slice(i, i + 16)} onchain=${onchain.slice(i, i + 16)}`);
process.exit(1);

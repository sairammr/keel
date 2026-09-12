// One-shot production commit-before-start on the OFFICIAL stack.
// Usage: KEEL_PROD_KEY=0x… KEEL_PROD_SALT=0x… bun run scripts/commit-prod.ts
// Salt must be fresh (openssl rand -hex 32) and never committed.
import { createPublicClient, createWalletClient, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import { commitmentOf } from "../packages/controller/src";
import { DEFAULT_POLICY } from "../packages/controller/src/fixture";
import cfg from "../workflow/config.production.json";

const key = process.env.KEEL_PROD_KEY as Hex;
const salt = process.env.KEEL_PROD_SALT as Hex;
if (!key || !salt || salt.length !== 66) throw new Error("KEEL_PROD_KEY and 32-byte KEEL_PROD_SALT required");

const policy = { ...DEFAULT_POLICY, tjitter_bp: 300 };
const { commit, signer, policyHash } = commitmentOf(policy, salt, cfg.controllerCodeHash as Hex);

const account = privateKeyToAccount(key);
const pub = createPublicClient({ chain: sepolia, transport: http(cfg.rpc_url) });
const wallet = createWalletClient({ account, chain: sepolia, transport: http(cfg.rpc_url) });

const abi = [
  { type: "function", name: "commit", inputs: [{ type: "bytes32" }, { type: "address" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "commits", inputs: [{ type: "address" }], outputs: [{ type: "tuple", components: [{ type: "bytes32", name: "hash" }, { type: "address", name: "signer" }, { type: "uint64", name: "blockNumber" }, { type: "uint64", name: "timestamp" }] }], stateMutability: "view" },
] as const;

const existing = await pub.readContract({ address: cfg.policyCommit as Hex, abi, functionName: "commits", args: [account.address] });
if (existing.hash !== "0x" + "0".repeat(64)) {
  console.log("already committed:", existing.hash, "block", existing.blockNumber.toString());
  process.exit(0);
}
const tx = await wallet.writeContract({ address: cfg.policyCommit as Hex, abi, functionName: "commit", args: [commit, signer] });
const rc = await pub.waitForTransactionReceipt({ hash: tx });
console.log(JSON.stringify({ tx, block: rc.blockNumber.toString(), status: rc.status, commit, signer, policyHash }, null, 2));

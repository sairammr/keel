import { expect, test } from "bun:test";
import { encodeAbiParameters, parseAbiParameters, bytesToHex } from "viem";
import { parsePolicy, parsePackedPolicy, ALL_SECRET_IDS, type SecretMap } from "./policy.ts";
import { encodePolicyBytes, type Policy } from "../../packages/controller/src/index.ts";

const POLICY: Policy = {
  base_bp: 10700, kvol_bp: 10000, volcap_bp: 200, jitter_bp: 300, tmax_bp: 11100,
  emerg_bp: 10300, buffer_bp: 500, target_cap_bp: 12500, halflife: 4, cooldown: 1,
  max_repay_bp: 3000, max_deposit: 250, t_est_s: 10800,
};
const SALT = bytesToHex(new Uint8Array(32).fill(7));
const FULL: SecretMap = {
  keel_policy: { value: JSON.stringify(POLICY) },
  keel_salt: { value: SALT },
  keel_rpc_url: { value: "https://rpc.example/priv" },
  liquidation_private_key: { value: "0x" + "11".repeat(32) },
};

test("handler requests exactly 4 secrets (≤ 5 quota)", () => {
  expect(ALL_SECRET_IDS.length).toBe(4);
  expect([...ALL_SECRET_IDS]).toEqual(["keel_policy", "keel_salt", "keel_rpc_url", "liquidation_private_key"]);
});

test("parsePolicy round-trips a full secret set", () => {
  const { policy, salt, rpcUrl, privateKey } = parsePolicy(FULL);
  expect(policy).toEqual(POLICY);
  expect(salt.length).toBe(32);
  expect(rpcUrl).toBe("https://rpc.example/priv");
  expect(privateKey).toBe(("0x" + "11".repeat(32)) as `0x${string}`);
  const codeHash = ("0x" + "00".repeat(32)) as `0x${string}`;
  expect(encodePolicyBytes(policy, codeHash)).toBe(encodePolicyBytes(POLICY, codeHash));
});

test("parsePolicy normalizes a private key without 0x prefix", () => {
  const { privateKey } = parsePolicy({ ...FULL, liquidation_private_key: { value: "22".repeat(32) } });
  expect(privateKey).toBe(("0x" + "22".repeat(32)) as `0x${string}`);
});

test("parsePolicy throws on a missing secret", () => {
  const missing = { ...FULL };
  delete missing.keel_policy;
  expect(() => parsePolicy(missing)).toThrow(/keel_policy/);
});

test("parsePolicy throws when salt is not 32 bytes", () => {
  expect(() => parsePolicy({ ...FULL, keel_salt: { value: "0x1234" } })).toThrow(/32 bytes/);
});

test("parsePackedPolicy rejects an unknown field", () => {
  const bad = JSON.stringify({ ...POLICY, sneaky: 1 });
  expect(() => parsePackedPolicy(bad)).toThrow(/unknown field: sneaky/);
});

test("parsePackedPolicy rejects a non-integer field", () => {
  const bad = JSON.stringify({ ...POLICY, base_bp: 1.5 });
  expect(() => parsePackedPolicy(bad)).toThrow(/base_bp must be an integer/);
});

test("parsePackedPolicy rejects a missing field", () => {
  const { t_est_s, ...partial } = POLICY;
  expect(() => parsePackedPolicy(JSON.stringify(partial))).toThrow(/t_est_s must be an integer/);
});

// getUserPosition decodes positionally; we only ever trust collateral/debt (hf is recomputed).
test("positional getUserPosition decode extracts collateral/debt", async () => {
  const { decodeFunctionResult, parseAbi } = await import("viem");
  const abi = parseAbi([
    "function getUserPosition(address) view returns (uint256 collateral,uint256 debt,uint256 hf,uint256 numOperations,uint256 lastUpdateTime,uint256 cumulativeDebtTime)",
  ]);
  const encoded = encodeAbiParameters(
    parseAbiParameters("uint256,uint256,uint256,uint256,uint256,uint256"),
    [500n, 700000n, 111n, 3n, 123n, 456n],
  );
  const res = decodeFunctionResult({ abi, functionName: "getUserPosition", data: encoded }) as readonly bigint[];
  expect(res[0]).toBe(500n);
  expect(res[1]).toBe(700000n);
});

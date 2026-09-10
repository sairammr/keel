import { expect, test } from "bun:test";
import { encodeAbiParameters, parseAbiParameters, bytesToHex } from "viem";
import { parsePolicy, type SecretMap } from "./policy.ts";
import { encodePolicyBytes, type Policy } from "../../packages/controller/src/index.ts";

// A full secret set (values are test-only, not real).
const SALT = bytesToHex(new Uint8Array(32).fill(7));
const FULL: SecretMap = {
  keel_base_bp: { value: "10700" },
  keel_kvol_bp: { value: "10000" },
  keel_volcap_bp: { value: "200" },
  keel_jitter_bp: { value: "300" },
  keel_tmax_bp: { value: "11100" },
  keel_emerg_bp: { value: "10300" },
  keel_buffer_bp: { value: "500" },
  keel_target_cap_bp: { value: "12500" },
  keel_halflife: { value: "4" },
  keel_cooldown: { value: "1" },
  keel_max_repay_bp: { value: "3000" },
  keel_max_deposit: { value: "250" },
  keel_t_est_s: { value: "10800" },
  keel_salt: { value: SALT },
  keel_rpc_url: { value: "https://rpc.example/priv" },
  liquidation_private_key: { value: "0x" + "11".repeat(32) },
};

test("parsePolicy round-trips a full secret set", () => {
  const { policy, salt, rpcUrl, privateKey } = parsePolicy(FULL);
  const expected: Policy = {
    base_bp: 10700, kvol_bp: 10000, volcap_bp: 200, jitter_bp: 300, tmax_bp: 11100,
    emerg_bp: 10300, buffer_bp: 500, target_cap_bp: 12500, halflife: 4, cooldown: 1,
    max_repay_bp: 3000, max_deposit: 250, t_est_s: 10800,
  };
  expect(policy).toEqual(expected);
  expect(salt.length).toBe(32);
  expect(rpcUrl).toBe("https://rpc.example/priv");
  expect(privateKey).toBe(("0x" + "11".repeat(32)) as `0x${string}`);
  // policy encodes deterministically for the commitment (binds every field).
  const codeHash = ("0x" + "00".repeat(32)) as `0x${string}`;
  expect(encodePolicyBytes(policy, codeHash)).toBe(encodePolicyBytes(expected, codeHash));
});

test("parsePolicy normalizes a private key without 0x prefix", () => {
  const { privateKey } = parsePolicy({ ...FULL, liquidation_private_key: { value: "22".repeat(32) } });
  expect(privateKey).toBe(("0x" + "22".repeat(32)) as `0x${string}`);
});

test("parsePolicy throws on a missing secret", () => {
  const missing = { ...FULL };
  delete missing.keel_base_bp;
  expect(() => parsePolicy(missing)).toThrow(/keel_base_bp/);
});

test("parsePolicy throws when salt is not 32 bytes", () => {
  expect(() => parsePolicy({ ...FULL, keel_salt: { value: "0x1234" } })).toThrow(/32 bytes/);
});

// Sanity: the 6-field getUserPosition tuple decodes collateral/debt positionally.
test("positional getUserPosition decode extracts collateral/debt", async () => {
  const { decodeFunctionResult, parseAbi } = await import("viem");
  const abi = parseAbi([
    "function getUserPosition(address) view returns (uint256 collateral,uint256 debt,uint256 hf,uint256 numOperations,uint256 lastUpdateTime,uint256 cumulativeDebtTime)",
  ]);
  // encode a real 6-tuple: C=500, D=700000, hf=111 (WRONG on purpose), + 3 tail fields.
  const encoded = encodeAbiParameters(
    parseAbiParameters("uint256,uint256,uint256,uint256,uint256,uint256"),
    [500n, 700000n, 111n, 3n, 123n, 456n],
  );
  const res = decodeFunctionResult({ abi, functionName: "getUserPosition", data: encoded }) as readonly bigint[];
  expect(res[0]).toBe(500n); // collateral
  expect(res[1]).toBe(700000n); // debt
  // we never trust res[2] (hf) — recomputed from C/D/price elsewhere.
});

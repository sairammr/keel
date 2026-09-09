import { encodeAbiParameters, encodePacked, keccak256, toHex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { secp256k1 } from "@noble/curves/secp256k1";
import type { Policy } from "./types";

const POLICY_ABI = [
  { type: "uint16" }, // version = 1
  { type: "uint32" }, // base_bp
  { type: "uint32" }, // kvol_bp
  { type: "uint32" }, // volcap_bp
  { type: "uint32" }, // jitter_bp
  { type: "uint32" }, // tmax_bp
  { type: "uint32" }, // emerg_bp
  { type: "uint32" }, // buffer_bp
  { type: "uint32" }, // target_cap_bp
  { type: "uint32" }, // halflife
  { type: "uint32" }, // cooldown
  { type: "uint32" }, // max_repay_bp
  { type: "uint32" }, // max_deposit
  { type: "uint32" }, // t_est_s
  { type: "bytes32" }, // controllerCodeHash
] as const;

export function encodePolicyBytes(
  policy: Policy,
  controllerCodeHash: `0x${string}`,
): `0x${string}` {
  return encodeAbiParameters(POLICY_ABI, [
    1,
    policy.base_bp,
    policy.kvol_bp,
    policy.volcap_bp,
    policy.jitter_bp,
    policy.tmax_bp,
    policy.emerg_bp,
    policy.buffer_bp,
    policy.target_cap_bp,
    policy.halflife,
    policy.cooldown,
    policy.max_repay_bp,
    policy.max_deposit,
    policy.t_est_s,
    controllerCodeHash,
  ]);
}

export function policyHashOf(policyBytes: `0x${string}`): `0x${string}` {
  return keccak256(policyBytes);
}

export function commitmentOf(
  policy: Policy,
  salt: `0x${string}`,
  controllerCodeHash: `0x${string}`,
): {
  policyHash: `0x${string}`;
  commit: `0x${string}`;
  receiptKey: `0x${string}`;
  signer: `0x${string}`;
} {
  const policyHash = policyHashOf(encodePolicyBytes(policy, controllerCodeHash));
  const commit = keccak256(encodePacked(["bytes32", "bytes32"], [policyHash, salt]));

  const raw = keccak256(encodePacked(["bytes32", "string"], [salt, "keel/receipt/v1"]));
  const reduced = BigInt(raw) % secp256k1.CURVE.n;
  if (reduced === 0n) throw new Error("receiptKey reduced to zero");
  const receiptKey = toHex(reduced, { size: 32 });

  const signer = privateKeyToAccount(receiptKey).address;
  return { policyHash, commit, receiptKey, signer };
}

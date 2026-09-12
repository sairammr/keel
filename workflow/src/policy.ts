import { hexToBytes } from "viem";
import type { Policy } from "../../packages/controller/src/index.ts";

// CRE quota: ≤ 5 secrets fetched per execution (2 KB each). So the 13 policy parameters are packed
// into ONE JSON secret `keel_policy` (< 2 KB) instead of 13 separate ids. Total = 4 secrets.
export const POLICY_SECRET_ID = "keel_policy";
export const SALT_SECRET_ID = "keel_salt";
export const RPC_SECRET_ID = "keel_rpc_url";
export const KEY_SECRET_ID = "liquidation_private_key";

/** The four secret ids the handler requests each tick (≤ 5 quota). */
export const ALL_SECRET_IDS = [POLICY_SECRET_ID, SALT_SECRET_ID, RPC_SECRET_ID, KEY_SECRET_ID] as const;

/** Minimal shape of a resolved secret ({ value } is all we read). */
export type SecretMap = Record<string, { value: string } | undefined>;

// The exact integer fields a Policy must carry. Used to validate keel_policy and reject anything else.
const POLICY_FIELDS = [
  "base_bp", "kvol_bp", "volcap_bp", "jitter_bp", "tmax_bp", "emerg_bp", "buffer_bp",
  "target_cap_bp", "halflife", "cooldown", "max_repay_bp", "max_deposit", "t_est_s",
] as const;

function req(secrets: SecretMap, id: string): string {
  const v = secrets[id]?.value;
  if (v === undefined || v === "") throw new Error(`missing secret: ${id}`);
  return v;
}

/** Parse + validate the packed keel_policy JSON: every field present, integer, no unknown keys. */
export function parsePackedPolicy(json: string): Policy {
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(json) as Record<string, unknown>;
  } catch {
    throw new Error("keel_policy is not valid JSON");
  }
  if (typeof obj !== "object" || obj === null) throw new Error("keel_policy must be a JSON object");

  const known = new Set<string>([...POLICY_FIELDS, "tjitter_bp"]);
  for (const k of Object.keys(obj)) if (!known.has(k)) throw new Error(`keel_policy has unknown field: ${k}`);

  const out = {} as Record<string, number>;
  for (const f of POLICY_FIELDS) {
    const v = obj[f];
    if (typeof v !== "number" || !Number.isInteger(v)) throw new Error(`keel_policy.${f} must be an integer`);
    out[f] = v;
  }
  // tjitter_bp optional (v2 restore-target jitter); absent/0 = legacy v1 encoding.
  const tj = obj["tjitter_bp"];
  if (tj !== undefined) {
    if (typeof tj !== "number" || !Number.isInteger(tj)) throw new Error("keel_policy.tjitter_bp must be an integer");
    out["tjitter_bp"] = tj;
  }
  return out as unknown as Policy;
}

export interface ParsedSecrets {
  policy: Policy;
  salt: Uint8Array; // 32 bytes
  rpcUrl?: string; // optional private RPC; falls back to config.rpc_url
  privateKey: `0x${string}`;
}

/** Build a Policy + operational secrets from getSecrets() output. No defaults — all from Vault. */
export function parsePolicy(secrets: SecretMap): ParsedSecrets {
  const policy = parsePackedPolicy(req(secrets, POLICY_SECRET_ID));

  const salt = hexToBytes(req(secrets, SALT_SECRET_ID) as `0x${string}`);
  if (salt.length !== 32) throw new Error("keel_salt must be 32 bytes");

  const rpcRaw = secrets[RPC_SECRET_ID]?.value;
  const key = req(secrets, KEY_SECRET_ID);

  return {
    policy,
    salt,
    rpcUrl: rpcRaw && rpcRaw !== "" ? rpcRaw : undefined,
    privateKey: (key.startsWith("0x") ? key : `0x${key}`) as `0x${string}`,
  };
}

import { hexToBytes } from "viem";
import type { Policy } from "../../packages/controller/src/index.ts";

// Secret ids (must match secrets.yaml / Vault). NO values live here or in config.
export const POLICY_SECRET_IDS = [
  "keel_base_bp",
  "keel_kvol_bp",
  "keel_volcap_bp",
  "keel_jitter_bp",
  "keel_tmax_bp",
  "keel_emerg_bp",
  "keel_buffer_bp",
  "keel_target_cap_bp",
  "keel_halflife",
  "keel_cooldown",
  "keel_max_repay_bp",
  "keel_max_deposit",
  "keel_t_est_s",
] as const;

export const SALT_SECRET_ID = "keel_salt";
export const RPC_SECRET_ID = "keel_rpc_url";
export const KEY_SECRET_ID = "liquidation_private_key";

/** All secret ids the handler requests each tick. */
export const ALL_SECRET_IDS = [
  ...POLICY_SECRET_IDS,
  SALT_SECRET_ID,
  RPC_SECRET_ID,
  KEY_SECRET_ID,
] as const;

/** Minimal shape of a resolved secret ({ value } is all we read). */
export type SecretMap = Record<string, { value: string } | undefined>;

function req(secrets: SecretMap, id: string): string {
  const v = secrets[id]?.value;
  if (v === undefined || v === "") throw new Error(`missing secret: ${id}`);
  return v;
}

function num(secrets: SecretMap, id: string): number {
  const raw = req(secrets, id);
  const n = Number(raw);
  if (!Number.isInteger(n)) throw new Error(`secret ${id} not an integer: got non-integer`);
  return n;
}

export interface ParsedSecrets {
  policy: Policy;
  salt: Uint8Array; // 32 bytes
  rpcUrl?: string; // optional private RPC; falls back to config.rpc_url
  privateKey: `0x${string}`;
}

/** Build a Policy + operational secrets from getSecrets() output. No defaults — all from Vault. */
export function parsePolicy(secrets: SecretMap): ParsedSecrets {
  const policy: Policy = {
    base_bp: num(secrets, "keel_base_bp"),
    kvol_bp: num(secrets, "keel_kvol_bp"),
    volcap_bp: num(secrets, "keel_volcap_bp"),
    jitter_bp: num(secrets, "keel_jitter_bp"),
    tmax_bp: num(secrets, "keel_tmax_bp"),
    emerg_bp: num(secrets, "keel_emerg_bp"),
    buffer_bp: num(secrets, "keel_buffer_bp"),
    target_cap_bp: num(secrets, "keel_target_cap_bp"),
    halflife: num(secrets, "keel_halflife"),
    cooldown: num(secrets, "keel_cooldown"),
    max_repay_bp: num(secrets, "keel_max_repay_bp"),
    max_deposit: num(secrets, "keel_max_deposit"),
    t_est_s: num(secrets, "keel_t_est_s"),
  };

  const saltHex = req(secrets, SALT_SECRET_ID);
  const salt = hexToBytes(saltHex as `0x${string}`);
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

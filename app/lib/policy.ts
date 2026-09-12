import type { Policy } from "keel-controller";

// Default Keel policy (the sealed secret). In production every field is a Vault secret.
export const KEEL_POLICY: Policy = {
  base_bp: 10700,
  kvol_bp: 10000,
  volcap_bp: 200,
  jitter_bp: 300,
  tjitter_bp: 300,
  tmax_bp: 11100,
  emerg_bp: 10300,
  buffer_bp: 500,
  target_cap_bp: 12500,
  halflife: 4,
  cooldown: 1,
  max_repay_bp: 3000,
  max_deposit: 250,
  t_est_s: 10800,
};

// Fixed-threshold "starter" baseline: no jitter, no vol, constant trigger.
export const STARTER = { armBp: 10800, targetBp: 11500 };

// DEMO SALT — production salt stays sealed. Any fixed 32 bytes.
export const DEMO_SALT_HEX =
  "0x" + "6b65656c2d64656d6f2d73616c742d76310000000000000000000000000000".padEnd(64, "0");
export function demoSaltBytes(): Uint8Array {
  const hex = DEMO_SALT_HEX.slice(2);
  const b = new Uint8Array(32);
  for (let i = 0; i < 32; i++) b[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return b;
}

// Reproducible controller source-tree hash (`bun run codehash`). Kept in sync with
// workflow/config.*.json by `bun run codehash --check` (which also checks this constant).
export const CONTROLLER_CODE_HASH =
  "0x7ed604edb03747f3c1a66bb765f9bbe7638d261ad293d77b42b5b658516acc88" as `0x${string}`;

// HF = price / 1794.87 at initial C/D. The whole game is a $205 window.
export const PRICE_DIVISOR = 1794.87;
export const WINDOW_LOW = 1795; // HF 1.00
export const WINDOW_HIGH = 2000; // HF 1.114
export const LIQ_HF = 1.01; // liquidation line

export const hfOfBp = (bp: number) => bp / 10000;
export const usdOf = (priceX100: number) => priceX100 / 100;

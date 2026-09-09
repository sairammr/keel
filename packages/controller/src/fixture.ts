import type { Policy } from "./types";

// Default policy used by tests only.
export const DEFAULT_POLICY: Policy = {
  base_bp: 10700,
  kvol_bp: 10000,
  volcap_bp: 200,
  jitter_bp: 300,
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

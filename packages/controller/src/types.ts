// Keel — FROZEN INTERFACE CONTRACT
// Single source of truth. Controller implements these; scenario/hunter/workflow/app import them.
// All HF/price/token maths in integer contract units (×100). Never use floats for on-chain values.

/** Policy parameters. All are Vault secrets in production — NEVER hardcoded in config/logs/repo. */
export interface Policy {
  base_bp: number; // floor trigger, HF bp (10700 = 1.07)
  kvol_bp: number; // vol gain (10000 = 1.0)
  volcap_bp: number; // cap on vol term (200 = +0.02)
  jitter_bp: number; // jitter width, upward only (300 = 0.03)
  tmax_bp: number; // ceiling trigger (11100)
  emerg_bp: number; // emergency override (10300)
  buffer_bp: number; // restore target = trigger + buffer (500)
  target_cap_bp: number; // never restore above this (12500)
  halflife: number; // EWMA half-life in price updates (4)
  cooldown: number; // min price updates between non-emergency actions (1)
  max_repay_bp: number; // max fraction of debt per action, bp (3000 = 30%)
  max_deposit: number; // max vETH per action, ×100 (250 = 2.50)
  t_est_s: number; // assumed scenario length seconds (10800)
}

/** Liquidation line: hf100 <= 100 ⇔ hfBp < 10100 (integer ×100 semantics). */
export const LIQ_BP = 10100n;
export const P0 = 200000n; // start price ×100 ($2,000.00)
export const THETA = 78n; // LIQUI_THRESHOLD %
export const MAX_LTV = 75n;
export const LIQUI_PENALTY = 5n;
export const INIT_COLLATERAL = 500n; // 5.00 vETH ×100
export const INIT_DEBT = 700000n; // 7,000.00 vUSD ×100

/** Wallet reserves available to the controller, ×100 units. */
export interface Balances {
  vETH: bigint;
  vUSD: bigint;
}

export interface DecideInput {
  policy: Policy;
  salt: Uint8Array; // 32 bytes
  prices: bigint[]; // ×100, prices[0] = P0, one entry per observed price level
  round: number; // prices.length - 1, index of current level
  collateral: bigint; // C, ×100 vETH
  debt: bigint; // D, ×100 vUSD
  hfBp: bigint; // current HF in bp
  lastActionRound: number; // -1 if never acted
  nowS: number; // current unix seconds
  startedS: number; // scenarioStartTime unix seconds (0 = not started)
  balances: Balances;
}

export type ActionKind = "repay" | "deposit" | "withdraw";

export interface Decision {
  act: boolean;
  kind?: ActionKind;
  amount?: bigint; // contract units ×100
  armBp: bigint; // trigger in force this round
  targetBp: bigint; // restore target
  emergency: boolean;
  reason: string; // one word status: SAFE | DEFENDED | EMERGENCY | IDLE | CAPPED
}

/** On-chain receipt payload (matches Receipts.sol struct). */
export interface Receipt {
  commit: `0x${string}`;
  round: bigint;
  blockObserved: bigint;
  price: bigint;
  hfBp: bigint;
  action: number; // 1 repay, 2 deposit, 3 withdraw
  amount: bigint;
  actionNonce: bigint;
}

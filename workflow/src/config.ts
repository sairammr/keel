// Workflow config — PUBLIC only. NO policy parameters here (those are Vault secrets).
// Loaded by the CRE Runner from config.{local,staging,production}.json (default JSON parser).

export interface Config {
  /** Public fallback RPC. The private RPC (with credentials) is the `keel_rpc_url` secret. */
  rpc_url: string;
  /** ChallengeLending address (the lending protocol we protect). */
  lending: `0x${string}`;
  /** PolicyCommit contract — one-shot commitment posted by the enclave. */
  policyCommit: `0x${string}`;
  /** Receipts contract — EIP-712 action receipts. */
  receipts: `0x${string}`;
  /** Sepolia. */
  chainId: number;
  /** Cron cadence. */
  schedule: string;
  /**
   * keccak256 of the controller bundle (`bun run codehash`). PUBLIC — it is part of the
   * committed policyBytes and revealed at reveal time. Binds the algorithm, not the numbers.
   */
  controllerCodeHash: `0x${string}`;
  /**
   * Optional block hint: the block of ChallengeStarted, so log scans start there
   * instead of genesis. 0 = scan from 0 (correct but slower).
   */
  startBlock: number;
}

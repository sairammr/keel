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
   * REQUIRED. Block of ChallengeOpened for the target contract (own copy: its deployment block),
   * so log scans start there instead of genesis. Official Sepolia contract: 11661556.
   * The public RPC caps eth_getLogs at 50 000 blocks, so a stale/zero value silently breaks
   * the log scan once the chain moves past that window — keep this current.
   * The private keel_rpc_url secret must be an uncapped provider (Alchemy/Infura); the public
   * fallback here serves eth_call / eth_sendRawTransaction but not full-range eth_getLogs.
   */
  startBlock: number;
}

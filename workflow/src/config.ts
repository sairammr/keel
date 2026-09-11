// Workflow config — PUBLIC only. NO policy parameters here (those are Vault secrets).
// Validated by a zod schema so Runner.newRunner({ configSchema }) rejects malformed config.
import { z } from "zod";

export const configSchema = z.object({
  /** Public fallback RPC. The private RPC (with credentials) is the `keel_rpc_url` secret. */
  rpc_url: z.string(),
  /** ChallengeLending address (the lending protocol we protect). */
  lending: z.string().regex(/^0x[0-9a-fA-F]{40}$/).transform((v) => v as `0x${string}`),
  /** vETH / vUSD token addresses (known at deploy time) — so balanceOf fits the single batched read. */
  vETH: z.string().regex(/^0x[0-9a-fA-F]{40}$/).transform((v) => v as `0x${string}`),
  vUSD: z.string().regex(/^0x[0-9a-fA-F]{40}$/).transform((v) => v as `0x${string}`),
  /** PolicyCommit contract — one-shot commitment posted by the enclave. */
  policyCommit: z.string().regex(/^0x[0-9a-fA-F]{40}$/).transform((v) => v as `0x${string}`),
  /** Receipts contract — EIP-712 action receipts. */
  receipts: z.string().regex(/^0x[0-9a-fA-F]{40}$/).transform((v) => v as `0x${string}`),
  /** Sepolia. */
  chainId: z.number(),
  /** Cron cadence. */
  schedule: z.string(),
  /**
   * keccak256 of the controller SOURCE tree (`bun run codehash`). PUBLIC — part of the committed
   * policyBytes, revealed at reveal time. Binds the algorithm, not the numbers.
   */
  controllerCodeHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/).transform((v) => v as `0x${string}`),
  /**
   * REQUIRED. Block of ChallengeOpened for the target (own copy: its deployment block). Official: 11661556.
   * The public RPC caps eth_getLogs at 50 000 blocks, so a stale value silently breaks the log scan.
   */
  startBlock: z.number(),
  /**
   * true → register the handler confidentially in a TEE (handlerInTee). false → run non-confidentially
   * on the DON (cre.handler) as an R2 fallback when TEE beta access is not yet granted.
   */
  tee: z.boolean(),
});

export type Config = z.infer<typeof configSchema>;

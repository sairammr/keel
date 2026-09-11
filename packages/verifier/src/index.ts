export * from "./abi.ts";
export * from "./reconstruct.ts";
export * from "./audit.ts";

import { reconstruct, type ReconstructTargets } from "./reconstruct.ts";
import { audit, type AuditOpts, type AuditReport } from "./audit.ts";

/** Read the chain, then audit it. One call for the app and the CLI. */
export async function verifyParticipant(
  targets: ReconstructTargets,
  opts?: Partial<AuditOpts>,
): Promise<AuditReport> {
  const run = await reconstruct(targets);
  return audit(run, { receiptsAddr: targets.receipts, ...opts });
}

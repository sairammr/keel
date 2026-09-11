// Pure helpers shared by the handler and the chain reader. No I/O — unit-testable.

/**
 * The price-level index a block belongs to: the number of PriceUpdate logs at or before it.
 * prices[0] = P0 (pre-update) so 0 updates ⇒ round 0, k updates ⇒ round k.
 */
export function roundOfBlock(actionBlock: bigint, priceBlocks: bigint[]): number {
  let r = 0;
  for (const pb of priceBlocks) if (pb <= actionBlock) r++;
  return r;
}

/**
 * Prices from PriceUpdate logs at or after minBlock. Levels before the ChallengeStarted block are
 * organiser pre-start test updates and must not enter the ladder the controller reasons over.
 */
export function pricesFrom(logs: { price: bigint; block: bigint }[], minBlock: bigint): bigint[] {
  return logs.filter((l) => l.block >= minBlock).map((l) => l.price);
}

export interface Leg {
  kind: "deposit" | "repay";
  amount: bigint;
}

/** Order the solver's two legs so the finishing leg (sr.kind) is sent LAST; drop zero legs. */
export function orderLegs(sr: { kind: "deposit" | "repay" | "withdraw"; dep: bigint; rep: bigint }): Leg[] {
  const legs: Leg[] = [];
  if (sr.kind === "repay") {
    if (sr.dep > 0n) legs.push({ kind: "deposit", amount: sr.dep });
    if (sr.rep > 0n) legs.push({ kind: "repay", amount: sr.rep });
  } else {
    if (sr.rep > 0n) legs.push({ kind: "repay", amount: sr.rep });
    if (sr.dep > 0n) legs.push({ kind: "deposit", amount: sr.dep });
  }
  return legs;
}

export interface LegNonce {
  legNonce: number; // nonce of the action tx
  receiptNonce: number; // === legNonce + 1 (adjacency proof, per leg)
}

/**
 * One receipt PER leg, each posted at legNonce + 1. For 2 legs starting at n the nonce sequence is
 * [L1=n, R1=n+1, L2=n+2, R2=n+3] — so the batch is action,receipt,action,receipt in nonce order.
 */
export function planNonces(startNonce: number, nLegs: number): LegNonce[] {
  return Array.from({ length: nLegs }, (_, i) => ({ legNonce: startNonce + 2 * i, receiptNonce: startNonce + 2 * i + 1 }));
}

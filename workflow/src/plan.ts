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

export interface NoncePlan {
  legNonces: number[]; // nonce per leg tx, in send order
  actionNonce: number; // nonce of the finishing (last) leg tx
  receiptNonce: number; // === actionNonce + 1
}

/** Nonce assignment for the legs + the receipt (which must be exactly actionNonce + 1). */
export function planNonces(startNonce: number, nLegs: number): NoncePlan {
  const legNonces = Array.from({ length: nLegs }, (_, i) => startNonce + i);
  const actionNonce = startNonce + nLegs - 1;
  return { legNonces, actionNonce, receiptNonce: actionNonce + 1 };
}

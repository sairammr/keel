import { THETA } from "./types";

// hfBp = C*P*THETA*100 / (100*D)  (bp scale, 11143 ⇒ 1.1143). D=0 → sentinel.
export function hfBpOf(C: bigint, D: bigint, P: bigint): bigint {
  if (D === 0n) return 1_000_000n;
  return (C * P * THETA * 100n) / (100n * D);
}

// hf100 = C*P*THETA / (100*D)  (×100, matches contract; 111 ⇒ 1.114).
export function hf100Of(C: bigint, D: bigint, P: bigint): bigint {
  if (D === 0n) return 1_000_000n;
  return (C * P * THETA) / (100n * D);
}

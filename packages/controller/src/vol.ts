import type { Policy } from "./types";

// EWMA realised volatility → quantised bp term (deterministic).
// λ = 2^(-1/H); σ² prior = 0.02²; r = ln(P_i/P_{i-1}); σ² = λσ² + (1-λ)r².
// volTermBp = min(volcap, round(kvol_bp/10000 · σ · 10000)) = min(cap, round(kvol_bp·σ)).
export function volTermBp(prices: bigint[], round: number, policy: Policy): number {
  const lambda = Math.pow(2, -1 / policy.halflife);
  let sig2 = 0.02 * 0.02;
  for (let i = 1; i <= round; i++) {
    const pi = prices[i];
    const pp = prices[i - 1];
    if (pi === undefined || pp === undefined) break;
    const r = Math.log(Number(pi) / Number(pp));
    sig2 = lambda * sig2 + (1 - lambda) * r * r;
  }
  const sigma = Math.sqrt(sig2);
  const term = Math.round((policy.kvol_bp / 10000) * sigma * 10000);
  return Math.min(policy.volcap_bp, term);
}

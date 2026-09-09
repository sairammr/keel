import { P0, INIT_DEBT, THETA, type Policy, type Balances, type ActionKind } from "./types";
import { hfBpOf } from "./hf";

export interface SolveResult {
  kind: ActionKind;
  dep: bigint; // vETH deposit, ×100
  rep: bigint; // vUSD repay, ×100
  resultingHfBp: bigint;
}

interface Cand {
  kind: ActionKind;
  dep: bigint;
  rep: bigint;
}

// Denominator = portfolio value ×100: 5·P0 (init collateral value) + 7000·100 (init debt).
const DENOM = Number(5n * P0 + 7000n * 100n);
const D0 = Number(INIT_DEBT);

// smallest dep (rep=0) so (C+dep)*P*THETA/D >= t  ⇒  C+dep >= ceil(t*D/(P*THETA))
function depPure(C: bigint, D: bigint, P: bigint, t: bigint): bigint {
  const need = (t * D + P * THETA - 1n) / (P * THETA); // ceil
  const d = need - C;
  return d > 0n ? d : 0n;
}

// smallest rep (dep=0) so C*P*THETA/(D-rep) >= t  ⇒  D-rep <= floor(C*P*THETA/t)  ⇒  rep >= D - floor(...)
function repPure(C: bigint, D: bigint, P: bigint, t: bigint): bigint {
  if (t === 0n) return 0n;
  const keep = (C * P * THETA) / t; // floor
  const r = D - keep;
  return r > 0n ? r : 0n;
}

export function solve(args: {
  C: bigint;
  D: bigint;
  P: bigint;
  targetBp: bigint;
  policy: Policy;
  balances: Balances;
  nowS: number;
  startedS: number;
  ignoreCaps?: boolean;
}): SolveResult {
  const { C, D, P, policy, balances, nowS, startedS, ignoreCaps } = args;
  const target = args.targetBp + 100n; // +100 bp headroom

  const depCap = ignoreCaps
    ? balances.vETH
    : min(balances.vETH, BigInt(policy.max_deposit));
  const repCap = ignoreCaps
    ? balances.vUSD
    : min(balances.vUSD, (D * BigInt(policy.max_repay_bp)) / 10000n);

  const cands: Cand[] = [];

  // pure deposit
  cands.push({ kind: "deposit", dep: min(depPure(C, D, P, target), depCap), rep: 0n });
  // pure repay
  cands.push({ kind: "repay", dep: 0n, rep: min(repPure(C, D, P, target), repCap) });
  // deposit-to-cap + repay-rest (repay is finishing lever)
  {
    const dep = depCap;
    const rep = min(repPure(C + dep, D, P, target), repCap);
    cands.push({ kind: "repay", dep, rep });
  }
  // repay-to-cap + deposit-rest (deposit is finishing lever)
  {
    const rep = repCap;
    const dep = min(depPure(C, D - rep, P, target), depCap);
    cands.push({ kind: "deposit", dep, rep });
  }

  // remaining-time weight
  const f = Math.max(0.15, 1 - (nowS - startedS) / policy.t_est_s);

  let best: (SolveResult & { cost: number }) | null = null;
  let fallback: (SolveResult & { hf: bigint }) | null = null;

  for (const c of cands) {
    const hf = hfBpOf(C + c.dep, D - c.rep, P);
    const res: SolveResult = { kind: c.kind, dep: c.dep, rep: c.rep, resultingHfBp: hf };

    if (fallback === null || hf > fallback.hf) fallback = { ...res, hf };

    if (hf < target) continue; // constraint fails

    const depValue = Number((c.dep * P) / 100n);
    const cost =
      15 * (depValue / DENOM) +
      15 * (Number(c.rep) / DENOM) +
      20 * (Number(c.rep) / D0) * f;

    if (best === null || cost < best.cost) best = { ...res, cost };
  }

  if (best) return { kind: best.kind, dep: best.dep, rep: best.rep, resultingHfBp: best.resultingHfBp };
  // none valid → highest resulting HF (emergency semantics)
  return {
    kind: fallback!.kind,
    dep: fallback!.dep,
    rep: fallback!.rep,
    resultingHfBp: fallback!.resultingHfBp,
  };
}

function min(a: bigint, b: bigint): bigint {
  return a < b ? a : b;
}

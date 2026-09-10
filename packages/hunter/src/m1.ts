// Model M1 — hunter assumes a fixed liquidation-defence threshold θ.
// Real Bayesian posterior over θ from public (HF, acted?) observations.

export type Obs = { h: number; a: 0 | 1 };

export const EPS = 0.03; // action slip
const B_LO = 1.0;
const B_HI = 1.2;
const STEP = 0.0005;
export const N_B = Math.round((B_HI - B_LO) / STEP) + 1; // 401

export function bGrid(): number[] {
  const g = new Array<number>(N_B);
  for (let i = 0; i < N_B; i++) g[i] = B_LO + i * STEP;
  return g;
}

/** narrowest contiguous interval over `grid` holding >= `mass` of `post`. */
export function hpd(
  grid: number[],
  post: Float64Array,
  mass = 0.9,
): { lo: number; hi: number; width: number } {
  const n = post.length;
  let lo = 0;
  let acc = 0;
  let best = { lo: grid[0]!, hi: grid[n - 1]!, width: Infinity };
  for (let hi = 0; hi < n; hi++) {
    acc += post[hi]!;
    while (acc - post[lo]! >= mass && lo < hi) {
      acc -= post[lo]!;
      lo++;
    }
    if (acc >= mass) {
      const w = grid[hi]! - grid[lo]!;
      if (w < best.width) best = { lo: grid[lo]!, hi: grid[hi]!, width: w };
    }
  }
  return best;
}

// P(a=1 | θ, h) under fixed-threshold + slip.
function pAct1(theta: number, h: number): number {
  return EPS + (1 - 2 * EPS) * (h <= theta ? 1 : 0);
}

export function m1(obs: Obs[]): {
  grid: number[];
  post: Float64Array;
  hpd90: { lo: number; hi: number; width: number };
  mode: number;
} {
  const grid = bGrid();
  const logp = new Float64Array(N_B); // uniform prior → 0
  for (let i = 0; i < N_B; i++) {
    const theta = grid[i]!;
    let s = 0;
    for (const o of obs) {
      const p1 = pAct1(theta, o.h);
      s += Math.log(o.a === 1 ? p1 : 1 - p1);
    }
    logp[i] = s;
  }
  const post = normalizeLog(logp);
  let mode = grid[0]!;
  let mx = -1;
  for (let i = 0; i < N_B; i++) if (post[i]! > mx) (mx = post[i]!), (mode = grid[i]!);
  return { grid, post, hpd90: hpd(grid, post, 0.9), mode };
}

/** log-weights → normalised probabilities (log-sum-exp, underflow-safe). */
export function normalizeLog(logp: Float64Array): Float64Array {
  let m = -Infinity;
  for (const v of logp) if (v > m) m = v;
  const out = new Float64Array(logp.length);
  let z = 0;
  for (let i = 0; i < logp.length; i++) {
    const e = Math.exp(logp[i]! - m);
    out[i] = e;
    z += e;
  }
  for (let i = 0; i < out.length; i++) out[i] = out[i]! / z;
  return out;
}

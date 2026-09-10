// Model M2 — hunter who read Keel's public code: threshold b + unknown upward jitter w.
// Joint posterior over (b, w); marginal over b; posterior-predictive hunt price.

import { EPS, N_B, bGrid, hpd, normalizeLog, type Obs } from "./m1";

const W_STEP = 0.005;
export const N_W = 17; // {0, 0.005, ... , 0.08}
export const H_PER_DOLLAR = 1 / 1794.87; // h(p) = p / 1794.87

export function wGrid(): number[] {
  const g = new Array<number>(N_W);
  for (let i = 0; i < N_W; i++) g[i] = i * W_STEP;
  return g;
}

// P(a=1 | b, w, h): ramp from full-act (h<=b) to no-act (h>b+w).
function pAct1(b: number, w: number, h: number): number {
  let q: number;
  if (h <= b) q = 1;
  else if (h > b + w) q = 0;
  else q = (b + w - h) / w; // 0 < w guaranteed here (h>b implies w>0)
  return EPS + (1 - 2 * EPS) * q;
}

export function m2(obs: Obs[]): {
  post2d: Float64Array;
  marginalB: Float64Array;
  hpd90b: { lo: number; hi: number; width: number };
  huntPrice: number;
} {
  const bs = bGrid();
  const ws = wGrid();
  const logp = new Float64Array(N_B * N_W); // uniform joint prior
  for (let bi = 0; bi < N_B; bi++) {
    const b = bs[bi]!;
    for (let wi = 0; wi < N_W; wi++) {
      const w = ws[wi]!;
      let s = 0;
      for (const o of obs) {
        const p1 = pAct1(b, w, o.h);
        s += Math.log(o.a === 1 ? p1 : 1 - p1);
      }
      logp[bi * N_W + wi] = s;
    }
  }
  const post2d = normalizeLog(logp);

  const marginalB = new Float64Array(N_B);
  for (let bi = 0; bi < N_B; bi++) {
    let s = 0;
    for (let wi = 0; wi < N_W; wi++) s += post2d[bi * N_W + wi]!;
    marginalB[bi] = s;
  }

  return {
    post2d,
    marginalB,
    hpd90b: hpd(bs, marginalB, 0.9),
    huntPrice: huntPrice(post2d, bs, ws),
  };
}

// Posterior-predictive P(a=1 | data, h): marginalise the action model over (b,w).
export function predictive(
  post2d: Float64Array,
  bs: number[],
  ws: number[],
  h: number,
): number {
  let s = 0;
  for (let bi = 0; bi < bs.length; bi++)
    for (let wi = 0; wi < ws.length; wi++)
      s += post2d[bi * ws.length + wi]! * pAct1(bs[bi]!, ws[wi]!, h);
  return s;
}

// Largest price p* (dollars) with predictive P(a=1 | h(p*)) >= 0.9.
// Predictive is monotonically decreasing in h (higher price ⇒ safer ⇒ less likely to act),
// so scan h downward and take the first (largest) h that clears the bar.
function huntPrice(post2d: Float64Array, bs: number[], ws: number[]): number {
  const hHi = bs[bs.length - 1]! + ws[ws.length - 1]! + 0.05;
  for (let h = hHi; h > 0.5; h -= 0.0002) {
    if (predictive(post2d, bs, ws, h) >= 0.9) return h / H_PER_DOLLAR;
  }
  return 0.5 / H_PER_DOLLAR;
}

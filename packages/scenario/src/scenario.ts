// Scenario types + seeded deterministic generator (spec §7 families).
// All prices are ×100 ($2,000.00 → 200000n). Start P0 = 200000, C = 500, D = 700000.
import { P0 } from "../../controller/src/index.ts";

export interface Step {
  dtSeconds: number;
  price: bigint;
}
export interface Scenario {
  name: string;
  family: string;
  steps: Step[];
}

// mulberry32 — tiny seeded PRNG (NO Math.random anywhere in the generator).
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Box–Muller gaussian from the seeded uniform stream.
function gauss(rng: () => number, mean: number, sd: number): number {
  const u1 = Math.max(1e-12, rng());
  const u2 = rng();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + sd * z;
}

const randint = (rng: () => number, lo: number, hi: number): number =>
  lo + Math.floor(rng() * (hi - lo + 1));

const pick = <T>(rng: () => number, xs: readonly T[]): T => xs[Math.floor(rng() * xs.length)]!;

// dollars×100 from a float price, clamped to a floor (also ×100).
const toPrice = (p: number, floor: number): bigint => BigInt(Math.max(floor, Math.round(p)));

const P0N = Number(P0); // 200000

const FAMILIES = [
  "gradual",
  "crash",
  "wick",
  "twostage",
  "safevol",
  "vshape",
  "attacker",
] as const;

function genFamily(family: string, rng: () => number, dt: number): Step[] {
  const steps: Step[] = [];
  const push = (price: bigint) => steps.push({ dtSeconds: dt, price });

  switch (family) {
    case "gradual": {
      // 10–25 steps, per-step return N(−1.5%,1%), floor $1,550
      const n = randint(rng, 10, 25);
      let p = P0N;
      const floor = 155000;
      for (let i = 0; i < n; i++) {
        p = p * (1 + gauss(rng, -0.015, 0.01));
        push(toPrice(p, floor));
      }
      break;
    }
    case "crash": {
      // 3–6 steps N(−6%,2%) then flat, floor $1,450
      const n = randint(rng, 3, 6);
      let p = P0N;
      const floor = 145000;
      for (let i = 0; i < n; i++) {
        p = p * (1 + gauss(rng, -0.06, 0.02));
        push(toPrice(p, floor));
      }
      const flat = steps[steps.length - 1]!.price;
      for (let i = 0; i < randint(rng, 2, 4); i++) push(flat);
      break;
    }
    case "wick": {
      // dip 6–12% over 2–4 steps, recover within 3 steps
      const dip = 0.06 + rng() * 0.06;
      const down = randint(rng, 2, 4);
      const bottom = P0N * (1 - dip);
      for (let i = 1; i <= down; i++) push(toPrice(P0N + (bottom - P0N) * (i / down), 145000));
      const up = randint(rng, 1, 3);
      for (let i = 1; i <= up; i++) push(toPrice(bottom + (P0N - bottom) * (i / up), 145000));
      break;
    }
    case "twostage": {
      // decline → plateau 5–10 steps → second decline
      let p = P0N;
      for (let i = 0; i < randint(rng, 4, 8); i++) {
        p = p * (1 + gauss(rng, -0.02, 0.01));
        push(toPrice(p, 150000));
      }
      const plateau = p;
      for (let i = 0; i < randint(rng, 5, 10); i++) push(toPrice(plateau, 150000));
      for (let i = 0; i < randint(rng, 4, 8); i++) {
        p = p * (1 + gauss(rng, -0.025, 0.012));
        push(toPrice(p, 150000));
      }
      break;
    }
    case "safevol": {
      // ±3–8% oscillation, never below $1,790
      const n = randint(rng, 12, 20);
      const floor = 179000;
      for (let i = 0; i < n; i++) {
        const amp = 0.03 + rng() * 0.05;
        const p = P0N * (1 + amp * Math.sin(i * 1.3) * (rng() < 0.5 ? 1 : -1));
        push(toPrice(p, floor));
      }
      break;
    }
    case "vshape": {
      // 30–40 steps N(−0.6%,0.8%) slow bleed then recovery
      const n = randint(rng, 30, 40);
      const half = Math.floor(n / 2);
      let p = P0N;
      const floor = 150000;
      for (let i = 0; i < half; i++) {
        p = p * (1 + gauss(rng, -0.006, 0.008));
        push(toPrice(p, floor));
      }
      const bottom = p;
      for (let i = 0; i < n - half; i++) {
        p = p * (1 + gauss(rng, 0.008, 0.008));
        push(toPrice(Math.min(P0N, p), floor));
      }
      void bottom;
      break;
    }
    case "attacker": {
      // safe-vol base + 2–4 injected one-step taps at a hunt price, reverting next step
      const base = genFamily("safevol", rng, dt);
      const huntPrice = BigInt(randint(rng, 170000, 178000)); // just under liquidation (~179487)
      const nTaps = randint(rng, 2, 4);
      const out: Step[] = [];
      const tapAt = new Set<number>();
      for (let k = 0; k < nTaps; k++) tapAt.add(randint(rng, 1, base.length - 1));
      for (let i = 0; i < base.length; i++) {
        const s = base[i]!;
        if (tapAt.has(i)) {
          out.push({ dtSeconds: dt, price: huntPrice }); // tap
          out.push(s); // revert next step
        } else {
          out.push(s);
        }
      }
      return out;
    }
  }
  return steps;
}

function makeScenario(seed: number, family: string): Scenario {
  const rng = mulberry32(seed);
  const dt = pick(rng, [60, 120, 300] as const); // one dt per scenario
  const steps = genFamily(family, rng, dt);
  return { name: `${family}-${seed}`, family, steps };
}

export function generateTrain(): Scenario[] {
  const out: Scenario[] = [];
  for (let seed = 1; seed <= 40; seed++) {
    out.push(makeScenario(seed, FAMILIES[(seed - 1) % FAMILIES.length]!));
  }
  return out;
}

export function generateTest(): Scenario[] {
  const out: Scenario[] = [];
  for (let seed = 1001; seed <= 1024; seed++) {
    out.push(makeScenario(seed, FAMILIES[(seed - 1001) % FAMILIES.length]!));
  }
  return out;
}

// The 5 README literal paths — modelled exactly as given (labelled), even where HF
// implies liquidation. Prices ×100. dt fixed at 120s.
export function readmeLiteral(): Scenario[] {
  const dt = 120;
  const path = (name: string, dollars: number[]): Scenario => ({
    name,
    family: "readme",
    steps: dollars.map((d) => ({ dtSeconds: dt, price: BigInt(Math.round(d * 100)) })),
  });
  return [
    path("readme-wick", [2000, 1620, 1900]),
    path("readme-gradual", [2000, 1900, 1800, 1700, 1600]),
    path("readme-crash", [2000, 1700, 1500, 1450, 1450]),
    path("readme-twostage", [2000, 1850, 1850, 1850, 1650, 1500]),
    path("readme-recover", [2000, 1750, 1650, 1750, 1900, 2000]),
  ];
}

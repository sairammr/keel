// Score the 5 OFFICIAL README scenario paths (challenge repo, Sept 2026 version)
// for: the committed prod policy, the tuner winner, the starter, do-nothing.
// Usage: bun run scripts/eval-official.ts
import { runScenario, scoreRun, makeStarter, DO_NOTHING, KEEL, DEFAULT_KEEL_POLICY } from "../packages/scenario/src";
import type { Scenario } from "../packages/scenario/src/scenario.ts";
import type { Policy } from "../packages/controller/src";

const dt = 120;
const path = (name: string, dollars: number[]): Scenario => ({
  name, family: "official",
  steps: dollars.map((d) => ({ dtSeconds: dt, price: BigInt(Math.round(d * 100)) })),
});
// Exact price paths from the official challenge README "Market scenarios examples".
const SCENARIOS = [
  path("gradual-decline", [2000, 1850, 1750, 1650, 1550]),
  path("sudden-crash", [2000, 1700, 1625, 1450]),
  path("temporary-wick", [2000, 1750, 1620, 1900]),
  path("two-stage-decline", [2000, 1750, 1650, 1650, 1500]),
  path("safe-volatility", [2000, 1800, 1950, 1750, 2050]),
];

const TUNED: Policy = { ...DEFAULT_KEEL_POLICY, base_bp: 10500, jitter_bp: 200, buffer_bp: 700 };

const salt = new Uint8Array(32).fill(0x5a);
const opts = { cronPeriod: 60 };

const strategies: [string, Policy, typeof KEEL][] = [
  ["committed (DEFAULT+tj300)", DEFAULT_KEEL_POLICY, KEEL],
  ["tuned winner", TUNED, KEEL],
  ["starter 1.08/1.15", DEFAULT_KEEL_POLICY, makeStarter(10800, 11500)],
  ["do-nothing", DEFAULT_KEEL_POLICY, DO_NOTHING],
];

for (const [label, pol, strat] of strategies) {
  let sum = 0, worst = Infinity, cap = 0, liq = 0;
  const rows: string[] = [];
  for (const sc of SCENARIOS) {
    const trace = runScenario(sc, pol, salt, opts, strat);
    const s = trace.score;
    sum += s.total; worst = Math.min(worst, s.total); liq += s.liquidated ? 1 : 0;
    let scap = 0;
    for (const t of trace.ticks) scap += Number((t.dep * t.price) / 100n) + Number(t.rep);
    cap += scap;
    rows.push(`  ${sc.name.padEnd(18)} total=${s.total.toFixed(2)} surv=${s.survive} debtT=${s.debtTime.toFixed(2)} capEff=${s.capEff.toFixed(2)} disc=${s.discipline.toFixed(2)} actions=${s.nActions} capital=${scap}`);
  }
  console.log(`\n== ${label} ==  mean=${(sum / SCENARIOS.length).toFixed(2)} worst=${worst.toFixed(2)} liq=${liq} capitalTotal=${cap}`);
  for (const r of rows) console.log(r);
}

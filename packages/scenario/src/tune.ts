// Grid search over Keel policy knobs (spec §7 tuning loop).
// `bun run tune`. Selection is lexicographic: 0 liquidations, max mean, max worst, min capital.
import { runScenario, KEEL, DEFAULT_KEEL_POLICY, type EngineOpts } from "./engine.ts";
import { makeStarter, DO_NOTHING } from "./starter.ts";
import { generateTrain } from "./scenario.ts";
import type { Policy } from "../../controller/src/index.ts";
import type { Strategy } from "./engine.ts";

const SALT = new Uint8Array(32).fill(42);
const TRAIN = generateTrain();

interface Agg {
  label: string;
  liquidations: number;
  mean: number;
  worst: number;
  capital: number; // mean capital deployed (×100 vUSD)
}

function evaluate(
  label: string,
  strategy: Strategy,
  policy: Policy,
  cronPeriod: number,
): Agg {
  const opts: EngineOpts = { cronPeriod };
  let sum = 0;
  let worst = Infinity;
  let liq = 0;
  let capSum = 0;
  for (const sc of TRAIN) {
    const t = runScenario(sc, policy, SALT, opts, strategy);
    sum += t.score.total;
    worst = Math.min(worst, t.score.total);
    if (t.liquidated) liq += 1;
    for (const tick of t.ticks) capSum += Number((tick.dep * tick.price) / 100n) + Number(tick.rep);
  }
  const n = TRAIN.length;
  return { label, liquidations: liq, mean: sum / n, worst, capital: capSum / n };
}

// lexicographic: fewer liq, then higher mean, then higher worst, then less capital.
function cmp(a: Agg, b: Agg): number {
  if (a.liquidations !== b.liquidations) return a.liquidations - b.liquidations;
  if (a.mean !== b.mean) return b.mean - a.mean;
  if (a.worst !== b.worst) return b.worst - a.worst;
  return a.capital - b.capital;
}

const GRID = {
  base: [10500, 10600, 10700, 10800, 10900],
  jmax: [200, 300, 400],
  buf: [300, 500, 700],
  H: [3, 4, 6],
  cron: [30, 60],
};

function main() {
  const results: Array<Agg & { policy: Policy; cron: number }> = [];
  let combos = 0;
  for (const base of GRID.base)
    for (const jmax of GRID.jmax)
      for (const buf of GRID.buf)
        for (const H of GRID.H)
          for (const cron of GRID.cron) {
            combos++;
            const policy: Policy = {
              ...DEFAULT_KEEL_POLICY,
              base_bp: base,
              jitter_bp: jmax,
              buffer_bp: buf,
              halflife: H,
            };
            const label = `base=${base} jmax=${jmax} buf=${buf} H=${H} cron=${cron}`;
            results.push({ ...evaluate(label, KEEL, policy, cron), policy, cron });
          }

  results.sort(cmp);

  console.log(`\nKeel grid search — ${combos} combos × ${TRAIN.length} train scenarios\n`);
  console.log("rank  liq   mean    worst   capital   config");
  console.log("----  ---  ------  ------  --------  ------------------------------------------");
  results.slice(0, 10).forEach((r, i) => {
    console.log(
      `${String(i + 1).padStart(4)}  ${String(r.liquidations).padStart(3)}  ` +
        `${r.mean.toFixed(2).padStart(6)}  ${r.worst.toFixed(2).padStart(6)}  ` +
        `${Math.round(r.capital).toString().padStart(8)}  ${r.label}`,
    );
  });

  const win = results[0]!;
  console.log("\n=== WINNING POLICY ===");
  console.log(JSON.stringify(win.policy, null, 2));
  console.log(`cronPeriod = ${win.cron}`);
  console.log(
    `liquidations=${win.liquidations}  mean=${win.mean.toFixed(2)}  worst=${win.worst.toFixed(2)}  capital=${Math.round(win.capital)}`,
  );

  // ---- baselines in the same harness ----
  console.log("\n=== BASELINES (train) ===");
  const baselines: Agg[] = [
    evaluate("starter 1.08/1.15", makeStarter(10800, 11500), DEFAULT_KEEL_POLICY, 60),
    evaluate("starter 1.05/1.12", makeStarter(10500, 11200), DEFAULT_KEEL_POLICY, 60),
    evaluate("do-nothing", DO_NOTHING, DEFAULT_KEEL_POLICY, 60),
  ];
  for (const b of baselines) {
    console.log(
      `${b.label.padEnd(20)} liq=${b.liquidations}  mean=${b.mean.toFixed(2)}  worst=${b.worst.toFixed(2)}  capital=${Math.round(b.capital)}`,
    );
  }

  console.log("\n=== KEEL vs BASELINES (mean, worst, liquidations) ===");
  for (const b of baselines) {
    const beatsMean = win.mean > b.mean;
    const beatsLiq = win.liquidations <= b.liquidations;
    console.log(
      `vs ${b.label.padEnd(20)} mean ${beatsMean ? "WIN " : "lose"} (${win.mean.toFixed(2)} vs ${b.mean.toFixed(2)})  ` +
        `liq ${beatsLiq ? "WIN " : "lose"} (${win.liquidations} vs ${b.liquidations})`,
    );
  }
}

main();

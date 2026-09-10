// Side-by-side text replay: Keel vs a fixed-threshold starter. Video fallback (§7).
// `bun run replay [--vs starter] [--scenario <name>]`
import { runScenario, KEEL, DEFAULT_KEEL_POLICY, type Trace } from "./engine.ts";
import { makeStarter } from "./starter.ts";
import { generateTrain, readmeLiteral, type Scenario } from "./scenario.ts";

const SALT = new Uint8Array(32).fill(42);

function fmtHf(hfBp: bigint): string {
  return (Number(hfBp) / 10000).toFixed(4);
}
function fmtAction(t: Trace["ticks"][number]): string {
  if (t.dep === 0n && t.rep === 0n) return "-";
  const parts: string[] = [];
  if (t.dep > 0n) parts.push(`dep ${(Number(t.dep) / 100).toFixed(2)}`);
  if (t.rep > 0n) parts.push(`rep ${(Number(t.rep) / 100).toFixed(2)}`);
  return parts.join("+");
}

// collapse a trace to one row per price level (round)
function byRound(t: Trace) {
  const rows = new Map<number, { price: bigint; hfBp: bigint; act: string; liq: boolean }>();
  for (const tick of t.ticks) {
    const act = fmtAction(tick);
    const prev = rows.get(tick.round);
    rows.set(tick.round, {
      price: tick.price,
      hfBp: tick.hfBp,
      act: prev && prev.act !== "-" && act === "-" ? prev.act : act,
      liq: tick.hf100 <= 100n,
    });
  }
  return rows;
}

function main() {
  const args = process.argv.slice(2);
  const scName = args.includes("--scenario") ? args[args.indexOf("--scenario") + 1] : undefined;
  const pool: Scenario[] = [...readmeLiteral(), ...generateTrain()];
  const fallback = pool.find((s) => s.name === "readme-crash") ?? pool[0]!;
  const scenario = scName ? pool.find((s) => s.name === scName) ?? fallback : fallback;

  const keel = runScenario(scenario, DEFAULT_KEEL_POLICY, SALT, { cronPeriod: 60 }, KEEL);
  const starter = runScenario(
    scenario,
    DEFAULT_KEEL_POLICY,
    SALT,
    { cronPeriod: 60 },
    makeStarter(10800, 11500),
  );

  const k = byRound(keel);
  const s = byRound(starter);

  console.log(`\nReplay: ${scenario.name}  (${scenario.family})  —  Keel vs starter 1.08/1.15\n`);
  console.log("lvl   price      | Keel  HF      action        | Starter HF    action");
  console.log("---  --------    | ----------  -------------   | ----------  -------------");
  for (const round of [...k.keys()].sort((a, b) => a - b)) {
    const kr = k.get(round)!;
    const sr = s.get(round);
    const price = (Number(kr.price) / 100).toFixed(2).padStart(8);
    const kHf = (kr.liq ? "LIQ " : "") + fmtHf(kr.hfBp);
    const sHf = sr ? (sr.liq ? "LIQ " : "") + fmtHf(sr.hfBp) : "-";
    console.log(
      `${String(round).padStart(3)}  ${price}    | ` +
        `${kHf.padEnd(11)} ${kr.act.padEnd(13)} | ` +
        `${sHf.padEnd(11)} ${(sr?.act ?? "-").padEnd(13)}`,
    );
  }

  console.log(
    `\nKeel:    total=${keel.score.total.toFixed(2)}  liquidated=${keel.liquidated}  nActions=${keel.score.nActions}`,
  );
  console.log(
    `Starter: total=${starter.score.total.toFixed(2)}  liquidated=${starter.liquidated}  nActions=${starter.score.nActions}`,
  );
}

main();

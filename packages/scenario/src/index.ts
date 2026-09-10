// Barrel export for the scenario package (spec §7 generators, engine, scoring, mirror).
export {
  type Step,
  type Scenario,
  generateTrain,
  generateTest,
  readmeLiteral,
} from "./scenario.ts";
export {
  type Strategy,
  type Trace,
  type EngineOpts,
  keelPlan,
  KEEL,
  DEFAULT_KEEL_POLICY,
  runScenario,
} from "./engine.ts";
export { type Tick, type Score, type ScoreInput, scoreRun } from "./scoring.ts";
export { makeStarter, DO_NOTHING } from "./starter.ts";
export { ContractMirror, type Reserves, assertHfMatches } from "./mirror.ts";

// Real scenarios straight from the scenario package's seeded generators (spec §7).
// No hand-authored prices — these are the exact families the controller is tuned on.
import {
  readmeLiteral,
  generateTrain,
  generateTest,
  type Scenario as RealScenario,
} from "keel-scenario";

export type Family = "readme" | "train" | "test";
export interface ScenarioMeta {
  id: string;
  name: string;
  family: Family;
  blurb: string;
  real: RealScenario;
}

const BLURB: Record<string, string> = {
  readme: "The canonical demo path — drift into the window, kiss the edge, recover.",
  train: "A seeded training-family market the policy was tuned against.",
  test: "A held-out test-family market — unseen by tuning.",
};

const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

function pick(real: RealScenario[], family: Family): ScenarioMeta[] {
  return real.map((r) => ({
    id: slug(r.name),
    name: r.name,
    family,
    blurb: BLURB[family]!,
    real: r,
  }));
}

// Curated demo set: the readme literal + a few train + a few test scenarios.
export const SCENARIOS: ScenarioMeta[] = [
  ...pick(readmeLiteral(), "readme"),
  ...pick(generateTrain().slice(0, 3), "train"),
  ...pick(generateTest().slice(0, 3), "test"),
];

// Full suite for the Hunter's cross-market intelligence (real m1/m2 over many episodes).
export const ALL_SCENARIOS: RealScenario[] = [
  ...readmeLiteral(),
  ...generateTrain(),
  ...generateTest(),
];

export const byId = (id: string) => SCENARIOS.find((s) => s.id === id) ?? SCENARIOS[0]!;

import { runKeel, runStarterRun } from "@/lib/engine";
import { scenarioPosteriors } from "@/lib/hunter";
import { chainReplay } from "@/lib/runs";
import { KEEL_POLICY, demoSaltBytes } from "@/lib/policy";
import { SCENARIOS } from "@/lib/scenarios";
import { type ReplayData } from "./ReplayView";
import { ReplayTabs } from "./ReplayTabs";
import { PageGuide } from "@/components/PageGuide";

// Server-side: run BOTH agents through the REAL scenario engine (ContractMirror +
// controller decide/solve) for every scenario and infer the real Hunter posterior; and
// reconstruct Keel's REAL on-chain run from Sepolia events for the recorded source.
export const revalidate = 30;

export default async function ReplayPage() {
  const salt = demoSaltBytes();
  const chain = await chainReplay();
  const data: ReplayData[] = SCENARIOS.map((s) => {
    const keel = runKeel(s.real, KEEL_POLICY, salt);
    const starter = runStarterRun(s.real, KEEL_POLICY, salt);
    const post = scenarioPosteriors(s.real, KEEL_POLICY, salt);
    return {
      id: s.id,
      name: s.name,
      family: s.family,
      blurb: s.blurb,
      keel,
      starter,
      keelPost: post.keel,
      starterPost: post.starter,
    };
  });

  return (
    <div className="viewin flex flex-col gap-6">
      <header>
        <div className="eyebrow mb-3">tour · step 1 of 3</div>
        <h1 className="display text-[clamp(30px,4vw,46px)]">
          One market, <span className="it">two defenders.</span>
        </h1>
        <p className="lead mt-4 text-[14.5px]">
          The same falling market hits two bots at once. The starter defends at a fixed
          threshold; Keel runs its sealed, moving policy. Both are simulated by the
          real controller against an exact copy of the on-chain contract.
        </p>
        <div className="rule" />
      </header>
      <PageGuide
        points={[
          "Pick a scenario and press PLAY. Each chart shows one bot's health factor falling as the price drops; markers are its defense actions.",
          "The colored strip under each chart is the attacker's live estimate of that bot's trigger. Watch the starter's strip collapse to a point while Keel's stays wide.",
          "The scorecards use the official challenge scoring: surviving matters most, spending less capital and acting less often matter too.",
          "Switch source to CHAIN to see Keel's real recorded Sepolia run, every action linked to Etherscan.",
        ]}
        next={{ href: "/hunter", label: "Hunter, where the attacker tries to drain both bots" }}
      />
      <ReplayTabs engine={data} chain={chain} />
    </div>
  );
}

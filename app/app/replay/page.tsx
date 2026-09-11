import { runKeel, runStarterRun } from "@/lib/engine";
import { scenarioPosteriors } from "@/lib/hunter";
import { chainReplay } from "@/lib/runs";
import { KEEL_POLICY, demoSaltBytes } from "@/lib/policy";
import { SCENARIOS } from "@/lib/scenarios";
import { type ReplayData } from "./ReplayView";
import { ReplayTabs } from "./ReplayTabs";

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
    <div className="flex flex-col gap-6">
      <header>
        <div className="eyebrow mb-2">01 / replay</div>
        <h1 className="text-[28px] font-semibold tracking-tight">Split-screen replay</h1>
        <p className="mt-2 max-w-[720px] text-[14px] leading-relaxed text-[color:var(--color-muted)]">
          One market, two defenders. Keel runs the sealed policy; the starter runs a
          fixed 1.08 / 1.15 threshold. Both are driven by the same on-chain-exact
          ContractMirror through the real controller — or switch to Keel&apos;s{" "}
          <span className="text-[color:var(--color-keel)]">recorded Sepolia run</span> with
          every action linked to Etherscan.
        </p>
      </header>
      <ReplayTabs engine={data} chain={chain} />
    </div>
  );
}

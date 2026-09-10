import { runKeel, runStarterRun } from "@/lib/engine";
import { scenarioPosteriors } from "@/lib/hunter";
import { KEEL_POLICY, demoSaltBytes } from "@/lib/policy";
import { SCENARIOS } from "@/lib/scenarios";
import { ReplayView, type ReplayData } from "./ReplayView";

// Server-side: run BOTH agents through the REAL scenario engine (ContractMirror +
// controller decide/solve) for every scenario and infer the real Hunter posterior.
export default function ReplayPage() {
  const salt = demoSaltBytes();
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
          ContractMirror through the real controller — step through the price levels and
          watch the Hunter try to pin each one&apos;s trigger.
        </p>
      </header>
      <ReplayView data={data} />
    </div>
  );
}

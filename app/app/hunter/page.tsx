import { crossMarketIntel, runAttack, chainIntel } from "@/lib/hunter";
import { KEEL_POLICY, demoSaltBytes } from "@/lib/policy";
import { ALL_SCENARIOS } from "@/lib/scenarios";
import { HunterView } from "./HunterView";

// Server-side: real Bayesian inference (m1/m2) aggregated across the whole scenario suite,
// a real controller-driven attack, AND the same inference over the real on-chain
// observation stream (verifier reconstruct → obsFromChain). No mocks.
export const revalidate = 30;

export default async function HunterPage() {
  const salt = demoSaltBytes();
  const intel = crossMarketIntel(ALL_SCENARIOS, KEEL_POLICY, salt);
  const attack = runAttack(KEEL_POLICY, salt, intel.keel.huntPriceUsd, 300);
  const chain = await chainIntel();

  return (
    <div className="flex flex-col gap-6">
      <header>
        <div className="eyebrow mb-2">02 / hunter</div>
        <h1 className="text-[28px] font-semibold tracking-tight">The adversary</h1>
        <p className="mt-2 max-w-[780px] text-[14px] leading-relaxed text-[color:var(--color-muted)]">
          The Hunter never sees the policy. From public{" "}
          <span className="mono">(HF, acted?)</span> observations it runs the real M1
          (fixed-threshold) and M2 (threshold + jitter) posteriors — over{" "}
          {ALL_SCENARIOS.length} engine markets, or over Keel&apos;s{" "}
          <span className="text-[color:var(--color-keel)]">real Sepolia logs</span>. The
          starter&apos;s number collapses to a point; Keel&apos;s stays open by at least its
          jitter, and forcing it means crashing price to the floor.
        </p>
      </header>
      <HunterView
        intel={intel}
        attack={attack}
        chain={chain}
        jitterBp={KEEL_POLICY.jitter_bp}
        markets={ALL_SCENARIOS.length}
      />
    </div>
  );
}

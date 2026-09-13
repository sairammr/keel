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
    <div className="viewin flex flex-col gap-6">
      <header>
        <div className="eyebrow mb-3">tour · step 2 of 3</div>
        <h1 className="display text-[clamp(30px,4vw,46px)]">
          The <span className="it">adversary.</span>
        </h1>
        <p className="lead mt-4 text-[14.5px]">
          The Hunter is a real attacker model. It never sees either bot&apos;s policy:
          it only watches public data, at each price level noting the health factor
          and whether the bot acted, exactly what a stop-hunter on mainnet would see.
          From that alone it estimates each bot&apos;s trigger, then attacks.
        </p>
        <div className="rule" />
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

import Link from "next/link";
import { HeroViz, GlyphCommit, GlyphJitter, GlyphVerify } from "@/components/HeroViz";

const STEPS = [
  {
    glyph: <GlyphJitter />,
    title: "The trigger moves",
    body: "Keel re-draws its trigger at every price level from a secret salt, shifted only upward. Randomness can make it act earlier, never later. Watching it fire tells you nothing about where it fires next.",
  },
  {
    glyph: <GlyphCommit />,
    title: "The policy is sealed first",
    body: "Before the market moves, a hash of the whole defense policy goes on-chain. A sealed envelope, handed to the referee before the match. It cannot be swapped later.",
  },
  {
    glyph: <GlyphVerify />,
    title: "Everything is provable after",
    body: "Every defense carries a signed receipt. At the end, Keel opens the envelope and anyone can re-check every round against the sealed policy. Secrecy, audited.",
  },
];

const TOUR = [
  {
    n: "1",
    href: "/replay",
    name: "Replay",
    body: "Watch the same crash hit two defenders. The starter bot's trigger gets found; Keel's doesn't.",
    cta: "Watch it survive",
  },
  {
    n: "2",
    href: "/hunter",
    name: "Hunter",
    body: "A real Bayesian attacker hunts both bots, then drains the one it can predict.",
    cta: "Attack it",
  },
  {
    n: "3",
    href: "/verify",
    name: "Verify",
    body: "The on-chain proof, reconstructed live from Sepolia events. Every claim links to Etherscan.",
    cta: "Check the proof",
  },
];

const USE_CASES = [
  {
    who: "Leverage loopers",
    body: "Billions in looped staked-ETH debt sits near HF 1.05 on Aave. Any bot defending those positions telegraphs its level today. Keel defends without handing hunters a price target.",
  },
  {
    who: "Funds & DAO treasuries",
    body: "A treasury's positions are public by address. Keel lets it run a private defense and still prove to token holders, after the fact, that the committed policy ran unchanged.",
  },
  {
    who: "Automation providers",
    body: "Position-automation services run fully public triggers. Keel is the confidential trigger with per-action receipts: the service proves execution honesty without exposing customers.",
  },
];

export default function Home() {
  return (
    <div className="viewin flex flex-col gap-20">
      {/* hero */}
      <section className="grid gap-10 lg:grid-cols-[1fr_1.05fr] items-center pt-8">
        <div>
          <div className="eyebrow mb-5">liquidation protection · chainlink cre</div>
          <h1 className="display text-[clamp(38px,4.8vw,62px)]">
            Defense bots leak their trigger.{" "}
            <span className="it" style={{ lineHeight: 1.1 }}>
              Keel&apos;s can&apos;t be found.
            </span>
          </h1>
          <p className="lead mt-6 text-[15.5px]">
            Watch any liquidation-protection bot act and you can locate its trigger,
            then hunt it. Keel&apos;s trigger is impossible to locate from its behavior,
            and it proves on-chain that its policy never changed.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/replay" className="btn blue">
              Watch it survive <span className="arw">→</span>
            </Link>
            <Link href="/docs" className="btn ghost">
              How it works
            </Link>
            <Link href="/pitch" className="btn ghost">
              The pitch
            </Link>
          </div>
        </div>
        <div className="border p-4" style={{ borderColor: "var(--color-line2)" }}>
          <HeroViz />
        </div>
      </section>

      {/* the idea in three moves */}
      <section>
        <h2 className="display text-[clamp(24px,3vw,36px)] mb-2">
          The idea, in three moves.
        </h2>
        <p className="text-[14px] text-[color:var(--color-muted)] mb-6 max-w-[62ch]">
          A bot&apos;s actions are public, so a fixed trigger is a secret that leaks one
          bit at every price level. Keel removes the leak, then proves it played fair.
        </p>
        <div className="grid md:grid-cols-3 border" style={{ borderColor: "var(--color-ink)" }}>
          {STEPS.map((s, i) => (
            <div
              key={s.title}
              className={`p-7 ${i < 2 ? "md:border-r border-b md:border-b-0" : ""}`}
              style={{ borderColor: "var(--color-ink)" }}
            >
              {s.glyph}
              <h3 className="mt-4 text-[17px] font-bold tracking-[-0.01em]">{s.title}</h3>
              <p className="mt-2 text-[13.5px] leading-relaxed text-[color:var(--color-muted)]">
                {s.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* guided tour */}
      <section>
        <h2 className="display text-[clamp(24px,3vw,36px)] mb-2">
          See it for yourself.
        </h2>
        <p className="text-[14px] text-[color:var(--color-muted)] mb-6 max-w-[62ch]">
          Three pages, in order: watch the defense, run the attack, check the proof.
          Each one explains itself as you go; the{" "}
          <Link href="/docs" className="link-underline">docs</Link> cover every term.
        </p>
        <div className="grid md:grid-cols-3 gap-4">
          {TOUR.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className="group border p-6 flex flex-col gap-3 transition-colors hover:bg-[color:var(--color-wash)]"
              style={{ borderColor: "var(--color-ink)" }}
            >
              <div className="flex items-baseline gap-3">
                <span
                  className="mono text-[13px] font-semibold w-7 h-7 inline-flex items-center justify-center border"
                  style={{ borderColor: "var(--color-keel)", color: "var(--color-keel)" }}
                >
                  {t.n}
                </span>
                <span className="text-[17px] font-bold tracking-[-0.01em]">{t.name}</span>
              </div>
              <p className="text-[13.5px] leading-relaxed text-[color:var(--color-muted)] flex-1">
                {t.body}
              </p>
              <span className="mono text-[12px] font-medium text-[color:var(--color-keel)]">
                {t.cta} <span className="arw inline-block transition-transform group-hover:translate-x-1">→</span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* live proof strip */}
      <section>
        <div
          className="border p-7 flex flex-wrap items-center justify-between gap-6"
          style={{ borderColor: "var(--color-ink)", background: "var(--color-wash)" }}
        >
          <div>
            <div className="eyebrow mb-2">live on sepolia · official challenge participant #8</div>
            <div className="text-[17px] font-bold tracking-[-0.01em]">
              Policy sealed on-chain before the scenario started, then two defenses with
              signed receipts, then reveal:{" "}
              <span className="mono text-[color:var(--color-ok)]">ALL ROUNDS CONSISTENT</span>
            </div>
            <div className="mono mt-2 text-[12px] text-[color:var(--color-muted)]">
              commitment posted at block 11691103, before scenario start
            </div>
          </div>
          <Link href="/verify" className="btn blue sm">
            Verify it yourself <span className="arw">→</span>
          </Link>
        </div>
      </section>

      {/* use cases */}
      <section className="grid gap-10 md:grid-cols-[0.8fr_1.2fr] items-start">
        <div>
          <h2 className="display text-[clamp(24px,3vw,36px)]">
            Who needs this? Anyone whose position is{" "}
            <span className="it">public.</span>
          </h2>
          <p className="lead mt-4 text-[14.5px]">
            On-chain, your collateral, your debt, and your defender&apos;s behavior are
            all visible. The only thing that can stay secret is <em>when you&apos;ll
            act</em>, and only if it&apos;s built to stay secret under observation.
          </p>
        </div>
        <div className="flex flex-col">
          {USE_CASES.map((u, i) => (
            <div
              key={u.who}
              className={`py-5 ${i < 2 ? "border-b" : ""}`}
              style={{ borderColor: "var(--color-line2)" }}
            >
              <div className="font-bold text-[15px] tracking-[-0.01em]">{u.who}</div>
              <p className="mt-1 text-[13.5px] leading-relaxed text-[color:var(--color-muted)]">
                {u.body}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

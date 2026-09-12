import Link from "next/link";
import { HeroViz, GlyphCommit, GlyphJitter, GlyphVerify } from "@/components/HeroViz";

const STEPS = [
  {
    glyph: <GlyphCommit />,
    n: "01",
    title: "Seal the plan",
    body: "Before the market moves, Keel commits a hash of its whole defense policy on-chain. A sealed envelope, handed to the referee first.",
  },
  {
    glyph: <GlyphJitter />,
    n: "02",
    title: "Move the tripwire",
    body: "The trigger is a fresh secret draw at every price level — shifted only upward, so it never costs survival. Watching it fire tells you nothing about where it fires next.",
  },
  {
    glyph: <GlyphVerify />,
    n: "03",
    title: "Prove it after",
    body: "Every defense carries a signed receipt. At the end, Keel opens the envelope — anyone re-checks every round against the sealed policy. Secrecy, audited.",
  },
];

const USE_CASES = [
  {
    ix: "A",
    who: "Leverage loopers",
    body: "Billions in looped staked-ETH debt sits near HF 1.05 on Aave. Any bot defending those positions telegraphs its level today — Keel defends without handing hunters a price target.",
  },
  {
    ix: "B",
    who: "Funds & DAO treasuries",
    body: "A treasury's positions are public by address. Keel lets it run a private defense and still prove to token holders, after the fact, that the committed policy ran unchanged.",
  },
  {
    ix: "C",
    who: "Automation providers",
    body: "Position-automation services run fully public triggers. Keel is the confidential trigger with per-action receipts — the service proves execution honesty without exposing customers.",
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
            Your liquidation bot has a number. Everyone can find it.{" "}
            <span className="it">Keel&apos;s moves.</span>
          </h1>
          <p className="lead mt-6 text-[15.5px]">
            Watch when a defense bot acts and you can locate its trigger in three price
            pushes — then hunt it. Keel makes the trigger impossible to locate, and
            proves on-chain that it never changed.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/replay" className="btn blue">
              See it survive <span className="arw">→</span>
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

      {/* how it works — three steps */}
      <section>
        <div className="eyebrow mb-6">how it works</div>
        <div className="grid md:grid-cols-3 border" style={{ borderColor: "var(--color-ink)" }}>
          {STEPS.map((s, i) => (
            <div
              key={s.n}
              className={`p-7 ${i < 2 ? "md:border-r border-b md:border-b-0" : ""}`}
              style={{ borderColor: "var(--color-ink)" }}
            >
              {s.glyph}
              <div className="mono text-[11px] mt-4 text-[color:var(--color-keel-ink)]">[{s.n}]</div>
              <h3 className="mt-2 text-[17px] font-bold tracking-[-0.01em]">{s.title}</h3>
              <p className="mt-2 text-[13.5px] leading-relaxed text-[color:var(--color-muted)]">
                {s.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* use cases */}
      <section className="grid gap-10 md:grid-cols-[0.8fr_1.2fr] items-start">
        <div>
          <div className="eyebrow mb-4">who needs it</div>
          <h2 className="display text-[clamp(24px,3vw,36px)]">
            Anyone whose position is <span className="it">public.</span>
          </h2>
          <p className="lead mt-4 text-[14.5px]">
            On-chain, your collateral, your debt, and your defender&apos;s behavior are
            all visible. The only thing that can stay secret is <em>when you&apos;ll act</em> —
            if it&apos;s built to stay secret under observation.
          </p>
        </div>
        <div className="flex flex-col">
          {USE_CASES.map((u, i) => (
            <div
              key={u.ix}
              className={`py-5 flex gap-5 ${i < 2 ? "border-b" : ""}`}
              style={{ borderColor: "var(--color-line2)" }}
            >
              <span className="mono text-[12px] text-[color:var(--color-keel-ink)] pt-0.5">[{u.ix}]</span>
              <div>
                <div className="font-bold text-[15px] tracking-[-0.01em]">{u.who}</div>
                <p className="mt-1 text-[13.5px] leading-relaxed text-[color:var(--color-muted)]">
                  {u.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* proof strip + doors */}
      <section>
        <div
          className="border p-7 flex flex-wrap items-center justify-between gap-6"
          style={{ borderColor: "var(--color-ink)", background: "var(--color-wash)" }}
        >
          <div>
            <div className="eyebrow mb-2">live on sepolia · official challenge joined as participant #8</div>
            <div className="text-[17px] font-bold tracking-[-0.01em]">
              Commit → 2 defenses with signed receipts → reveal →{" "}
              <span className="mono text-[color:var(--color-ok)]">ALL ROUNDS CONSISTENT</span>
            </div>
            <div className="mono mt-2 text-[12px] text-[color:var(--color-muted)]">
              policy hash sealed on the official contract before scenario start — block 11691103
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/verify" className="btn blue sm">
              Verify it yourself <span className="arw">→</span>
            </Link>
            <Link href="/hunter" className="btn ghost sm">
              Attack it
            </Link>
            <Link href="/replay" className="btn ghost sm">
              Replay it
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

import Link from "next/link";

const HF_LINES = [
  { hf: "1.000", price: "$1,795", note: "liquidation floor of the window" },
  { hf: "1.030", price: "$1,849", note: "starter wakes up here" },
  { hf: "1.080", price: "$1,938", note: "fixed threshold fires" },
  { hf: "1.114", price: "$2,000", note: "opening health" },
];

const CARDS = [
  {
    href: "/replay",
    kicker: "01 / REPLAY",
    title: "Split-screen replay",
    body: "Run Keel and a fixed-threshold starter through the same market. Watch the Hunter's band collapse on one and stay wide on the other.",
  },
  {
    href: "/hunter",
    kicker: "02 / HUNTER",
    title: "The adversary",
    body: "A real Bayesian hunter watches 44 market episodes and attacks. Starter's trigger pins to a point; Keel's never does.",
  },
  {
    href: "/verify",
    kicker: "03 / VERIFY",
    title: "Commit ⇄ receipts ⇄ reveal",
    body: "Real EIP-712 receipts, real keccak commitment, real ecrecover — reveal the sealed policy and audit every round in the browser.",
  },
];

export default function Home() {
  return (
    <div className="flex flex-col gap-14">
      {/* hero */}
      <section className="pt-6">
        <div className="eyebrow mb-5">verifiable-secrecy liquidation protection · Chainlink CRE</div>
        <h1 className="mono text-[64px] leading-[0.95] font-semibold tracking-[0.04em] sm:text-[92px]">
          KEEL
        </h1>
        <p className="mt-6 max-w-[760px] text-[19px] leading-[1.5] text-[color:var(--color-ink)]">
          The starter hides the number. Keel{" "}
          <span className="text-[color:var(--color-keel)]">hides the number</span>,{" "}
          <span className="text-[color:var(--color-keel)]">hides what the number will do next</span>, and{" "}
          <span className="text-[color:var(--color-keel)]">proves the number never changed</span>.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/replay"
            className="mono text-[13px] px-4 py-2.5 bg-[color:var(--color-keel)] text-[color:var(--color-bg)] font-semibold hover:opacity-90 transition"
          >
            Run the replay →
          </Link>
          <Link
            href="/hunter"
            className="mono text-[13px] px-4 py-2.5 border hairline text-[color:var(--color-ink)] hover:border-[color:var(--color-line2)] transition"
          >
            Meet the hunter
          </Link>
        </div>
      </section>

      {/* the $205 window */}
      <section className="grid gap-6 md:grid-cols-[1fr_1.1fr] items-stretch">
        <div className="panel p-6 flex flex-col justify-between">
          <div>
            <div className="eyebrow mb-3">the whole game</div>
            <div className="mono text-[34px] leading-none tracking-tight">
              HF ={" "}
              <span className="text-[color:var(--color-keel)]">price</span>
              <span className="text-[color:var(--color-faint)]"> / </span>
              1794.87
            </div>
            <p className="mt-4 text-[14px] leading-relaxed text-[color:var(--color-muted)]">
              Health Factor is a straight line in price. Everything the protocol
              decides lives inside a{" "}
              <span className="text-[color:var(--color-ink)] font-medium">$205 window</span>{" "}
              between liquidation and opening health. Hide where you act inside
              that window and an attacker is blind.
            </p>
          </div>
          <div className="mt-6 mono text-[40px] font-semibold text-[color:var(--color-keel)]">
            $205
            <span className="ml-3 eyebrow align-middle">$1,795 → $2,000</span>
          </div>
        </div>

        <div className="panel overflow-hidden">
          <div className="grid grid-cols-[auto_1fr_auto] eyebrow border-b hairline">
            <div className="px-5 py-2.5">HF</div>
            <div className="px-5 py-2.5">note</div>
            <div className="px-5 py-2.5 text-right">price</div>
          </div>
          {HF_LINES.map((l, i) => (
            <div
              key={l.hf}
              className={`grid grid-cols-[auto_1fr_auto] items-center ${
                i < HF_LINES.length - 1 ? "border-b hairline" : ""
              }`}
            >
              <div className="px-5 py-3.5 mono text-[18px]">{l.hf}</div>
              <div className="px-5 py-3.5 text-[13px] text-[color:var(--color-muted)]">
                {l.note}
              </div>
              <div className="px-5 py-3.5 mono text-[18px] text-right text-[color:var(--color-keel)]">
                {l.price}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* three doors */}
      <section className="grid gap-4 md:grid-cols-3">
        {CARDS.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="panel p-5 group hover:border-[color:var(--color-line2)] transition-colors flex flex-col"
          >
            <div className="eyebrow text-[color:var(--color-keel)]">{c.kicker}</div>
            <h3 className="mt-3 text-[18px] font-semibold">{c.title}</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-[color:var(--color-muted)] flex-1">
              {c.body}
            </p>
            <div className="mt-4 mono text-[12px] text-[color:var(--color-faint)] group-hover:text-[color:var(--color-keel)] transition-colors">
              open →
            </div>
          </Link>
        ))}
      </section>

      {/* one-liner strip */}
      <section className="panel p-6">
        <div className="grid gap-6 sm:grid-cols-3 mono text-[13px]">
          <div>
            <div className="text-[color:var(--color-danger)] font-semibold mb-1">STARTER</div>
            <div className="text-[color:var(--color-muted)]">
              Fixed threshold. Public and constant — one observed liquidation reveals
              exactly where it acts. Forever.
            </div>
          </div>
          <div>
            <div className="text-[color:var(--color-keel)] font-semibold mb-1">KEEL</div>
            <div className="text-[color:var(--color-muted)]">
              Sealed policy, per-round jitter. Every trigger is a fresh secret draw the
              adversary can never pin down.
            </div>
          </div>
          <div>
            <div className="text-[color:var(--color-keel)] font-semibold mb-1">PROOF</div>
            <div className="text-[color:var(--color-muted)]">
              keccak commitment + signed EIP-712 receipts. Reveal at the end: the number
              was sealed the whole time and never changed.
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

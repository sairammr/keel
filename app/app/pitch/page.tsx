import Link from "next/link";
import { GlyphJitter } from "@/components/HeroViz";

export const metadata = { title: "KEEL — pitch" };

/* binary search locating a fixed threshold: brackets converge to a point */
function BinarySearchViz() {
  const steps = [
    { x: 60, w: 440 },
    { x: 170, w: 220 },
    { x: 226, w: 110 },
    { x: 254, w: 54 },
  ];
  return (
    <svg viewBox="0 0 560 120" className="w-full max-w-[620px] block" aria-hidden>
      <line x1="40" x2="520" y1="60" y2="60" stroke="var(--color-line2)" strokeWidth="1" />
      <text x="40" y="100" fontSize="10" fill="var(--color-faint)" fontFamily="var(--font-mono)">
        $1,795
      </text>
      <text x="520" y="100" textAnchor="end" fontSize="10" fill="var(--color-faint)" fontFamily="var(--font-mono)">
        $2,000
      </text>
      {steps.map((s, i) => (
        <g key={i} stroke="var(--color-danger)" strokeWidth="2" opacity="0">
          <line x1={s.x} x2={s.x + s.w} y1={60} y2={60} />
          <line x1={s.x} x2={s.x} y1={48} y2={72} />
          <line x1={s.x + s.w} x2={s.x + s.w} y1={48} y2={72} />
          <animate
            attributeName="opacity"
            values="0;1;1;0"
            keyTimes={`0;${0.08 + i * 0.02};0.85;1`}
            begin={`${i * 0.9}s`}
            dur="6s"
            repeatCount="indefinite"
          />
        </g>
      ))}
      <circle cx="281" cy="60" r="6" fill="var(--color-danger)" opacity="0">
        <animate attributeName="opacity" values="0;0;1;1;0" keyTimes="0;0.6;0.66;0.85;1" dur="6s" repeatCount="indefinite" />
        <animate attributeName="r" values="6;6;9;6;6" keyTimes="0;0.6;0.66;0.72;1" dur="6s" repeatCount="indefinite" />
      </circle>
      <text x="281" y="36" textAnchor="middle" fontSize="11" fill="var(--color-danger)" fontFamily="var(--font-mono)" opacity="0">
        FOUND
        <animate attributeName="opacity" values="0;0;1;1;0" keyTimes="0;0.6;0.66;0.85;1" dur="6s" repeatCount="indefinite" />
      </text>
    </svg>
  );
}

/* commit → receipts → reveal pipeline drawing itself */
function PipelineViz({ light }: { light?: boolean }) {
  const ink = light ? "#fff" : "var(--color-keel)";
  const boxes = [
    { x: 20, label: "COMMIT", sub: "hash sealed on-chain" },
    { x: 220, label: "RECEIPTS", sub: "EIP-712 per action" },
    { x: 420, label: "REVEAL", sub: "anyone re-checks" },
  ];
  return (
    <svg viewBox="0 0 560 110" className="w-full max-w-[640px] block" aria-hidden>
      {boxes.map((b, i) => (
        <g key={b.label}>
          <rect x={b.x} y={20} width={120} height={44} fill="none" stroke={ink} strokeWidth="1.6" strokeDasharray="330" strokeDashoffset="330">
            <animate attributeName="stroke-dashoffset" values="330;0;0" keyTimes={`0;${0.15 + i * 0.12};1`} begin="0s" dur="7s" repeatCount="indefinite" />
          </rect>
          <text x={b.x + 60} y={46} textAnchor="middle" fontSize="12" fontFamily="var(--font-mono)" fill={ink} opacity="0">
            {b.label}
            <animate attributeName="opacity" values="0;0;1;1" keyTimes={`0;${0.12 + i * 0.12};${0.18 + i * 0.12};1`} dur="7s" repeatCount="indefinite" />
          </text>
          <text x={b.x + 60} y={84} textAnchor="middle" fontSize="9.5" fontFamily="var(--font-mono)" fill={light ? "rgba(255,255,255,.6)" : "var(--color-muted)"} opacity="0">
            {b.sub}
            <animate attributeName="opacity" values="0;0;1;1" keyTimes={`0;${0.16 + i * 0.12};${0.22 + i * 0.12};1`} dur="7s" repeatCount="indefinite" />
          </text>
        </g>
      ))}
      {[160, 360].map((x, i) => (
        <path key={x} d={`M ${x - 16} 42 L ${x + 52} 42 M ${x + 44} 36 L ${x + 52} 42 L ${x + 44} 48`} fill="none" stroke={ink} strokeWidth="1.4" strokeDasharray="90" strokeDashoffset="90">
          <animate attributeName="stroke-dashoffset" values="90;90;0;0" keyTimes={`0;${0.2 + i * 0.12};${0.28 + i * 0.12};1`} dur="7s" repeatCount="indefinite" />
        </path>
      ))}
    </svg>
  );
}

const SLIDES_DIVIDER = { borderColor: "var(--color-ink)" } as const;

export default function PitchPage() {
  return (
    <div className="deck">
      {/* 01 — title */}
      <section className="slide" style={SLIDES_DIVIDER}>
        <span className="no">01 / 08</span>
        <div className="eyebrow mb-6">ethonline 2026 · chainlink cre · t1 confidential workflow + t3 liquidation protection</div>
        <h1 className="display text-[clamp(56px,9vw,130px)]">
          KEEL<span className="it">.</span>
        </h1>
        <p className="lead mt-6 text-[19px] max-w-[46ch]">
          The starter hides the number. Keel hides the number, hides what the number
          will do next, and <strong>proves the number never changed</strong>.
        </p>
      </section>

      {/* 02 — problem */}
      <section className="slide" style={SLIDES_DIVIDER}>
        <span className="no">02 / 08</span>
        <div className="eyebrow mb-4">the problem</div>
        <h2 className="display text-[clamp(30px,4.6vw,56px)] max-w-[20ch]">
          Every defense bot broadcasts its own trigger.
        </h2>
        <p className="lead mt-5">
          Action or inaction at each price is one bit of a binary search. Three pushes
          locate a fixed threshold to ±0.005 HF — a <strong>$9 price window</strong>.
          A located threshold plus a public reserve is a drain plan, not a defense.
        </p>
        <div className="mt-8">
          <BinarySearchViz />
        </div>
        <p className="mono mt-6 text-[12px] text-[color:var(--color-muted)]">
          real precedent: a $521M short publicly hunted on Hyperliquid · Solend&apos;s $170M
          seizure panic over one visible position
        </p>
      </section>

      {/* 03 — the field */}
      <section className="slide band" style={SLIDES_DIVIDER}>
        <span className="no">03 / 08</span>
        <div className="eyebrow mb-4">the playing field</div>
        <h2 className="display text-[clamp(40px,7vw,96px)]">$205.</h2>
        <p className="lead mt-5 max-w-[52ch]">
          Health factor is a straight line in price: HF = price / 1794.87. The entire
          game — opening health, every trigger, liquidation — lives between $2,000 and
          $1,795. Hide where you act inside that window, and keep it hidden under
          observation, or lose.
        </p>
        <div className="mono mt-8 text-[13px]" style={{ color: "rgba(255,255,255,.75)" }}>
          HF 1.114 ⇔ $2,000 · HF 1.03 ⇔ $1,849 · HF 1.00 ⇔ $1,795
        </div>
      </section>

      {/* 04 — fix 1 */}
      <section className="slide" style={SLIDES_DIVIDER}>
        <span className="no">04 / 08</span>
        <div className="grid gap-10 md:grid-cols-[1.2fr_0.8fr] items-center">
          <div>
            <div className="eyebrow mb-4">fix one — secrecy that survives observation</div>
            <h2 className="display text-[clamp(30px,4.6vw,56px)]">
              The tripwire <span className="it">moves.</span>
            </h2>
            <p className="lead mt-5">
              trigger = clamp(base + k·σ + jitter(HMAC(salt, level))). One fresh draw per
              price level, shifted <strong>only upward</strong> — randomness can make Keel
              act earlier, never later, so it never costs survival. No sequence of
              observations narrows the base below the jitter width. Non-invertible, by
              construction.
            </p>
          </div>
          <div className="flex justify-center scale-[2.2] origin-center py-10">
            <GlyphJitter />
          </div>
        </div>
      </section>

      {/* 05 — fix 2 */}
      <section className="slide" style={SLIDES_DIVIDER}>
        <span className="no">05 / 08</span>
        <div className="eyebrow mb-4">fix two — secrecy you don&apos;t have to trust</div>
        <h2 className="display text-[clamp(30px,4.6vw,56px)] max-w-[18ch]">
          Sealed envelope, opened after the match.
        </h2>
        <p className="lead mt-5">
          Before the scenario starts, keccak(policy ‖ salt) goes on-chain. Every defense
          carries an EIP-712 receipt signed by a key derived inside the enclave. Reveal
          afterward, and anyone recomputes every round from public logs. That&apos;s the
          difference between <em>private</em> and <strong>provably unchanged</strong>.
        </p>
        <div className="mt-10">
          <PipelineViz />
        </div>
      </section>

      {/* 06 — proof */}
      <section className="slide" style={SLIDES_DIVIDER}>
        <span className="no">06 / 08</span>
        <div className="eyebrow mb-4">we shipped the attacker</div>
        <h2 className="display text-[clamp(30px,4.6vw,56px)] max-w-[20ch]">
          A real Bayesian hunter. It wins against the starter. It loses to Keel.
        </h2>
        <div className="grid sm:grid-cols-3 border mt-9" style={{ borderColor: "var(--color-ink)" }}>
          {[
            ["starter, next trigger", "0 bp", "located in 3 observations — stop-huntable forever", "var(--color-danger)"],
            ["keel, next trigger", "≥ 300 bp", "fresh draw every level — floored by jitter, no matter how long it watches", "var(--color-keel)"],
            ["live on sepolia", "CONSISTENT", "commit → 2 signed defenses → reveal → every round re-verified", "var(--color-ok)"],
          ].map(([k, v, s, c], i) => (
            <div key={k as string} className={`p-6 ${i < 2 ? "sm:border-r border-b sm:border-b-0" : ""}`} style={{ borderColor: "var(--color-ink)" }}>
              <div className="eyebrow">{k}</div>
              <div className="mono mt-3 text-[26px] font-semibold" style={{ color: c as string }}>
                {v}
              </div>
              <div className="mt-2 text-[12.5px] text-[color:var(--color-muted)]">{s}</div>
            </div>
          ))}
        </div>
        <p className="mono mt-6 text-[12px] text-[color:var(--color-muted)]">
          scored over 40 training markets: keel 82.15 mean, 0 liquidations — same protection as the
          best fixed threshold (82.22), except that threshold is extractable and keel&apos;s is not
        </p>
      </section>

      {/* 07 — who it's for */}
      <section className="slide" style={SLIDES_DIVIDER}>
        <span className="no">07 / 08</span>
        <div className="eyebrow mb-4">who it&apos;s for</div>
        <h2 className="display text-[clamp(30px,4.6vw,56px)]">
          Anyone whose position is <span className="it">public.</span>
        </h2>
        <div className="grid md:grid-cols-3 gap-8 mt-9">
          {[
            ["Leverage loopers", "Billions in looped staked-ETH debt sits near HF 1.05. Defend it without publishing the level where forced buys happen."],
            ["Funds & treasuries", "Run a private defense, then prove to LPs and token holders that the committed policy ran unchanged."],
            ["Automation providers", "Today's position automation runs public triggers. Keel is the confidential drop-in — with receipts as your honesty proof."],
          ].map(([t, b]) => (
            <div key={t as string}>
              <div className="font-bold text-[16px] tracking-[-0.01em]">{t}</div>
              <p className="mt-2 text-[13.5px] leading-relaxed text-[color:var(--color-muted)]">{b}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 08 — status + close */}
      <section className="slide band">
        <span className="no">08 / 08</span>
        <div className="eyebrow mb-4">status</div>
        <h2 className="display text-[clamp(34px,5.4vw,72px)] max-w-[16ch]">
          Private smart contracts you can still audit.
        </h2>
        <div className="grid md:grid-cols-2 gap-10 mt-9 max-w-[900px]">
          <div>
            <div className="mono text-[12px] mb-3" style={{ color: "rgba(255,255,255,.65)" }}>
              REAL, TODAY
            </div>
            <ul className="flex flex-col gap-2 text-[14px]" style={{ color: "rgba(255,255,255,.9)" }}>
              <li>· byte-proven copy of the official contract, 75 passing tests</li>
              <li>· CRE confidential workflow — simulates within production quotas</li>
              <li>· live Sepolia run: commit → receipts → reveal → ALL ROUNDS CONSISTENT</li>
              <li>· the Hunter adversary + in-browser verifier</li>
            </ul>
          </div>
          <div>
            <div className="mono text-[12px] mb-3" style={{ color: "rgba(255,255,255,.65)" }}>
              HONESTLY PENDING
            </div>
            <ul className="flex flex-col gap-2 text-[14px]" style={{ color: "rgba(255,255,255,.9)" }}>
              <li>· DON deployment — gated on CRE Early Access</li>
              <li>· official challenge join() — one-shot, fires on go</li>
              <li>· TEE path simulated, stated plainly — receipt key is salt-derived, not attestation</li>
            </ul>
          </div>
        </div>
        <div className="mt-12 flex flex-wrap gap-3">
          <Link href="/verify" className="btn sm" style={{ background: "#fff", borderColor: "#fff", color: "var(--color-keel)" }}>
            Verify the run <span className="arw">→</span>
          </Link>
          <Link href="/" className="btn ghost sm" style={{ color: "#fff", borderColor: "rgba(255,255,255,.4)" }}>
            Back to keel
          </Link>
        </div>
      </section>
    </div>
  );
}

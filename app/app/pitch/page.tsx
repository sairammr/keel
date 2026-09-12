import Link from "next/link";
import { GlyphJitter } from "@/components/HeroViz";
import { etherscanTx, etherscanAddr } from "@/lib/deployment";

export const metadata = { title: "KEEL — pitch" };

const PROD = {
  challenge: "0x88574e7Cc0027afd04951daa09B64d4441931ba1",
  participant: "0x481ab1C25907dC363d3e6Ee03aE5e651387e9Fe3",
  joinTx: "0x6a918f1241d0a33275100818e530a456b74b495f5d67b6063b1ac7ddeb7d3297",
  policyCommit: "0xACbf2d364817AB8c42C6573C748702BE0f7aAA6b",
  commitTx: "0x1a97b6fb0cd73fdffbaf24006a01713e6b30cec79e1cae7f64b334872fa3d7a2",
  commitHash: "0xc6d21b2d4b7ebc85dd80809866ba5c2830ff1155e48716d4cea9affc5ce1e355",
  commitBlock: "11691103",
} as const;

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

/* architecture: two triggers → CRE workflow (TEE + vault secrets) → Sepolia */
function ArchViz() {
  const ink = "var(--color-ink)";
  const keel = "var(--color-keel)";
  const muted = "var(--color-muted)";
  const mono = "var(--font-mono)";
  return (
    <svg viewBox="0 0 680 250" className="w-full max-w-[760px] block" aria-hidden>
      {/* triggers */}
      <rect x="10" y="40" width="150" height="52" fill="none" stroke={ink} strokeWidth="1.4" />
      <text x="85" y="62" textAnchor="middle" fontSize="11" fontFamily={mono} fill={ink}>CRON · 60s</text>
      <text x="85" y="78" textAnchor="middle" fontSize="9" fontFamily={mono} fill={muted}>heartbeat</text>
      <rect x="10" y="118" width="150" height="52" fill="none" stroke={ink} strokeWidth="1.4" />
      <text x="85" y="140" textAnchor="middle" fontSize="11" fontFamily={mono} fill={ink}>LOG TRIGGER</text>
      <text x="85" y="156" textAnchor="middle" fontSize="9" fontFamily={mono} fill={muted}>PriceUpdate → instant</text>
      {/* arrows into workflow */}
      <path d="M 160 66 L 196 66 M 189 61 L 196 66 L 189 71" fill="none" stroke={ink} strokeWidth="1.3" />
      <path d="M 160 144 L 196 144 M 189 139 L 196 144 L 189 149" fill="none" stroke={ink} strokeWidth="1.3" />
      {/* CRE workflow box */}
      <rect x="198" y="24" width="256" height="162" fill="none" stroke={keel} strokeWidth="1.8" />
      <text x="326" y="46" textAnchor="middle" fontSize="11.5" fontFamily={mono} fill={keel} fontWeight="600">CRE CONFIDENTIAL WORKFLOW</text>
      <rect x="216" y="60" width="220" height="58" fill="var(--color-wash)" stroke={keel} strokeWidth="1.2" />
      <text x="326" y="84" textAnchor="middle" fontSize="10.5" fontFamily={mono} fill={keel}>handlerInTee</text>
      <text x="326" y="102" textAnchor="middle" fontSize="9" fontFamily={mono} fill={muted}>AWS Nitro enclave · us-west-2</text>
      <rect x="216" y="128" width="220" height="42" fill="none" stroke={keel} strokeWidth="1.2" strokeDasharray="4 3" />
      <text x="326" y="146" textAnchor="middle" fontSize="9.5" fontFamily={mono} fill={keel}>VAULT DON · 4 secrets</text>
      <text x="326" y="161" textAnchor="middle" fontSize="8.5" fontFamily={mono} fill={muted}>policy · salt · rpc · signer key</text>
      {/* arrows to sepolia */}
      <path d="M 454 76 L 512 76 M 505 71 L 512 76 L 505 81" fill="none" stroke={ink} strokeWidth="1.3" />
      <text x="483" y="66" textAnchor="middle" fontSize="8.5" fontFamily={mono} fill={muted}>one batched read</text>
      <path d="M 512 132 L 454 132 M 461 127 L 454 132 L 461 137" fill="none" stroke={keel} strokeWidth="1.3" />
      <text x="483" y="122" textAnchor="middle" fontSize="8.5" fontFamily={mono} fill={keel}>defend tx + EIP-712 receipt</text>
      {/* sepolia box */}
      <rect x="514" y="52" width="156" height="106" fill="none" stroke={ink} strokeWidth="1.4" />
      <text x="592" y="80" textAnchor="middle" fontSize="11" fontFamily={mono} fill={ink}>SEPOLIA</text>
      <text x="592" y="100" textAnchor="middle" fontSize="8.5" fontFamily={mono} fill={muted}>ChallengeLending</text>
      <text x="592" y="115" textAnchor="middle" fontSize="8.5" fontFamily={mono} fill={muted}>PolicyCommit · Receipts</text>
      <text x="592" y="130" textAnchor="middle" fontSize="8.5" fontFamily={mono} fill={muted}>commit sealed pre-start</text>
      {/* status word out the bottom */}
      <path d="M 326 186 L 326 214 M 321 207 L 326 214 L 331 207" fill="none" stroke={ink} strokeWidth="1.3" />
      <text x="326" y="234" textAnchor="middle" fontSize="9.5" fontFamily={mono} fill={ink}>
        handler returns one word — IDLE · SAFE · DEFENDED — nothing numeric leaves the enclave
      </text>
    </svg>
  );
}

const RESULTS = [
  ["Keel — committed policy", "81.48", "79.53", "0 / 5", "1,146,950", true],
  ["Tuned grid winner", "81.38", "79.55", "0 / 5", "1,200,650", false],
  ["Starter 1.08 / 1.15", "81.39", "79.46", "0 / 5", "1,197,800", false],
  ["Do nothing", "42.08", "40.79", "5 / 5", "0", false],
] as const;

const SLIDES_DIVIDER = { borderColor: "var(--color-ink)" } as const;

function ProofRow({
  label,
  value,
  href,
  accent,
  ok,
}: {
  label: string;
  value: string;
  href: string;
  accent?: boolean;
  ok?: boolean;
}) {
  const color = ok ? "var(--color-ok)" : accent ? "var(--color-keel)" : "var(--color-ink)";
  const external = href.startsWith("http");
  return (
    <div className="border hairline bg-[color:var(--color-panel2)] p-4">
      <div className="eyebrow mb-1.5">{label}</div>
      <a
        className="mono text-[12px] break-all underline"
        style={{ color }}
        href={href}
        {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
      >
        {value}
      </a>
    </div>
  );
}

export default function PitchPage() {
  return (
    <div className="deck">
      {/* 01 — title */}
      <section className="slide" style={SLIDES_DIVIDER}>
        <span className="no">01 / 10</span>
        <div className="eyebrow mb-6">ethonline 2026 · chainlink cre · best confidential workflow + liquidation protection challenge</div>
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
        <span className="no">02 / 10</span>
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
        <span className="no">03 / 10</span>
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
        <span className="no">04 / 10</span>
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
        <span className="no">05 / 10</span>
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

      {/* 06 — architecture */}
      <section className="slide" style={SLIDES_DIVIDER}>
        <span className="no">06 / 10</span>
        <div className="eyebrow mb-4">architecture — chainlink cre</div>
        <h2 className="display text-[clamp(30px,4.6vw,56px)] max-w-[20ch]">
          The policy never leaves the enclave.
        </h2>
        <p className="lead mt-5 max-w-[58ch]">
          Two triggers wake the workflow — a 60s cron heartbeat and a{" "}
          <span className="mono">PriceUpdate</span> log trigger for instant reaction. The
          handler runs in a TEE, pulls policy, salt, RPC and signer key from Vault DON
          secrets, reads the chain in one batched call, defends when armed, and reports
          a single status word.
        </p>
        <div className="mt-9">
          <ArchViz />
        </div>
      </section>

      {/* 07 — the attacker */}
      <section className="slide" style={SLIDES_DIVIDER}>
        <span className="no">07 / 10</span>
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
          the hunter&apos;s posterior over keel&apos;s trigger is floored by the jitter width —
          watching every action forever still leaves a ≥300 bp band. try it live on /hunter.
        </p>
      </section>

      {/* 08 — results */}
      <section className="slide" style={SLIDES_DIVIDER}>
        <span className="no">08 / 10</span>
        <div className="eyebrow mb-4">results — the 5 official challenge scenarios</div>
        <h2 className="display text-[clamp(30px,4.6vw,56px)] max-w-[20ch]">
          Zero liquidations. Full continuity. Least capital.
        </h2>
        <div className="overflow-x-auto mt-9 border" style={{ borderColor: "var(--color-ink)" }}>
          <table className="w-full mono text-[13px]" style={{ minWidth: 640 }}>
            <thead>
              <tr className="eyebrow text-left" style={{ background: "var(--color-wash)" }}>
                <th className="py-2.5 px-4">strategy</th>
                <th className="py-2.5 pr-4 text-right">mean score</th>
                <th className="py-2.5 pr-4 text-right">worst</th>
                <th className="py-2.5 pr-4 text-right">liquidated</th>
                <th className="py-2.5 pr-4 text-right">capital used</th>
              </tr>
            </thead>
            <tbody>
              {RESULTS.map(([name, mean, worst, liq, cap, us]) => (
                <tr
                  key={name}
                  className="border-t hairline"
                  style={us ? { background: "var(--color-wash)" } : undefined}
                >
                  <td className="py-2.5 px-4 font-semibold" style={{ color: us ? "var(--color-keel)" : liq === "5 / 5" ? "var(--color-danger)" : "var(--color-ink)" }}>
                    {name}
                  </td>
                  <td className="py-2.5 pr-4 text-right" style={us ? { color: "var(--color-keel)", fontWeight: 600 } : undefined}>{mean}</td>
                  <td className="py-2.5 pr-4 text-right">{worst}</td>
                  <td className="py-2.5 pr-4 text-right" style={{ color: liq === "5 / 5" ? "var(--color-danger)" : "var(--color-ok)" }}>{liq}</td>
                  <td className="py-2.5 pr-4 text-right">{cap}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mono mt-6 text-[12px] text-[color:var(--color-muted)] max-w-[80ch]">
          exact README price paths, engine = byte-proven ContractMirror. per scenario: gradual 80.23 ·
          crash 79.53 · wick 83.56 · two-stage 80.28 · safe-vol 83.78 — loan continuity a full 20/20 in
          every one. the committed policy beats the tuned grid winner on the official paths, survives
          with the least capital of any surviving strategy, and do-nothing liquidates in all five.
        </p>
      </section>

      {/* 09 — on-chain proof */}
      <section className="slide" style={SLIDES_DIVIDER}>
        <span className="no">09 / 10</span>
        <div className="eyebrow mb-4">on-chain, right now — ethereum sepolia</div>
        <h2 className="display text-[clamp(30px,4.6vw,56px)] max-w-[20ch]">
          Joined. Sealed before start. <span className="it">Check us.</span>
        </h2>
        <div className="grid md:grid-cols-2 gap-3 mt-9 max-w-[980px]">
          <ProofRow
            label="official challenge contract · ChallengeLending"
            value={PROD.challenge}
            href={etherscanAddr(PROD.challenge)}
          />
          <ProofRow
            label="keel participant — joined #8"
            value={PROD.participant}
            href={etherscanAddr(PROD.participant)}
          />
          <ProofRow label="join() tx" value={PROD.joinTx} href={etherscanTx(PROD.joinTx)} />
          <ProofRow
            label={`policy hash committed BEFORE scenario start · block ${PROD.commitBlock}`}
            value={PROD.commitTx}
            href={etherscanTx(PROD.commitTx)}
            accent
          />
          <ProofRow
            label="the sealed commitment · keccak(policy ‖ salt)"
            value={PROD.commitHash}
            href={etherscanAddr(PROD.policyCommit)}
            accent
          />
          <ProofRow
            label="staging dry-run · commit → 2 defends → reveal"
            value="ALL ROUNDS CONSISTENT — independently re-derived"
            href="/verify"
            ok
          />
        </div>
        <p className="mono mt-6 text-[12px] text-[color:var(--color-muted)] max-w-[76ch]">
          the commit lands at block {PROD.commitBlock} — before the scenario starts. whatever the
          market does, the policy that defends is provably the one sealed here. reveal comes after
          scores publish; the /verify page then re-derives every round from public logs.
        </p>
      </section>

      {/* 10 — tracks + close */}
      <section className="slide band">
        <span className="no">10 / 10</span>
        <div className="eyebrow mb-4">the tracks</div>
        <h2 className="display text-[clamp(34px,5.4vw,72px)] max-w-[16ch]">
          Private smart contracts you can still audit.
        </h2>
        <div className="grid md:grid-cols-2 gap-8 mt-9 max-w-[900px]">
          {[
            ["BEST CONFIDENTIAL WORKFLOW", "handlerInTee on AWS Nitro · 4 Vault DON secrets · cron + log trigger · one batched read · one-word status — and secrecy you can verify: commit → EIP-712 receipts signed in-enclave → reveal."],
            ["LIQUIDATION PROTECTION CHALLENGE", "0 liquidations and 20/20 loan continuity on all 5 official scenarios, least capital of any surviving strategy — with a trigger no observer can locate."],
          ].map(([t, b]) => (
            <div key={t} className="border p-5" style={{ borderColor: "rgba(255,255,255,.35)" }}>
              <div className="mono text-[12px] mb-2" style={{ color: "#fff" }}>{t}</div>
              <p className="text-[13.5px] leading-relaxed" style={{ color: "rgba(255,255,255,.85)" }}>{b}</p>
            </div>
          ))}
        </div>
        <div className="grid md:grid-cols-2 gap-10 mt-10 max-w-[900px]">
          <div>
            <div className="mono text-[12px] mb-3" style={{ color: "rgba(255,255,255,.65)" }}>
              REAL, TODAY
            </div>
            <ul className="flex flex-col gap-2 text-[14px]" style={{ color: "rgba(255,255,255,.9)" }}>
              <li>· joined the official challenge — participant #8, policy sealed on-chain pre-start</li>
              <li>· CRE confidential workflow in a TEE — both triggers simulate green</li>
              <li>· live Sepolia run: commit → signed receipts → reveal → ALL ROUNDS CONSISTENT</li>
              <li>· the Hunter adversary + independent verifier, byte-proven contract mirror</li>
            </ul>
          </div>
          <div>
            <div className="mono text-[12px] mb-3" style={{ color: "rgba(255,255,255,.65)" }}>
              HONESTLY PENDING
            </div>
            <ul className="flex flex-col gap-2 text-[14px]" style={{ color: "rgba(255,255,255,.9)" }}>
              <li>· DON deployment — early-access queue; simulation is what&apos;s judged</li>
              <li>· the official scenario window — runs post-deadline; our commit already binds it</li>
              <li>· receipt key is salt-derived, not attestation-bound — stated plainly</li>
            </ul>
          </div>
        </div>
        <div className="mt-12 flex flex-wrap gap-3">
          <Link href="/verify" className="btn sm" style={{ background: "#fff", borderColor: "#fff", color: "var(--color-keel)" }}>
            Verify the run <span className="arw">→</span>
          </Link>
          <Link href="/hunter" className="btn ghost sm" style={{ color: "#fff", borderColor: "rgba(255,255,255,.4)" }}>
            Attack it
          </Link>
          <Link href="/" className="btn ghost sm" style={{ color: "#fff", borderColor: "rgba(255,255,255,.4)" }}>
            Back to keel
          </Link>
        </div>
      </section>
    </div>
  );
}

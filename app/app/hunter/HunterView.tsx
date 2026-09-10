"use client";

import { useEffect, useRef, useState } from "react";
import type { Posterior, AttackResult } from "@/lib/hunter";
import { HeatStrip } from "@/components/HeatStrip";

export function HunterView({
  intel,
  attack,
  jitterBp,
  markets,
}: {
  intel: { keel: Posterior; starter: Posterior };
  attack: AttackResult;
  jitterBp: number;
  markets: number;
}) {
  return (
    <div className="flex flex-col gap-6">
      <section className="grid gap-4 lg:grid-cols-2">
        <IntelPanel
          tone="danger"
          title="STARTER"
          sub="fixed threshold · no secret"
          post={intel.starter}
          jitterBp={jitterBp}
          markets={markets}
        />
        <IntelPanel
          tone="keel"
          title="KEEL"
          sub="sealed base + per-round jitter"
          post={intel.keel}
          jitterBp={jitterBp}
          markets={markets}
        />
      </section>

      <AttackConsole attack={attack} />

      <div className="eyebrow text-center">
        across {markets} markets the starter&apos;s 90% band is{" "}
        <span className="text-[color:var(--color-danger)]">{intel.starter.widthBp} bp</span>{" "}
        — Keel&apos;s is{" "}
        <span className="text-[color:var(--color-keel)]">{intel.keel.widthBp} bp</span>,
        floored by the {jitterBp} bp jitter it can never see under
      </div>
    </div>
  );
}

function IntelPanel({
  tone,
  title,
  sub,
  post,
  jitterBp,
  markets,
}: {
  tone: "keel" | "danger";
  title: string;
  sub: string;
  post: Posterior;
  jitterBp: number;
  markets: number;
}) {
  const color = tone === "keel" ? "var(--color-keel)" : "var(--color-danger)";
  // The Hunter "pins" an agent when it resolves the trigger tighter than the jitter floor.
  const pinned = post.widthBp < jitterBp;
  return (
    <div className="panel p-4 flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <div>
          <span className="mono text-[15px] font-semibold" style={{ color }}>
            {title}
          </span>
          <span className="eyebrow ml-2">{sub}</span>
        </div>
        <span
          className="mono text-[11px] px-2 py-0.5 border"
          style={{ borderColor: color, color }}
        >
          {pinned ? "PINNED" : "SECRET HELD"}
        </span>
      </div>

      <div>
        <div className="eyebrow mb-1.5">
          M1 · posterior on trigger · {markets} markets aggregated
        </div>
        <HeatStrip post={post} tone={tone} />
      </div>

      <div className="grid grid-cols-3 gap-px bg-[color:var(--color-line)] border hairline">
        {[
          ["M1 width", `${post.widthBp} bp`],
          ["M2 · b width", `${post.bWidthBp} bp`],
          ["hunt price", `$${post.huntPriceUsd}`],
        ].map(([k, v], idx) => (
          <div key={k} className="bg-[color:var(--color-panel)] px-2 py-2 text-center">
            <div className="eyebrow text-[9px]">{k}</div>
            <div
              className="mono text-[15px] mt-0.5"
              style={{ color: idx === 0 ? color : "var(--color-ink)" }}
            >
              {v}
            </div>
          </div>
        ))}
      </div>
      <p className="mono text-[11px] text-[color:var(--color-muted)] leading-relaxed">
        posterior width: <span style={{ color }}>{post.widthBp} bp</span>
        {tone === "keel"
          ? ` — bounded below by the ${jitterBp} bp jitter (M2 b-width ${post.bWidthBp} bp). The band cannot close below it, no matter how many observations.`
          : " — collapses toward a point. Watch it act a few times and the number is yours."}
      </p>
    </div>
  );
}

function AttackConsole({ attack }: { attack: AttackResult }) {
  const N = attack.taps.length;
  const [step, setStep] = useState(N);
  const [playing, setPlaying] = useState(false);
  const [x1000, setX1000] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!playing) return;
    timer.current = setInterval(() => {
      setStep((s) => {
        if (s >= N) {
          setPlaying(false);
          return N;
        }
        return s + 1;
      });
    }, 600);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [playing, N]);

  const i = Math.min(step, N);
  const shown = attack.taps.slice(0, Math.max(1, i));
  const forced = shown.filter((t) => t.acted).length;
  const burned = shown.reduce(
    (a, t) => a + (t.acted ? (t.amountVeth * t.priceUsd) : 0),
    0,
  );
  const reserveNow = shown[shown.length - 1]?.reserveAfter ?? attack.reserveStart;
  const scale = x1000 ? 1000 : 1;
  const money = (v: number) => "$" + Math.round(v * scale).toLocaleString("en-US");

  return (
    <section className="panel p-5 flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="eyebrow mb-1">the attack · live controller</div>
          <h2 className="text-[17px] font-semibold">
            tapping price to ${attack.huntPriceUsd} · milking the reserve
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (step >= N) setStep(1);
              setPlaying((p) => !p);
            }}
            className="mono text-[12px] px-4 py-2 bg-[color:var(--color-hunt)] text-white font-semibold hover:opacity-90"
          >
            {playing ? "❚❚ pause" : step >= N ? "▶ replay" : "▶ attack"}
          </button>
          <button
            onClick={() => {
              setPlaying(false);
              setStep(N);
            }}
            className="mono text-[12px] px-3 py-2 border hairline hover:border-[color:var(--color-line2)]"
          >
            skip
          </button>
          <button
            onClick={() => setX1000((v) => !v)}
            className={`mono text-[12px] px-3 py-2 border ${
              x1000
                ? "border-[color:var(--color-warn)] text-[color:var(--color-warn)]"
                : "hairline text-[color:var(--color-muted)]"
            }`}
            title="scale $ figures ×1000 — the bounty framing"
          >
            ×1000
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Counter label="capital burned" value={money(burned)} tone="hunt" />
        <Counter label="forced actions" value={`${forced} / ${shown.length} taps`} />
        <Counter
          label="reserve"
          value={`${reserveNow.toFixed(2)} / ${attack.reserveStart.toFixed(2)} vETH`}
          tone="keel"
        />
      </div>

      {/* reserve trajectory + tap ladder */}
      <ReserveChart attack={attack} step={i} />

      <div className="overflow-x-auto">
        <table className="w-full mono text-[12px]">
          <thead>
            <tr className="eyebrow text-left border-b hairline">
              <th className="py-1.5 pr-3">tap</th>
              <th className="py-1.5 pr-3">price</th>
              <th className="py-1.5 pr-3">HF</th>
              <th className="py-1.5 pr-3">forced?</th>
              <th className="py-1.5 pr-3">deposit</th>
              <th className="py-1.5 pr-3 text-right">reserve after</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((t, k) => (
              <tr key={k} className="border-b hairline last:border-0">
                <td className="py-1.5 pr-3">{String(k + 1).padStart(2, "0")}</td>
                <td className="py-1.5 pr-3">${t.priceUsd.toFixed(0)}</td>
                <td className="py-1.5 pr-3">{(t.hfBp / 10000).toFixed(3)}</td>
                <td className="py-1.5 pr-3">
                  {t.acted ? (
                    <span className="text-[color:var(--color-hunt)]">forced</span>
                  ) : (
                    <span className="text-[color:var(--color-keel)]">shrugged</span>
                  )}
                </td>
                <td className="py-1.5 pr-3">
                  {t.acted ? `${t.amountVeth.toFixed(2)} vETH` : "—"}
                </td>
                <td className="py-1.5 pr-3 text-right">{t.reserveAfter.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="eyebrow">
        Keel restores clear of its arm in one move per level, so after the first tap the
        attacker&apos;s pushes land on a position already above trigger — the reserve stops
        bleeding. ×1000: {money(attack.capitalBurnedUsd)} spent to drain{" "}
        {(attack.scaledReserveDrained / 1000).toFixed(2)}k vETH of framing value.
      </p>
    </section>
  );
}

function Counter({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "hunt" | "keel";
}) {
  const color =
    tone === "hunt"
      ? "var(--color-hunt)"
      : tone === "keel"
        ? "var(--color-keel)"
        : "var(--color-ink)";
  return (
    <div className="border hairline bg-[color:var(--color-panel2)] p-3">
      <div className="eyebrow text-[9px] mb-1">{label}</div>
      <div className="mono text-[22px]" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

function ReserveChart({ attack, step }: { attack: AttackResult; step: number }) {
  const W = 1000;
  const H = 120;
  const padL = 34;
  const padR = 10;
  const padT = 10;
  const padB = 16;
  const traj = attack.reserveVethTrace;
  const n = traj.length;
  const maxR = Math.max(attack.reserveStart, ...traj);
  const x = (i: number) => padL + (i / Math.max(1, n - 1)) * (W - padL - padR);
  const y = (r: number) => padT + (1 - r / maxR) * (H - padT - padB);
  const shown = Math.max(2, Math.min(n, step + 1));
  const pts = traj
    .slice(0, shown)
    .map((r, i) => `${x(i)},${y(r)}`)
    .join(" ");

  return (
    <div>
      <div className="eyebrow mb-2">defender vETH reserve · the milk line</div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full block">
        {[0, maxR / 2, maxR].map((g) => (
          <g key={g}>
            <line
              x1={padL}
              x2={W - padR}
              y1={y(g)}
              y2={y(g)}
              stroke="var(--color-line)"
              strokeWidth={1}
            />
            <text
              x={padL - 5}
              y={y(g) + 3}
              textAnchor="end"
              className="mono"
              fontSize={8}
              fill="var(--color-faint)"
            >
              {g.toFixed(1)}
            </text>
          </g>
        ))}
        <polyline points={pts} fill="none" stroke="var(--color-keel)" strokeWidth={1.8} />
        {traj.slice(0, shown).map((r, i) => (
          <circle key={i} cx={x(i)} cy={y(r)} r={2.4} fill="var(--color-keel)" />
        ))}
      </svg>
    </div>
  );
}

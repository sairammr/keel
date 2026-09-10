"use client";

import { useEffect, useRef, useState } from "react";
import type { Run } from "@/lib/engine";
import type { Posterior } from "@/lib/hunter";
import { HfChart } from "@/components/HfChart";
import { HeatStrip } from "@/components/HeatStrip";

export interface ReplayData {
  id: string;
  name: string;
  family: string;
  blurb: string;
  keel: Run;
  starter: Run;
  keelPost: Posterior;
  starterPost: Posterior;
}

const FAMILY_LABEL: Record<string, string> = {
  readme: "README",
  train: "TRAIN",
  test: "TEST",
};

export function ReplayView({ data }: { data: ReplayData[] }) {
  const [scenId, setScenId] = useState(data[0]!.id);
  const scen = data.find((d) => d.id === scenId)!;
  const n = scen.keel.ticks.length;
  const [step, setStep] = useState(n);
  const [playing, setPlaying] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setStep(n);
    setPlaying(false);
  }, [scenId, n]);

  useEffect(() => {
    if (!playing) return;
    timer.current = setInterval(() => {
      setStep((s) => {
        if (s >= n) {
          setPlaying(false);
          return n;
        }
        return s + 1;
      });
    }, 520);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [playing, n]);

  const idx = Math.min(step, n) - 1;
  const kTick = scen.keel.ticks[Math.max(0, idx)]!;

  const restart = () => {
    setStep(1);
    setPlaying(true);
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="panel p-4 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="eyebrow">scenario</span>
          <select
            value={scenId}
            onChange={(e) => setScenId(e.target.value)}
            className="mono text-[13px] bg-[color:var(--color-panel2)] border hairline px-3 py-1.5 text-[color:var(--color-ink)] outline-none focus:border-[color:var(--color-line2)]"
          >
            {data.map((d) => (
              <option key={d.id} value={d.id}>
                [{FAMILY_LABEL[d.family]}] {d.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (step >= n) setStep(1);
              setPlaying((p) => !p);
            }}
            className="mono text-[12px] px-3 py-1.5 bg-[color:var(--color-keel)] text-[color:var(--color-bg)] font-semibold hover:opacity-90"
          >
            {playing ? "❚❚ pause" : "▶ play"}
          </button>
          <button
            onClick={restart}
            className="mono text-[12px] px-3 py-1.5 border hairline hover:border-[color:var(--color-line2)]"
          >
            ⟲ restart
          </button>
          <button
            onClick={() => {
              setPlaying(false);
              setStep((s) => Math.max(1, s - 1));
            }}
            className="mono text-[12px] px-2.5 py-1.5 border hairline hover:border-[color:var(--color-line2)]"
          >
            ◀
          </button>
          <button
            onClick={() => {
              setPlaying(false);
              setStep((s) => Math.min(n, s + 1));
            }}
            className="mono text-[12px] px-2.5 py-1.5 border hairline hover:border-[color:var(--color-line2)]"
          >
            ▶
          </button>
        </div>

        <div className="flex items-center gap-3 flex-1 min-w-[200px]">
          <input
            type="range"
            min={1}
            max={n}
            value={step}
            onChange={(e) => {
              setPlaying(false);
              setStep(Number(e.target.value));
            }}
            className="flex-1 accent-[color:var(--color-keel)]"
          />
          <span className="mono text-[12px] text-[color:var(--color-muted)] w-20 text-right">
            lvl {String(Math.min(step, n)).padStart(2, "0")}/{n}
          </span>
        </div>

        <div className="mono text-[12px] text-[color:var(--color-muted)]">
          <span className="text-[color:var(--color-keel)]">${kTick.priceUsd.toFixed(0)}</span>
          <span className="text-[color:var(--color-faint)]"> · HF </span>
          {(kTick.hfBpAfter / 10000).toFixed(3)}
        </div>
      </div>

      <p className="text-[13px] text-[color:var(--color-muted)] -mt-1">{scen.blurb}</p>

      <div className="grid gap-4 lg:grid-cols-2">
        <AgentPanel
          tone="danger"
          title="STARTER"
          subtitle="fixed 1.08 / 1.15 threshold"
          run={scen.starter}
          step={step}
          post={scen.starterPost}
        />
        <AgentPanel
          tone="keel"
          title="KEEL"
          subtitle="sealed policy · per-round jitter"
          run={scen.keel}
          step={step}
          post={scen.keelPost}
        />
      </div>

      <div className="eyebrow text-center">
        dashed line = the trigger the Hunter is chasing · strip = its real posterior over
        this market · full cross-market campaign on the{" "}
        <a href="/hunter" className="text-[color:var(--color-keel)] link-underline">
          Hunter page
        </a>
      </div>
    </div>
  );
}

function AgentPanel({
  tone,
  title,
  subtitle,
  run,
  step,
  post,
}: {
  tone: "keel" | "danger";
  title: string;
  subtitle: string;
  run: Run;
  step: number;
  post: Posterior;
}) {
  const color = tone === "keel" ? "var(--color-keel)" : "var(--color-danger)";
  const s = run.score;
  return (
    <div className="panel p-4 flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <div>
          <span className="mono text-[15px] font-semibold" style={{ color }}>
            {title}
          </span>
          <span className="eyebrow ml-2">{subtitle}</span>
        </div>
        <span
          className="mono text-[11px] px-2 py-0.5 border"
          style={{
            borderColor: run.liquidated ? "var(--color-danger)" : "var(--color-line)",
            color: run.liquidated ? "var(--color-danger)" : "var(--color-muted)",
          }}
        >
          {run.liquidated ? "LIQUIDATED" : "SURVIVED"}
        </span>
      </div>

      <HfChart ticks={run.ticks} color={tone} step={step} />

      <div>
        <div className="eyebrow mb-1.5 flex items-center justify-between">
          <span>hunter · M1 posterior on trigger (this market)</span>
          <span>{post.widthBp} bp wide</span>
        </div>
        <HeatStrip post={post} tone={tone} />
      </div>

      <div className="grid grid-cols-5 gap-px bg-[color:var(--color-line)] border hairline mt-1">
        {[
          ["survive", s.survive.toFixed(0), "/40"],
          ["debtTime", s.debtTime.toFixed(1), "/20"],
          ["capEff", s.capEff.toFixed(1), "/15"],
          ["discip", s.discipline.toFixed(1), "/10"],
          ["total", s.total.toFixed(1), "/85"],
        ].map(([k, v, max], i) => (
          <div key={k} className="bg-[color:var(--color-panel)] px-2 py-2 text-center">
            <div className="eyebrow text-[9px]">{k}</div>
            <div
              className="mono text-[15px] mt-0.5"
              style={{ color: i === 4 ? color : "var(--color-ink)" }}
            >
              {v}
              <span className="text-[color:var(--color-faint)] text-[9px]">{max}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-between mono text-[11px] text-[color:var(--color-muted)]">
        <span>{run.actions} actions</span>
        <span>${run.capitalUsd.toFixed(0)} deployed</span>
      </div>
    </div>
  );
}

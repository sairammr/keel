"use client";

import { useState } from "react";
import { ReplayView, type ReplayData } from "./ReplayView";
import type { ChainRun } from "@/lib/runs";
import { HfChart } from "@/components/HfChart";

export function ReplayTabs({ engine, chain }: { engine: ReplayData[]; chain: ChainRun | null }) {
  const [source, setSource] = useState<"engine" | "chain">("engine");
  const onChain = source === "chain" && chain != null;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-4">
        <span className="eyebrow">source</span>
        <div className="seg">
          <button className={source === "engine" ? "on" : ""} onClick={() => setSource("engine")}>
            ENGINE (LIVE)
          </button>
          <button
            className={source === "chain" ? "on" : ""}
            disabled={!chain}
            onClick={() => chain && setSource("chain")}
          >
            {chain ? "CHAIN (RECORDED)" : "CHAIN (UNAVAILABLE)"}
          </button>
        </div>
        <span className="text-[12.5px] text-[color:var(--color-muted)]">
          {onChain
            ? "Keel's real Sepolia run, reconstructed from events by packages/verifier — every action links to Etherscan."
            : "Both defenders driven through the same market by the real controller + ContractMirror."}
        </span>
      </div>

      {onChain ? <ChainReplay run={chain!} /> : <ReplayView data={engine} />}
    </div>
  );
}

function ChainReplay({ run }: { run: ChainRun }) {
  const consistent = run.verdict === "ALL ROUNDS CONSISTENT";
  return (
    <div className="panel p-5 flex flex-col gap-4">
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <div className="flex items-baseline gap-2.5">
          <span className="mono text-[15px] font-semibold text-[color:var(--color-keel)]">
            KEEL
          </span>
          <span className="eyebrow">
            recorded on-chain · {run.participant.slice(0, 6)}…{run.participant.slice(-4)}
          </span>
        </div>
        <span className={`chip ${consistent ? "ok" : "bad"}`}>
          <span className="d" />
          {run.liquidated ? "LIQUIDATED" : "SURVIVED"} · {run.verdict}
        </span>
      </div>

      <HfChart ticks={run.ticks} color="keel" step={run.ticks.length} />

      <div className="overflow-x-auto">
        <table className="w-full mono text-[12px]">
          <thead>
            <tr
              className="eyebrow text-left"
              style={{ background: "var(--color-wash)" }}
            >
              <th className="py-2 px-3">rnd</th>
              <th className="py-2 px-3">price</th>
              <th className="py-2 px-3">HF</th>
              <th className="py-2 px-3">arm</th>
              <th className="py-2 px-3">target</th>
              <th className="py-2 px-3">action</th>
              <th className="py-2 px-3 text-right">tx</th>
            </tr>
          </thead>
          <tbody>
            {run.ticks.map((t) => (
              <tr key={t.round} className="border-b hairline last:border-0">
                <td className="py-1.5 px-3">{String(t.round).padStart(2, "0")}</td>
                <td className="py-1.5 px-3">${t.priceUsd.toFixed(0)}</td>
                <td className="py-1.5 px-3">{(t.hfBp / 10000).toFixed(3)}</td>
                <td className="py-1.5 px-3 text-[color:var(--color-keel)]">
                  {(t.armBp / 10000).toFixed(3)}
                </td>
                <td className="py-1.5 px-3 text-[color:var(--color-faint)]">
                  {(t.targetBp / 10000).toFixed(3)}
                </td>
                <td className="py-1.5 px-3">
                  {t.acted ? (
                    <span className="text-[color:var(--color-keel)] font-medium">
                      {t.kind} ${t.amountUsd?.toFixed(0)}
                    </span>
                  ) : (
                    <span className="text-[color:var(--color-muted)]">—</span>
                  )}
                </td>
                <td className="py-1.5 px-3 text-right">
                  {run.txByRound[t.round] ? (
                    <a
                      className="link-underline"
                      href={run.txByRound[t.round]}
                      target="_blank"
                      rel="noreferrer"
                    >
                      etherscan ↗
                    </a>
                  ) : (
                    <span className="text-[color:var(--color-faint)]">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="eyebrow">
        dashed line = the trigger, revealed on-chain and re-derived by the verifier ·
        every action row links to its real Sepolia transaction
      </p>
    </div>
  );
}

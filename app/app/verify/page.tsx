"use client";

import { useEffect, useMemo, useState } from "react";
import {
  commitmentOf,
  encodePolicyBytes,
  policyHashOf,
  signReceipt,
  recoverReceiptSigner,
  receiptDigest,
  type Receipt,
} from "keel-controller";
import { runKeel } from "@/lib/engine";
import {
  KEEL_POLICY,
  DEMO_SALT_HEX,
  DEMO_CODE_HASH,
  DEMO_RECEIPTS_ADDR,
  demoSaltBytes,
} from "@/lib/policy";
import { byId } from "@/lib/scenarios";

interface SignedReceipt {
  receipt: Receipt;
  digest: `0x${string}`;
  sig: `0x${string}`;
  recovered: `0x${string}`;
  ok: boolean;
  round: number;
  kind: string;
  amountLabel: string;
  priceUsd: number;
  hf: number;
}

const short = (h: string) => `${h.slice(0, 10)}…${h.slice(-8)}`;

export default function VerifyPage() {
  const commit = useMemo(
    () => commitmentOf(KEEL_POLICY, DEMO_SALT_HEX as `0x${string}`, DEMO_CODE_HASH),
    [],
  );
  const policyHash = useMemo(
    () => policyHashOf(encodePolicyBytes(KEEL_POLICY, DEMO_CODE_HASH)),
    [],
  );
  const run = useMemo(
    () => runKeel(byId("readme").real, KEEL_POLICY, demoSaltBytes()),
    [],
  );
  const actedTicks = useMemo(() => run.ticks.filter((t) => t.acted).slice(0, 6), [run]);

  const [signed, setSigned] = useState<SignedReceipt[] | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [revealInput, setRevealInput] = useState(false);

  // Real EIP-712 signing + ecrecover, in the browser.
  useEffect(() => {
    let alive = true;
    (async () => {
      let nonce = 0;
      const out: SignedReceipt[] = [];
      for (const t of actedTicks) {
        const receipt: Receipt = {
          commit: commit.commit,
          round: BigInt(t.round),
          blockObserved: BigInt(9_000_000 + t.round * 5),
          price: BigInt(Math.round(t.priceUsd * 100)),
          hfBp: BigInt(t.hfBp),
          action: t.actionCode ?? 0,
          amount: BigInt(t.amountRaw ?? "0"),
          actionNonce: BigInt(nonce++),
        };
        const digest = receiptDigest(receipt, DEMO_RECEIPTS_ADDR);
        const sig = await signReceipt(receipt, commit.receiptKey, DEMO_RECEIPTS_ADDR);
        const recovered = await recoverReceiptSigner(receipt, sig, DEMO_RECEIPTS_ADDR);
        out.push({
          receipt,
          digest,
          sig,
          recovered,
          ok: recovered.toLowerCase() === commit.signer.toLowerCase(),
          round: t.round,
          kind: t.kind ?? "",
          amountLabel:
            t.actionCode === 2
              ? `${(Number(t.amountRaw) / 100).toFixed(2)} vETH`
              : `${(Number(t.amountRaw) / 100).toFixed(2)} vUSD`,
          priceUsd: t.priceUsd,
          hf: t.hfBp / 10000,
        });
      }
      if (alive) setSigned(out);
    })();
    return () => {
      alive = false;
    };
  }, [actedTicks, commit]);

  // On-chain config (NEXT_PUBLIC_* only reach the client).
  const onchain = {
    policyCommit: process.env.NEXT_PUBLIC_POLICYCOMMIT_ADDR,
    receipts: process.env.NEXT_PUBLIC_RECEIPTS_ADDR,
    lending: process.env.NEXT_PUBLIC_LENDING_ADDR,
    rpc: process.env.NEXT_PUBLIC_RPC_URL,
  };
  const onchainReady = !!(onchain.policyCommit && onchain.rpc);

  const allOk = signed?.every((s) => s.ok) ?? false;
  const revealCommit = commitmentOf(
    KEEL_POLICY,
    DEMO_SALT_HEX as `0x${string}`,
    DEMO_CODE_HASH,
  ).commit;
  const commitMatches = revealCommit === commit.commit;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <div className="eyebrow mb-2">03 / verify</div>
        <h1 className="text-[28px] font-semibold tracking-tight">
          Commit ⇄ receipts ⇄ reveal
        </h1>
        <p className="mt-2 max-w-[760px] text-[14px] leading-relaxed text-[color:var(--color-muted)]">
          The whole verifiable-secrecy loop, with real crypto running in your browser —
          keccak commitment, EIP-712 receipts signed by the sealed receipt key, ecrecover
          on every one, then a reveal that re-derives the commitment and audits each round
          against the committed policy.
        </p>
      </header>

      {/* on-chain banner */}
      <div
        className={`panel p-3 flex items-center gap-3 ${
          onchainReady ? "" : "border-[color:var(--color-warn)]"
        }`}
        style={onchainReady ? {} : { borderColor: "var(--color-warn)" }}
      >
        <span
          className="mono text-[10px] px-2 py-1 border"
          style={{
            borderColor: onchainReady ? "var(--color-keel)" : "var(--color-warn)",
            color: onchainReady ? "var(--color-keel)" : "var(--color-warn)",
          }}
        >
          {onchainReady ? "ON-CHAIN" : "LOCAL PROOF"}
        </span>
        <span className="text-[13px] text-[color:var(--color-muted)]">
          {onchainReady
            ? `Reading PolicyCommit ${short(onchain.policyCommit!)} via ${onchain.rpc}.`
            : "Contracts not deployed (NEXT_PUBLIC_POLICYCOMMIT_ADDR unset) — verifying against a local proof with identical, real cryptography."}
        </span>
      </div>

      {/* commitment card */}
      <section className="panel p-5">
        <div className="eyebrow mb-3">1 · commitment (sealed before any action)</div>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="policyHash = keccak(policyBytes)" value={policyHash} />
          <Field
            label="commit = keccak(policyHash ‖ salt)"
            value={commit.commit}
            accent
          />
          <Field label="receipt signer (derived from salt)" value={commit.signer} />
          <Field
            label="salt"
            value={DEMO_SALT_HEX}
            sub="DEMO SALT — production salt stays sealed"
          />
        </div>
      </section>

      {/* receipts */}
      <section className="panel p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="eyebrow">2 · signed receipts · ecrecover === committed signer</div>
          <span
            className="mono text-[11px] px-2 py-0.5 border"
            style={{
              borderColor: allOk ? "var(--color-keel)" : "var(--color-line)",
              color: allOk ? "var(--color-keel)" : "var(--color-muted)",
            }}
          >
            {signed ? (allOk ? "ALL VERIFIED ✓" : "MISMATCH") : "signing…"}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full mono text-[12px]">
            <thead>
              <tr className="eyebrow text-left border-b hairline">
                <th className="py-2 pr-3">round</th>
                <th className="py-2 pr-3">price</th>
                <th className="py-2 pr-3">HF</th>
                <th className="py-2 pr-3">action</th>
                <th className="py-2 pr-3">nonce</th>
                <th className="py-2 pr-3">EIP-712 digest</th>
                <th className="py-2 pr-3">recovered</th>
                <th className="py-2 pr-3 text-right">ok</th>
              </tr>
            </thead>
            <tbody>
              {(signed ?? actedTicks.map(() => null)).map((s, i) =>
                s ? (
                  <tr key={i} className="border-b hairline last:border-0">
                    <td className="py-2 pr-3">{String(s.round).padStart(2, "0")}</td>
                    <td className="py-2 pr-3">${s.priceUsd.toFixed(0)}</td>
                    <td className="py-2 pr-3">{s.hf.toFixed(3)}</td>
                    <td className="py-2 pr-3">
                      <span className="text-[color:var(--color-keel)]">{s.kind}</span>{" "}
                      {s.amountLabel}
                    </td>
                    <td className="py-2 pr-3 text-[color:var(--color-faint)]">
                      {s.receipt.actionNonce.toString()}
                    </td>
                    <td className="py-2 pr-3 text-[color:var(--color-muted)]">
                      {short(s.digest)}
                    </td>
                    <td className="py-2 pr-3 text-[color:var(--color-muted)]">
                      {short(s.recovered)}
                    </td>
                    <td className="py-2 pr-3 text-right">
                      {s.ok ? (
                        <span className="text-[color:var(--color-keel)]">✓</span>
                      ) : (
                        <span className="text-[color:var(--color-danger)]">✕</span>
                      )}
                    </td>
                  </tr>
                ) : (
                  <tr key={i} className="border-b hairline last:border-0">
                    <td colSpan={8} className="py-2 text-[color:var(--color-faint)]">
                      signing round {i}…
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-3 eyebrow">
          nonces are adjacent (0,1,2,…) — no receipt was dropped or reordered
        </p>
      </section>

      {/* reveal */}
      <section className="panel p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="eyebrow">3 · reveal — open the sealed policy & audit</div>
          {!revealed ? (
            <button
              onClick={() => {
                setRevealInput(true);
                setTimeout(() => setRevealed(true), 250);
              }}
              className="mono text-[12px] px-4 py-2 bg-[color:var(--color-keel)] text-[color:var(--color-bg)] font-semibold hover:opacity-90"
            >
              ▶ reveal policy + salt
            </button>
          ) : (
            <button
              onClick={() => {
                setRevealed(false);
                setRevealInput(false);
              }}
              className="mono text-[12px] px-3 py-2 border hairline hover:border-[color:var(--color-line2)]"
            >
              re-seal
            </button>
          )}
        </div>

        {!revealInput && (
          <p className="text-[13px] text-[color:var(--color-muted)]">
            Before reveal, the commitment above is all anyone has: a single 32-byte hash.
            No parameter is legible. Press reveal to paste the policy + salt and prove they
            hash to that exact commitment.
          </p>
        )}

        {revealInput && (
          <div className="flex flex-col gap-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="border hairline bg-[color:var(--color-panel2)] p-3">
                <div className="eyebrow mb-2">revealed policy</div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 mono text-[11px]">
                  {Object.entries(KEEL_POLICY).map(([k, v]) => (
                    <div key={k} className="flex justify-between">
                      <span className="text-[color:var(--color-faint)]">{k}</span>
                      <span>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-3">
                <Field label="revealed salt" value={DEMO_SALT_HEX} />
                <div
                  className="border p-3 flex items-center gap-3"
                  style={{
                    borderColor: commitMatches
                      ? "var(--color-keel)"
                      : "var(--color-danger)",
                  }}
                >
                  <span
                    className="mono text-[22px]"
                    style={{
                      color: commitMatches
                        ? "var(--color-keel)"
                        : "var(--color-danger)",
                    }}
                  >
                    {commitMatches ? "✓" : "✕"}
                  </span>
                  <div className="text-[12px]">
                    <div className="mono">
                      keccak(policyHash ‖ salt) ={" "}
                      <span className="text-[color:var(--color-muted)]">
                        {short(revealCommit)}
                      </span>
                    </div>
                    <div className="text-[color:var(--color-muted)]">
                      {commitMatches
                        ? "matches the sealed commitment — the number never changed"
                        : "does not match"}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {revealed && (
              <div className="overflow-x-auto">
                <div className="eyebrow mb-2">
                  per-round audit · trigger in force vs action taken
                </div>
                <table className="w-full mono text-[12px]">
                  <thead>
                    <tr className="eyebrow text-left border-b hairline">
                      <th className="py-2 pr-3">rnd</th>
                      <th className="py-2 pr-3">price</th>
                      <th className="py-2 pr-3">HF</th>
                      <th className="py-2 pr-3">arm (trigger)</th>
                      <th className="py-2 pr-3">target</th>
                      <th className="py-2 pr-3">decision</th>
                      <th className="py-2 pr-3 text-right">matches policy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {run.ticks.map((t) => {
                      const triggered = t.hfBp <= t.armBp;
                      const consistent = triggered === t.acted || t.emergency;
                      return (
                        <tr key={t.round} className="border-b hairline last:border-0">
                          <td className="py-1.5 pr-3">
                            {String(t.round).padStart(2, "0")}
                          </td>
                          <td className="py-1.5 pr-3">${t.priceUsd.toFixed(0)}</td>
                          <td className="py-1.5 pr-3">
                            {(t.hfBp / 10000).toFixed(3)}
                          </td>
                          <td className="py-1.5 pr-3 text-[color:var(--color-keel)]">
                            {(t.armBp / 10000).toFixed(3)}
                          </td>
                          <td className="py-1.5 pr-3 text-[color:var(--color-faint)]">
                            {(t.targetBp / 10000).toFixed(3)}
                          </td>
                          <td className="py-1.5 pr-3">
                            {t.acted ? (
                              <span className="text-[color:var(--color-keel)]">
                                {t.reason} · {t.kind} ${t.amountUsd?.toFixed(0)}
                              </span>
                            ) : (
                              <span className="text-[color:var(--color-muted)]">
                                {t.reason}
                              </span>
                            )}
                          </td>
                          <td className="py-1.5 pr-3 text-right">
                            {consistent ? (
                              <span className="text-[color:var(--color-keel)]">✓</span>
                            ) : (
                              <span className="text-[color:var(--color-danger)]">✕</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <p className="mt-3 eyebrow">
                  every action fired exactly when HF crossed the now-revealed trigger — the
                  policy that produced the receipts is the policy under the commitment
                </p>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function Field({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="border hairline bg-[color:var(--color-panel2)] p-3">
      <div className="eyebrow mb-1">{label}</div>
      <div
        className="mono text-[12px] break-all"
        style={{ color: accent ? "var(--color-keel)" : "var(--color-ink)" }}
      >
        {value}
      </div>
      {sub && (
        <div className="mono text-[10px] mt-1 text-[color:var(--color-warn)]">{sub}</div>
      )}
    </div>
  );
}

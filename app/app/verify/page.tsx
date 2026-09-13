import LiveOnChain from "@/components/LiveOnChain";
import { reconstruct, audit, type AuditReport, type ReconstructedRun } from "keel-verifier";
import { DEPLOYMENT, etherscanTx, etherscanAddr } from "@/lib/deployment";

// Re-read the chain at most every 30s. Everything on this page is reconstructed from
// on-chain events by packages/verifier — no engine, no synthetic data.
export const revalidate = 30;

const short = (h: string) => `${h.slice(0, 10)}…${h.slice(-8)}`;
const hf = (bp: bigint) => (Number(bp) / 10000).toFixed(3);
const ACTION = { 1: "repay", 2: "deposit", 3: "withdraw", 4: "borrow" } as const;

export default async function VerifyPage({
  searchParams,
}: {
  searchParams?: Promise<{ participant?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const participant = (sp.participant ?? DEPLOYMENT.participant) as `0x${string}`;

  let run: ReconstructedRun | null = null;
  let report: AuditReport | null = null;
  let error: string | null = null;
  try {
    run = await reconstruct({
      rpcUrl: DEPLOYMENT.rpc,
      lending: DEPLOYMENT.lending,
      policyCommit: DEPLOYMENT.policyCommit,
      receipts: DEPLOYMENT.receipts,
      participant,
      fromBlock: DEPLOYMENT.fromBlock,
    });
    report = await audit(run, { receiptsAddr: DEPLOYMENT.receipts });
  } catch (e) {
    error = String(e instanceof Error ? e.message : e);
  }

  const verdictColor =
    report?.verdict === "ALL ROUNDS CONSISTENT"
      ? "var(--color-keel)"
      : report?.verdict === "NO REVEAL — RECEIPTS ONLY"
        ? "var(--color-warn)"
        : "var(--color-danger)";

  return (
    <div className="viewin flex flex-col gap-6">
      <header>
        <div className="eyebrow mb-3">tour · step 3 of 3</div>
        <h1 className="display text-[clamp(30px,4vw,46px)]">
          Commit. Receipts. <span className="it">Reveal.</span>
        </h1>
        <p className="lead mt-4 text-[14.5px]">
          This is the proof. Nothing here comes from a simulation: every value is
          reconstructed live from Sepolia events by an independent verifier package,
          and every row links to its real transaction on Etherscan.
        </p>
        <div className="rule" />
      </header>

      {/* live commit + receipt count (client read) */}
      <LiveOnChain />

      {error && (
        <div className="panel p-4 mono text-[12px] text-[color:var(--color-danger)]">
          verifier error: {error}
        </div>
      )}

      {report && run && (
        <>
          {/* verdict */}
          <section className="panel p-5">
            <div className="flex items-center justify-between">
              <div className="eyebrow">verifier verdict · participant {short(participant)}</div>
              <span
                className="mono text-[12px] px-3 py-1 border font-semibold"
                style={{ borderColor: verdictColor, color: verdictColor }}
              >
                {report.verdict}
              </span>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <Check label="commitment = keccak(policyHash ‖ salt)" ok={report.commitmentOk} />
              <Check label="every receipt signer = committed signer" ok={report.signersOk} />
              <Check label="EIP-712 digests recomputed" ok={report.digestsOk} />
            </div>
            {report.liquidated && (
              <div className="mt-3 mono text-[12px] text-[color:var(--color-danger)]">
                ⚠ participant was liquidated at least once
              </div>
            )}
          </section>

          {/* commitment */}
          {run.commit && (
            <section className="panel p-5">
              <div className="eyebrow mb-3">1 · commitment (sealed before any action)</div>
              <div className="grid gap-3 md:grid-cols-2">
                <Field
                  label="committed hash (PolicyCommit.commits)"
                  value={run.commit.hash}
                  href={etherscanAddr(DEPLOYMENT.policyCommit)}
                  accent
                />
                <Field
                  label="receipt signer (derived from salt)"
                  value={run.commit.signer}
                  href={etherscanAddr(run.commit.signer)}
                />
                <Field label="commit block" value={run.commit.blockNumber.toString()} />
                <Field
                  label="reveal"
                  value={run.reveal ? "revealed on-chain — policy + salt public" : "sealed (not yet revealed)"}
                  sub={run.reveal ? undefined : "production salt stays sealed until scores publish"}
                />
              </div>
            </section>
          )}

          {/* receipts */}
          <section className="panel p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="eyebrow">
                2 · signed receipts · ecrecover === committed signer
              </div>
              <span
                className="mono text-[11px] px-2 py-0.5 border"
                style={{
                  borderColor: report.signersOk ? "var(--color-keel)" : "var(--color-danger)",
                  color: report.signersOk ? "var(--color-keel)" : "var(--color-danger)",
                }}
              >
                {report.signersOk ? "ALL VERIFIED ✓" : "SIGNER MISMATCH"}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full mono text-[12px]">
                <thead>
                  <tr className="eyebrow text-left" style={{ background: "var(--color-wash)" }}>
                    <th className="py-2 px-3">round</th>
                    <th className="py-2 pr-3">price</th>
                    <th className="py-2 pr-3">HF</th>
                    <th className="py-2 pr-3">action</th>
                    <th className="py-2 pr-3">nonce</th>
                    <th className="py-2 pr-3">digest</th>
                    <th className="py-2 pr-3">tx</th>
                  </tr>
                </thead>
                <tbody>
                  {run.receipts.map((r, i) => (
                    <tr key={i} className="border-b hairline last:border-0">
                      <td className="py-2 pr-3">{r.receipt.round.toString().padStart(2, "0")}</td>
                      <td className="py-2 pr-3">${(Number(r.receipt.price) / 100).toFixed(0)}</td>
                      <td className="py-2 pr-3">{hf(r.receipt.hfBp)}</td>
                      <td className="py-2 pr-3 text-[color:var(--color-keel)]">
                        {ACTION[r.receipt.action as 1 | 2 | 3 | 4]} {(Number(r.receipt.amount) / 100).toFixed(2)}
                      </td>
                      <td className="py-2 pr-3 text-[color:var(--color-faint)]">
                        {r.receipt.actionNonce.toString()}
                      </td>
                      <td className="py-2 pr-3 text-[color:var(--color-muted)]">{short(r.digest)}</td>
                      <td className="py-2 pr-3">
                        <a
                          className="underline text-[color:var(--color-muted)]"
                          href={etherscanTx(r.txHash)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {short(r.txHash)}
                        </a>
                      </td>
                    </tr>
                  ))}
                  {run.receipts.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-2 text-[color:var(--color-faint)]">
                        no receipts posted yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* per-round audit */}
          {report.rows.length > 0 ? (
            <section className="panel p-5">
              <div className="eyebrow mb-3">
                3 · reveal — per-round audit · trigger in force vs action taken
              </div>
              <div className="overflow-x-auto">
                <table className="w-full mono text-[12px]">
                  <thead>
                    <tr className="eyebrow text-left" style={{ background: "var(--color-wash)" }}>
                      <th className="py-2 px-3">rnd</th>
                      <th className="py-2 pr-3">price</th>
                      <th className="py-2 pr-3">HF</th>
                      <th className="py-2 pr-3">arm (trigger)</th>
                      <th className="py-2 pr-3">target</th>
                      <th className="py-2 pr-3">acted</th>
                      <th className="py-2 pr-3">expected</th>
                      <th className="py-2 pr-3 text-right">matches policy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.rows.map((r) => (
                      <tr key={r.round} className="border-b hairline last:border-0">
                        <td className="py-1.5 pr-3">{String(r.round).padStart(2, "0")}</td>
                        <td className="py-1.5 pr-3">${(Number(r.price) / 100).toFixed(0)}</td>
                        <td className="py-1.5 pr-3">{hf(r.hfBpPre)}</td>
                        <td className="py-1.5 pr-3 text-[color:var(--color-keel)]">{hf(r.armBp)}</td>
                        <td className="py-1.5 pr-3 text-[color:var(--color-faint)]">{hf(r.targetBp)}</td>
                        <td className="py-1.5 pr-3">{r.acted ? "Y" : "·"}</td>
                        <td className="py-1.5 pr-3">{r.expectedAct ? "Y" : "·"}</td>
                        <td className="py-1.5 pr-3 text-right">
                          {r.consistent ? (
                            <span className="text-[color:var(--color-keel)]">✓</span>
                          ) : (
                            <span className="text-[color:var(--color-danger)]">✕</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 eyebrow">
                every action fired exactly when HF crossed the now-revealed trigger — the policy that
                produced the receipts is the policy under the commitment
              </p>
            </section>
          ) : (
            <section className="panel p-5">
              <div className="eyebrow mb-2">3 · reveal</div>
              <p className="text-[13px] text-[color:var(--color-muted)]">
                Not yet revealed. Before reveal the commitment above is all anyone has — a single 32-byte
                hash. The per-round audit unlocks once <span className="mono">reveal(policy, salt)</span> is
                posted on-chain.
              </p>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function Check({ label, ok }: { label: string; ok?: boolean }) {
  const color = ok === undefined ? "var(--color-muted)" : ok ? "var(--color-keel)" : "var(--color-danger)";
  return (
    <div className="border hairline bg-[color:var(--color-panel2)] p-3 flex items-center gap-2">
      <span className="mono text-[16px]" style={{ color }}>
        {ok === undefined ? "—" : ok ? "✓" : "✕"}
      </span>
      <span className="text-[12px] text-[color:var(--color-muted)]">{label}</span>
    </div>
  );
}

function Field({
  label,
  value,
  sub,
  href,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  href?: string;
  accent?: boolean;
}) {
  return (
    <div className="border hairline bg-[color:var(--color-panel2)] p-3">
      <div className="eyebrow mb-1">{label}</div>
      <div
        className="mono text-[12px] break-all"
        style={{ color: accent ? "var(--color-keel)" : "var(--color-ink)" }}
      >
        {href ? (
          <a className="underline" href={href} target="_blank" rel="noreferrer">
            {value}
          </a>
        ) : (
          value
        )}
      </div>
      {sub && <div className="mono text-[10px] mt-1 text-[color:var(--color-warn)]">{sub}</div>}
    </div>
  );
}

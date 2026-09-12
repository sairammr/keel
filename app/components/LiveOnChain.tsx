"use client";

import { useEffect, useState } from "react";
import { createPublicClient, http, parseAbi } from "viem";
import { DEPLOYMENT, etherscanAddr } from "@/lib/deployment";

const POLICY_COMMIT_ABI = parseAbi([
  "function commits(address) view returns (bytes32 hash,address signer,uint64 blockNumber,uint64 timestamp)",
]);
const RECEIPTS_ABI = parseAbi(["function count(address) view returns (uint256)"]);

const ZERO = "0x0000000000000000000000000000000000000000000000000000000000000000";
const short = (h: string) => `${h.slice(0, 10)}…${h.slice(-8)}`;

interface Live {
  hash: `0x${string}`;
  signer: `0x${string}`;
  commitBlock: bigint;
  receipts: bigint;
}

export default function LiveOnChain() {
  const [live, setLive] = useState<Live | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const client = createPublicClient({ transport: http(DEPLOYMENT.rpc) });
        const [commit, receipts] = await Promise.all([
          client.readContract({ address: DEPLOYMENT.policyCommit, abi: POLICY_COMMIT_ABI, functionName: "commits", args: [DEPLOYMENT.participant] }) as Promise<readonly [`0x${string}`, `0x${string}`, bigint, bigint]>,
          client.readContract({ address: DEPLOYMENT.receipts, abi: RECEIPTS_ABI, functionName: "count", args: [DEPLOYMENT.participant] }) as Promise<bigint>,
        ]);
        if (alive) setLive({ hash: commit[0], signer: commit[1], commitBlock: commit[2], receipts });
      } catch (e) {
        if (alive) setErr(String(e instanceof Error ? e.message : e));
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const committed = live && live.hash !== ZERO;

  return (
    <section className="panel p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="eyebrow">live on-chain · read from Sepolia staging</div>
        <span className={`chip ${err ? "bad" : committed ? "ok" : ""}`}>
          <span className="d" />
          {err ? "RPC ERROR" : live ? (committed ? "ON-CHAIN" : "NO COMMIT") : "READING…"}
        </span>
      </div>

      <p className="text-[13px] text-[color:var(--color-muted)] mb-3">
        These values are read live from the deployed staging contracts — not generated. Participant{" "}
        <a className="underline" href={etherscanAddr(DEPLOYMENT.participant)} target="_blank" rel="noreferrer">
          {short(DEPLOYMENT.participant)}
        </a>
        .
      </p>

      {err && <div className="mono text-[12px] text-[color:var(--color-danger)]">{err}</div>}

      {live && (
        <div className="grid gap-3 md:grid-cols-2">
          <OnField label="committed hash (PolicyCommit.commits)" value={committed ? live.hash : "— none —"} href={etherscanAddr(DEPLOYMENT.policyCommit)} accent={!!committed} />
          <OnField label="committed receipt signer" value={live.signer} href={etherscanAddr(live.signer)} />
          <OnField label="commit block" value={live.commitBlock.toString()} />
          <OnField label="receipts posted (Receipts.count)" value={live.receipts.toString()} href={etherscanAddr(DEPLOYMENT.receipts)} accent />
        </div>
      )}
    </section>
  );
}

function OnField({ label, value, href, accent }: { label: string; value: string; href?: string; accent?: boolean }) {
  return (
    <div className="border hairline bg-[color:var(--color-panel2)] p-3">
      <div className="eyebrow mb-1">{label}</div>
      <div className="mono text-[12px] break-all" style={{ color: accent ? "var(--color-keel)" : "var(--color-ink)" }}>
        {href ? (
          <a className="underline" href={href} target="_blank" rel="noreferrer">
            {value}
          </a>
        ) : (
          value
        )}
      </div>
    </div>
  );
}

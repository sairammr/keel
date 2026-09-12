# ETHGlobal submission copy — paste-ready

Deadline: **Sept 13, 16:00 UTC**. Submit at ethglobal.com/events/ethonline2026/project.
Prizes to tick: **Chainlink T1 (Best Confidential Workflow, $2,000)** and
**Chainlink T3 (Automated Liquidation Protection Challenge, $500)**.
(T2 is continuity-only — repo must predate the event; keel doesn't qualify.)

## Project name
KEEL

## Tagline (≤ ~100 chars)
Liquidation protection whose strategy is sealed in a TEE — and provably never changed.

## Short description

Every automated DeFi strategy with a public trigger gets hunted: watch its transactions,
infer the threshold, push the price to it. KEEL is a liquidation-protection agent for the
Chainlink CRE challenge whose entire policy — trigger, target, capital caps, priorities —
lives only inside a Nitro enclave, moves unpredictably (volatility-adaptive + salt-jittered
thresholds), and still proves it played fair: the policy hash is committed on-chain before
the scenario starts, every defense posts an EIP-712 receipt signed inside the enclave, and
after the run the policy is revealed so anyone can re-derive every action. Private isn't
proof — KEEL is both.

On the five official challenge scenarios: 0 liquidations, full 20/20 loan continuity
(deposit-led defense keeps the debt open), and the least emergency capital of any surviving
strategy we benchmarked — while an unprotected position liquidates in all five.

## How it's made

- **Chainlink CRE Confidential Workflow** (`cre.handlerInTee`, AWS Nitro, us-west-2): a
  60s cron handler pulls 4 Vault secrets (packed policy JSON, commit salt, RPC URL, signing
  key), reconstructs the full challenge state in ONE batched JSON-RPC read, decides via the
  shared controller, signs repay/deposit + receipt transactions inside the enclave, and
  broadcasts them raw. The handler returns a single word (IDLE/SAFE/DEFENDED/…) — no policy
  value, threshold, or HF ever leaves the TEE. Passes `cre workflow simulate` under
  production quotas (≤5 secret fetches, ≤5 HTTP calls).
- **Controller** (pure TS, shared enclave/simulator/verifier): arm threshold =
  base + EWMA-volatility term + HMAC(salt, round) jitter; restore target gets an independent
  jitter draw so post-action HF doesn't leak arm+buffer. Emergency floor bypasses cooldown
  and caps. Action sizing enumerates deposit/repay/mixed candidates and picks the cheapest
  under the judges' own scoring weights — which is why defense is deposit-led and loan
  continuity stays at 20/20.
- **Verifiable secrecy**: `PolicyCommit` (keccak(policyHash‖salt) before start) +
  `Receipts` (EIP-712, salt-derived signer) + post-run reveal. `bun run verify` reconstructs
  every round from chain events alone → ALL ROUNDS CONSISTENT on our live Sepolia run.
- **Inference-attack analysis** (`docs/inference-attack.md` + `/hunter`): we model the
  attacker (Bayesian posterior over the trigger from public (HF, acted?) pairs) and show the
  posterior floor the jitter enforces; the attack console stop-hunts a fixed-threshold bot
  to liquidation while KEEL de-levers at the edge.
- **Faithful contract mirror**: byte-verified copy of the official `ChallengeLending`,
  property-tested against the deployed bytecode on Anvil; the scenario engine + tuner ran
  270 policy combos × 40 scenarios.
- Stack: Bun workspaces, TypeScript, viem, @noble (HMAC/secp256k1), Foundry, Next.js app
  (`/verify` server-rendered from live Sepolia, `/replay`, `/hunter`).

## On-chain (Ethereum Sepolia)

| What | Address / tx |
|---|---|
| Official challenge contract | `0x88574e7Cc0027afd04951daa09B64d4441931ba1` |
| KEEL participant (joined #8) | `0x481ab1C25907dC363d3e6Ee03aE5e651387e9Fe3` |
| join() tx | `0x6a918f1241d0a33275100818e530a456b74b495f5d67b6063b1ac7ddeb7d3297` |
| Policy commit (before start) | `0x1a97b6fb0cd73fdffbaf24006a01713e6b30cec79e1cae7f64b334872fa3d7a2` (block 11691103) |
| Staging full run (commit → 2 defends + receipts → reveal → verified) | see `docs/deployment/addresses.md` |

## Demo video beats (3½ min, script in docs/video-script.md)

1. **0:00 hook — the hunt.** `/hunter` attack console: a public fixed-threshold keeper gets
   stop-hunted to liquidation in a handful of observations. "This is every open-source bot."
2. **0:45 — the sealed agent.** `cre workflow simulate` live: TEE banner (AWS Nitro), batched
   read, one-word output. Point at the logs: zero numbers leave the enclave.
3. **1:30 — real run.** `/replay` (source: chain): Keel's actual Sepolia run, revealed trigger
   as a dashed line, two defends, every row an Etherscan link.
4. **2:15 — the proof.** `/verify`: commit block precedes start(), receipts table,
   ALL ROUNDS CONSISTENT. "One sealed policy produced every action — verified without
   ever exposing it during the game."
5. **2:50 — the scoreboard.** Official 5 scenarios: 0 liquidations, 20/20 continuity,
   least capital; do-nothing dies in all 5. Joined + committed on the official contract.
6. **3:20 — close.** "Sealed, unpredictable, provable. KEEL."

## User story (lead with this framing)

Ava runs a leveraged ETH position through a keeper bot. Last cycle a searcher read her
bot's config on GitHub, pushed the price to its known trigger, harvested the stop, and let
the market recover. Her choices used to be: publish the strategy and get hunted, or run a
black box her lender won't trust. KEEL removes the trade-off — the strategy runs sealed in
an enclave where even the node operators can't read it, its trigger moves so observers
can't corner it, and the commit→receipt→reveal chain gives her lender cryptographic proof
the sealed strategy — and nothing else — moved her money. Same story scales to funds
running LP capital under proprietary risk models: trade secrets for the manager,
accountability for the LPs, from one primitive.

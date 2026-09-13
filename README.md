# KEEL — verifiable-secrecy liquidation protection

> The starter hides the number. Keel hides the number, hides what the number will do next, and **proves the number never changed** — that is the difference between secrecy and *verifiable* secrecy.

Built at **ETHOnline 2026** for the Chainlink CRE tracks — **T1 Best Confidential Workflow** and **T3 Automated Liquidation Protection Challenge**.

**Live demo:** https://keel-ebon-six.vercel.app — `/` product · `/pitch` deck · `/replay` · `/hunter` · `/verify` · `/docs`

Official challenge contract (Sepolia): `ChallengeLending` `0x88574e7Cc0027afd04951daa09B64d4441931ba1`.

---

## The problem

A liquidation-protection bot has a *number*: the health factor (HF) at which it acts. The official starter puts that number in a TEE and calls it private. It isn't: every action / inaction pair is one bit of a binary search over the threshold. Three actions locate a fixed threshold to ±0.005 HF. That located threshold, plus the **public** on-chain reserve (`balanceOf`), is a stop-hunt target: push price to the line, force a defensive spend, repeat until the reserve is empty, then push through it.

With the real contract parameters the whole game is played in a **$205 window**:

```
HF(price) = price / 1794.87
  HF 1.114 ⇔ $2,000     HF 1.08 ⇔ $1,938
  HF 1.03  ⇔ $1,849     HF 1.00 ⇔ $1,795
```

`hf` is an integer ×100 and the on-chain liquidation test is `hf ≤ 100`, so a true HF of 1.009 liquidates. Keel treats **`hfBp < 10100` (HF 1.01)** as the liquidation line and puts an emergency override at HF 1.03.

## The idea

1. **Non-invertible from outputs.** `trigger = clamp(base + k·σ + jitter(HMAC(salt, round)))`. One fresh jitter draw per price level, **upward only** — it can only make Keel act *earlier*, never later, so it never costs survival. No sequence of observations narrows `base` below the jitter width (formal write-up: [`docs/inference-attack.md`](docs/inference-attack.md)).
2. **Provable without disclosure.** `keccak256(policyHash ‖ salt)` is committed to `PolicyCommit` on Sepolia by the enclave **before** the scenario starts. Every action carries an EIP-712 receipt signed by a key derived *inside the enclave* from the same salt. Reveal `(policyBytes, salt)` afterward and anyone recomputes every round's trigger from public `PriceUpdate` logs and checks each action matched the committed policy.
3. **Survival by construction.** A hard floor trigger and an emergency override sit *under* all the cleverness. The clever part only ever moves action earlier.

## How to verify (the point of the whole thing)

The `/verify` page does all three against **live Sepolia** via `packages/verifier` — no engine, no placeholder data:

1. **Commitment before start.** `PolicyCommit.commits(participant).blockNumber` precedes the `ChallengeStarted` block. The policy panel stays blank.
2. **Receipts.** Each `Receipts.post` carries `commit == commits[participant].hash` and an EIP-712 signature whose `ecrecover` equals the committed `signer`. The verifier independently reconstructs each round's pre-action HF from `PriceUpdate` logs — it does **not** trust the receipt's self-reported `hfBp`; a mismatch surfaces as `RECEIPT HF MISMATCH`.
3. **Reveal.** Paste `(policyBytes, salt)`; `keccak256(keccak256(policy) ‖ salt)` must equal the on-chain commit. Then every round's trigger is recomputed from public logs and each action/inaction is checked against the committed policy.

EIP-712 domain: `{ name: "KeelReceipts", version: "1", chainId: 11155111, verifyingContract }`. Deployed addresses + full tx record: [`docs/deployment/addresses.md`](docs/deployment/addresses.md).

## Run it

```bash
bun install                         # workspace install
bun run test                        # unit tests: controller 23 + scenario 14 + hunter 7 = 44
bun test workflow/                  # workflow unit tests (13): official-ABI decode, pre-start log exclusion, nonce/leg plan
bun run codehash --check            # controllerCodeHash in every config == reproducible source-tree hash
bun run contracts:test              # Solidity tests (13: ChallengeLending + PolicyCommit + Receipts)
(cd contracts && bun run script/fidelity.ts)   # local ChallengeLending == deployed official (bytecode MATCH)
bun run e2e                         # full loop on local Anvil: deploy→join→commit→crash→defend→receipt→reveal
bun run tune                        # grid search; prints winning policy + starter baselines
bun run replay --vs starter         # text side-by-side replay
(cd app && bun run dev)             # dashboard on :3000
```

CRE workflow (simulation needs no deploy approval):

```bash
cre workflow simulate workflow --target staging-settings --non-interactive --trigger-index 0 [--broadcast]
```

`bun run e2e` deploys the **byte-for-byte faithful** `ChallengeLending` copy + `PolicyCommit` + `Receipts` on a local Anvil and drives the whole lifecycle with the real controller: an undefended position liquidates (`hf100 = 99/95/93`), the defended one survives (`hf 117/113/110`), on-chain digests match off-chain, wrong-salt reveal reverts. Ends with `E2E PASSED`.

## Repo map

| Path | What |
|---|---|
| `packages/controller` | Pure TS. EWMA vol, HMAC jitter, trigger/hysteresis, cost solver, commitment + EIP-712 receipts. **The exact `decide()` in the enclave is the exact function the app and Hunter call** — one source of truth (`src/types.ts` is the frozen interface). |
| `packages/scenario` | Contract mirror (integer maths, cross-checked over 200 random sequences vs a real Anvil deployment), scenario generator, scoring mirror, grid tuner, replay. |
| `packages/hunter` | Real Bayesian adversary: M1 (fixed threshold) vs M2 (threshold + jitter), hunt price, attack sim. |
| `packages/verifier` | Independent chain-side verifier: reconstructs commits/receipts/HF from Sepolia events. Powers `/verify` and `bun run verify`. |
| `contracts` | Foundry. `PolicyCommit`, `Receipts` (EIP-712), + faithful `ChallengeLending` copy (`src/official/`), proven byte-for-byte vs the deployed contract (`script/fidelity.ts`). |
| `workflow` | Chainlink CRE `handlerInTee` confidential workflow. Commit-on-first-tick, receipts, no policy in logs. See [`workflow/README.md`](workflow/README.md). |
| `app` | Next.js dashboard: `/pitch` deck, split-screen replay, Hunter panel + attack, Verify/Reveal against live Sepolia. |
| `site` | Static GSAP scroll-story landing (no build step). |
| `scripts` | Live-run drivers: `run-scenario-live.ts`, `commit-prod.ts`, `demo-live.ts`, RPC checks. |
| `tests/e2e` | Full-lifecycle Anvil E2E. |

## Docs

| Doc | What |
|---|---|
| [`SUBMISSION.md`](SUBMISSION.md) | Full product write-up + run/verify instructions (canonical submission text) |
| [`docs/submission-form.md`](docs/submission-form.md) | Copy-paste answers for the ETHGlobal form |
| [`docs/inference-attack.md`](docs/inference-attack.md) | Threat model + proof the trigger can't be located below jitter width |
| [`docs/results.md`](docs/results.md) | Grid-search results; every number quoted anywhere traces here or to chain events |
| [`docs/deployment/addresses.md`](docs/deployment/addresses.md) | All deployed addresses + tx record (staging + official contract) |
| [`docs/video-pitch.md`](docs/video-pitch.md) | Demo video script |
| `docs/internal/` | Build-era planning docs (kept for provenance) |

## What is protected / what is not

- **Protected (enclave / Vault secrets):** all policy parameters, the salt (⇒ jitter draws + receipt-signing key + commitment), the wallet private key, the RPC credential.
- **Not protected (by design, and we say so):** the source code and binary are not confidential (per the Confidential Workflows docs). The Hunter M2 model **knows the algorithm** and still cannot narrow the threshold below the jitter width — confidentiality rests on the salted secret, not on the code being unknown (Kerckhoffs).
- The wallet reserve is `balanceOf` — always public. Keel's defence does not rely on hiding it.

> **On confidentiality (T1), stated plainly:** the receipt-signing key is derived deterministically from the salt (`keccak(salt‖"keel/receipt/v1") mod n`), not from hardware attestation — anyone holding the salt can reproduce it, which is by design (reveal must be reproducible). The confidential `handlerInTee` path has been **simulated** (`cre workflow simulate`), not yet run in a real DON/enclave — DON deployment needs CRE Early Access (`Deploy Access: Not enabled`). The live on-chain scenario ran the **same** controller code outside an attested TEE. Security of the *policy* rests on `armBp`/`targetBp` never leaving the enclave until reveal — the receipt schema enforces this (it carries no trigger fields).

## Assumptions (isolated, one-line swaps if organisers answer)

- Scoring formulas (capital-efficiency, discipline) are in `packages/scenario/src/scoring.ts`. Debt-time is the one verified formula.
- Scenario cadence is unknown; the tuner sweeps `dt ∈ {60,120,300}` and `cronPeriod ∈ {30,60}`.
- Whether `checkAllHF()` runs at every price update is unconfirmed; Keel is designed for the strict case.

---

*No policy parameter or salt is ever committed to this repo, written to a config file, or emitted in a log. The handler returns one-word statuses only: `COMMITTED` / `IDLE` / `SAFE` / `DEFENDED`.*

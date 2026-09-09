# KEEL — verifiable-secrecy liquidation protection

> The starter hides the number. Keel hides the number, hides what the number will do next, and proves the number never changed — that is the difference between secrecy and *verifiable* secrecy.

Built for **ETHOnline 2026** — Chainlink CRE tracks:
- **T3 — Automated Liquidation Protection Challenge**
- **T1 — Best Confidential Workflow**

Official challenge contract (Sepolia): `ChallengeLending` `0x88574e7Cc0027afd04951daa09B64d4441931ba1`.

---

## The problem

A liquidation-protection bot has a *number*: the health factor (HF) at which it acts. The official starter puts that number in a TEE and calls it private. It isn't: every action / inaction pair is one bit of a binary search over the threshold. Three actions locate a fixed threshold to ±0.005 HF. That located threshold, plus the **public** on-chain reserve (`balanceOf`), is a stop-hunt target.

With the real contract parameters the whole game is played in a **$205 window**:

```
HF(price) = price / 1794.87
  HF 1.114 ⇔ $2,000     HF 1.08 ⇔ $1,938
  HF 1.03  ⇔ $1,849     HF 1.00 ⇔ $1,795
```
`hf` is an integer ×100 and the on-chain liquidation test is `hf ≤ 100`, so a true HF of 1.009 liquidates. Keel treats **`hfBp < 10100` (HF 1.01)** as the liquidation line and puts an emergency override at HF 1.03.

## The idea

1. **Non-invertible from outputs.** `trigger = clamp(base + k·σ + jitter(HMAC(salt, round)))`. One fresh jitter draw per price level, **upward only** — it can only make Keel act *earlier*, never later, so it never costs survival. No sequence of observations narrows `base` below the jitter width `jmax` (proof sketch in `docs`/plan §4.4).
2. **Provable without disclosure.** `keccak256(policyHash ‖ salt)` is committed to `PolicyCommit` on Sepolia by the enclave **before** the scenario starts. Every action carries an EIP-712 receipt signed by a key derived *inside the enclave* from the same salt. Reveal `(policyBytes, salt)` afterward and anyone recomputes every round's trigger from public `PriceUpdate` logs and checks each action matched the committed policy.
3. **Survival by construction.** A hard floor trigger and an emergency override sit *under* all the cleverness. The clever part only ever moves action earlier.

## Monorepo

| Package | What | Status |
|---|---|---|
| `packages/controller` | Pure TS. EWMA vol, HMAC jitter, trigger/hysteresis, cost solver, commitment + EIP-712 receipts. Imported by **both** the enclave workflow and the app. | ✅ tested |
| `packages/scenario` | Contract mirror (integer maths), scenario generator, scoring mirror, grid tuner, replay. | ✅ tested |
| `packages/hunter` | Real Bayesian adversary: M1 (fixed threshold) vs M2 (threshold + jitter), hunt price, attack sim. | ✅ tested |
| `contracts` | Foundry. `PolicyCommit`, `Receipts` (EIP-712), + a faithful local copy of `ChallengeLending` + tokens for end-to-end testing. | ✅ tested |
| `workflow` | Chainlink CRE `handlerInTee` confidential workflow. Commit-on-first-tick, receipts, `pending` nonce, no policy in logs. | ✅ typechecks |
| `app` | Next.js 15 dashboard: split-screen replay, Hunter panel + attack, Verify/Reveal. | ✅ builds |

## The controller (shared code, one source of truth)

The exact `decide()` that runs in the enclave is the exact function the app's replay and the Hunter's attack simulator call. See `packages/controller/src/types.ts` for the frozen interface. All HF/price/token maths is in integer contract units (×100) to avoid boundary mismatch with the on-chain integer HF.

## How to verify (the point of the whole thing)

1. **Commitment before start.** `PolicyCommit.commits(participant).blockNumber` is earlier than the `ChallengeStarted` block. The policy panel stays blank.
2. **Receipts.** Each `Receipts.post` carries `commit == commits[participant].hash` and an EIP-712 signature whose `ecrecover` equals the committed `signer`. The action tx is at nonce `n`, its receipt at `n+1`, same EOA — visible on Etherscan.
3. **Reveal.** Paste `(policyBytes, salt)`; `keccak256(keccak256(policy) ‖ salt)` must equal the on-chain commit. Then every round's trigger is recomputed from public `PriceUpdate` logs and each action/inaction is checked against the committed policy.

The `/verify` page in the app does all three (on-chain mode against deployed addresses, and a local-proof mode with real in-browser hashing/signing). EIP-712 domain: `{ name: "KeelReceipts", version: "1", chainId: 11155111, verifyingContract }`.

## What is protected / what is not

- **Protected (in the enclave / Vault secrets):** all policy parameters, the salt (⇒ jitter draws + receipt-signing key + commitment), the wallet private key, the RPC credential.
- **Not protected (by design, and we say so):** the *source code and binary are not confidential* (per the Confidential Workflows docs). The Hunter M2 model **knows the algorithm** and still cannot narrow the threshold below the jitter width — confidentiality rests on the salted secret, not on the code being unknown (Kerckhoffs).
- The wallet reserve is `balanceOf` — always public. We display it as such; Keel's defence does not rely on hiding it.

## Run it

```bash
bun install                         # workspace install
bun test                            # controller + scenario + hunter unit tests
(cd contracts && forge test -vv)    # Solidity tests
bun run tune                        # grid search; prints winning policy + starter baselines
bun run replay --vs starter         # text side-by-side replay
(cd app && bun run dev)             # dashboard on :3000
```

CRE workflow (simulation needs no deploy approval):
```bash
cre workflow simulate workflow --target staging-settings --non-interactive --trigger-index 0 [--broadcast]
```

## Assumptions (isolated, one-line swaps if organisers answer)

- Scoring formulas (capital-efficiency, discipline) are in `packages/scenario/src/scoring.ts`. Debt-time is the one verified formula.
- Scenario cadence (seconds between price updates) is unknown; the tuner sweeps `dt ∈ {60,120,300}` and `cronPeriod ∈ {30,60}`.
- Whether `checkAllHF()` runs at every price update is unconfirmed; Keel is designed for the strict case (a check at every update).

---

*No policy parameter or salt is ever committed to this repo, written to a config file, or emitted in a log. The handler returns one-word statuses only: `COMMITTED` / `IDLE` / `SAFE` / `DEFENDED`.*

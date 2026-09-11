# KEEL — verifiable-secrecy liquidation protection

> The starter hides the number. Keel hides the number, hides what the number will do next, and proves the number never changed — that is the difference between secrecy and *verifiable* secrecy.

Built for **ETHOnline 2026** — Chainlink CRE tracks:
- **T3 — Automated Liquidation Protection Challenge**
- **T1 — Best Confidential Workflow**

Official challenge contract (Sepolia): `ChallengeLending` `0x88574e7Cc0027afd04951daa09B64d4441931ba1`.

## Status

Completion is tracked in `PLAN.md`. As of this commit:

- ✅ **Controller / scenario / hunter** — pure TS, unit-tested (44 tests).
- ✅ **P1.1 official on-chain ABI** — the workflow decodes the real `PriceUpdate(uint256,uint256)` and `Repay/Deposit/WithdrawCollateral/Borrow(address indexed user,uint256)` events; verified against the deployed contract's topic0.
- ✅ **P1.2 log range** — `startBlock` required (official `11661556`); PriceUpdate logs before `ChallengeStarted` are excluded.
- ✅ **P1.3 reproducible `controllerCodeHash`** — keccak of the source tree (not a build artifact); `bun run codehash --check`.
- ✅ **P1.4 faithful local `ChallengeLending`** — the local contract is a verbatim copy of the official 0.8.36 source (`contracts/src/official/`), **proven byte-for-byte** to the deployed contract via `bun run script/fidelity.ts` (metadata stripped). The TS mirror matches its exact integer maths (liquidation rounding, bounded debt-time, `burnFrom`, repeat liquidation, `borrow`, `minCollateral`), cross-checked over 200 random sequences against a real Anvil deployment. The on-chain deposit path is exercised in the E2E (funded by the 5.00 spare vETH `join()` mints).
- ⚠️ **Phase 2 evaluation** — the engine records post-action HF, so Hunter/verify numbers are not yet trustworthy (P2.1).
- ✅ **P3.1/P3.2 CRE runtime** — the workflow is a real `cre init`-shaped project (`project.yaml`, `workflow/workflow.yaml`, zod config, packed secrets, WASM-safe handler). `cre workflow simulate workflow --target staging-settings` compiles to WASM, runs the confidential `handlerInTee`, does the ≤5-call batched read against Sepolia, and returns a status. Quota-compliant (1 read + 1 send ≤ 5 HTTP calls).
- ✅ **Live on Sepolia (staging)** — faithful `ChallengeLending` + `PolicyCommit`/`Receipts` deployed; a full crash scenario ran on-chain: commit-before-start, real defends + EIP-712 receipts, reveal (see `docs/deployment/addresses.md`).
- ⚠️ **Deployment to the DON** — needs CRE Early Access (`Deploy Access: Not enabled`); simulation works without it.
- ⚠️ **Phase 4 app** — `/verify` uses engine-generated demo data, not on-chain reads.

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

1. **Non-invertible from outputs.** `trigger = clamp(base + k·σ + jitter(HMAC(salt, round)))`. One fresh jitter draw per price level, **upward only** — it can only make Keel act *earlier*, never later, so it never costs survival. No sequence of observations narrows `base` below the jitter width `jmax` (proof sketch in `KEEL-build-plan.md` §4.4; formal write-up is `docs/inference-attack.md`, pending Phase 6).
2. **Provable without disclosure.** `keccak256(policyHash ‖ salt)` is committed to `PolicyCommit` on Sepolia by the enclave **before** the scenario starts. Every action carries an EIP-712 receipt signed by a key derived *inside the enclave* from the same salt. Reveal `(policyBytes, salt)` afterward and anyone recomputes every round's trigger from public `PriceUpdate` logs and checks each action matched the committed policy.
3. **Survival by construction.** A hard floor trigger and an emergency override sit *under* all the cleverness. The clever part only ever moves action earlier.

## Monorepo

| Package | What | Status |
|---|---|---|
| `packages/controller` | Pure TS. EWMA vol, HMAC jitter, trigger/hysteresis, cost solver, commitment + EIP-712 receipts. Imported by **both** the enclave workflow and the app. | ✅ tested |
| `packages/scenario` | Contract mirror (integer maths), scenario generator, scoring mirror, grid tuner, replay. | ✅ tested |
| `packages/hunter` | Real Bayesian adversary: M1 (fixed threshold) vs M2 (threshold + jitter), hunt price, attack sim. | ✅ tested |
| `contracts` | Foundry. `PolicyCommit`, `Receipts` (EIP-712), + a **byte-for-byte faithful** copy of the official `ChallengeLending` + tokens (`src/official/`) for end-to-end testing. | ✅ tested (13); fidelity vs on-chain `MATCH` |
| `workflow` | Chainlink CRE `handlerInTee` confidential workflow. Commit-on-first-tick, receipts, `pending` nonce, no policy in logs. Official on-chain ABI. | ✅ typechecks + unit-tested; not yet run under the CRE runtime (Phase 3) |
| `app` | Next.js 15 dashboard: split-screen replay, Hunter panel + attack, Verify/Reveal. | ✅ builds; ⚠️ `/verify` still uses engine-generated demo data, not on-chain reads (Phase 4) |

## The controller (shared code, one source of truth)

The exact `decide()` that runs in the enclave is the exact function the app's replay and the Hunter's attack simulator call. See `packages/controller/src/types.ts` for the frozen interface. All HF/price/token maths is in integer contract units (×100) to avoid boundary mismatch with the on-chain integer HF.

## How to verify (the point of the whole thing)

1. **Commitment before start.** `PolicyCommit.commits(participant).blockNumber` is earlier than the `ChallengeStarted` block. The policy panel stays blank.
2. **Receipts.** Each `Receipts.post` carries `commit == commits[participant].hash` and an EIP-712 signature whose `ecrecover` equals the committed `signer`. The action tx is at nonce `n`, its receipt at `n+1`, same EOA — visible on Etherscan.
3. **Reveal.** Paste `(policyBytes, salt)`; `keccak256(keccak256(policy) ‖ salt)` must equal the on-chain commit. Then every round's trigger is recomputed from public `PriceUpdate` logs and each action/inaction is checked against the committed policy.

The `/verify` page in the app currently does all three in a **local-proof mode** with real in-browser hashing/signing against engine-generated data. Reading committed hashes and receipts from deployed Sepolia addresses is Phase 4 (P4.2). EIP-712 domain: `{ name: "KeelReceipts", version: "1", chainId: 11155111, verifyingContract }`.

## What is protected / what is not

- **Protected (in the enclave / Vault secrets):** all policy parameters, the salt (⇒ jitter draws + receipt-signing key + commitment), the wallet private key, the RPC credential.
- **Not protected (by design, and we say so):** the *source code and binary are not confidential* (per the Confidential Workflows docs). The Hunter M2 model **knows the algorithm** and still cannot narrow the threshold below the jitter width — confidentiality rests on the salted secret, not on the code being unknown (Kerckhoffs).
- The wallet reserve is `balanceOf` — always public. We display it as such; Keel's defence does not rely on hiding it.

## Run it

```bash
bun install                         # workspace install
bun run test                        # workspace unit tests: controller 23 + scenario 14 + hunter 7 = 44
bun test workflow/                  # workflow unit tests (13): official-ABI decode, pre-start log exclusion, nonce/leg plan
bun run codehash --check            # controllerCodeHash in every config == reproducible source-tree hash
bun run contracts:test              # Solidity tests (13: ChallengeLending + PolicyCommit + Receipts)
(cd contracts && bun run script/fidelity.ts)   # local ChallengeLending == deployed official (bytecode MATCH)
bun run e2e                         # full loop on a local Anvil chain (deploy→join→commit→crash→defend→receipt→reveal)
bun run tune                        # grid search; prints winning policy + starter baselines
bun run replay --vs starter         # text side-by-side replay
(cd app && bun run dev)             # dashboard on :3000
```

### End-to-end proof (real chain)

`bun run e2e` spins a local Anvil (`chainId 11155111`), deploys the **faithful** `ChallengeLending` + its tokens + `PolicyCommit` + `Receipts`, and drives the whole lifecycle with the **real** controller. It asserts, among others:

- `join` → position `(500, 700000, hf 111)`; commit block **precedes** the `ChallengeStarted` block.
- A price crash past the liquidation line: an **undefended** position hits `hf100 = 99 / 95 / 93` (liquidated), while the controller-defended position **survives** at `hf 117 / 113 / 110`.
- On-chain `Receipts.digestOf` equals the off-chain `receiptDigest` (EIP-712 domain + typehash agree), and the on-chain committed `signer` equals the off-chain `recoverReceiptSigner`.
- `reveal(policyBytes, salt)` succeeds; a wrong-salt reveal reverts.

Ends with `E2E PASSED`.

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

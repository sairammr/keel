# KEEL — Completion Plan

**Framing.** This plan supersedes §8–§12 of `KEEL-build-plan.md` (schedule, cut ladder, submission). §3–§7 of that document remain the intended design. `KEEL-audit.md` is the defect list; every item in it is addressed here, plus the items in Appendix A that the audit missed. There is no deadline in this document. Phases are ordered by dependency; each phase leaves the repo coherent and green. Effort tags are relative only: **S** (hours), **M** (a day or two), **L** (several days or external latency).

**What "done" means.** A fresh `git clone` on a machine that has never seen the project passes every command in §9 (Verification), every statement in the README is true, the workflow has executed under the CRE runtime end-to-end with real on-chain effects, and the published results are the honest output of a locked, reproducible evaluation.

**Preserve.** The controller maths (`jitter.ts`, `decide.ts`, `solver.ts`, `hf.ts`, `commitment.ts`, `receipt.ts`), the Hunter inference (`m1.ts`, `m2.ts`), the two Keel contracts (`PolicyCommit.sol`, `Receipts.sol`) and their Foundry tests are correct and stay. Nothing in this plan rewrites them; several items *extend* them.

---

## 0. Ground truth verified for this plan (Sep 11 2026)

Everything below was read from source, the chain, or the installed toolchain — not copied from earlier documents.

| Fact | Value | Consequence |
|---|---|---|
| Official `ChallengeLending` (Sepolia) | `0x88574e7Cc0027afd04951daa09B64d4441931ba1`, Solidity **0.8.36**, optimizer **off**, EVM cancun, `is AccessControl` | Faithful copy must use these exact settings (P1.4) |
| Official events | `PriceUpdate(uint256 oldPrice,uint256 newPrice)`, `Repay(address indexed user,uint256 amount)`, `Deposit(address indexed user,uint256 amount)`, `WithdrawCollateral(address indexed user,uint256 amount)`, `Borrow(address indexed user,uint256 amount)`, `Liquidated(address indexed user,uint256 debtRepaid,uint256 collateralSeized)`, `Join(address indexed user)`, `ChallengeOpened()`, `ChallengeClosed()`, `ChallengeStarted(uint256)`, `ChallengeStopped(uint256 endTime,uint256 duration)`, `LoanContinuityScored(address indexed user,uint256 score)` | `workflow/src/chain.ts` declares three of these wrongly (P1.1) |
| Official functions beyond deposit/repay | `borrow(uint256)`, `withdrawCollateral(uint256)`, `minCollateral(uint256)`, `calcHF(address)` (non-view, writes `hf`), `listUsers()`, `numUsers()`, `isUser(address)`, `scenarioEndTime()`, `challengeOpen()`, `rescueTokens` | `borrow` is a recovery lever nobody has considered (P5.2); `scenarioEndTime` must gate the handler (P3.3) |
| `onlyActive` | `challengeOpen && scenarioStartTime > 0` — and `close()` sets `challengeOpen = false` | The lifecycle is open → join → start → … → stop; a `close()` disables actions. Local copy's `joinOpen` model is wrong |
| `join()` | mints `start_vETH − start_Collateral = 500` (5.00 vETH) **to the caller** plus 7,000 vUSD; locks 5.00 vETH | Deposit leg is live in production; local copy mints 0 spare vETH |
| `repay()` | `vUSD.burnFrom(msg.sender, amount)` — needs vUSD allowance; tokens are OZ `ERC20Burnable + AccessControl`, lending contract holds `ADMIN_ROLE` on both tokens | Local tokens use `transferFrom`; role grant missing from `Deploy.s.sol` |
| Liquidation maths | `seizeValueVUSD = debtToRepay·105/100`; `collateralToSeize = ceil(seizeValueVUSD·100 / price)`; guard `if (targetDebt >= D) return`; **no sticky `liquidated` flag** — `checkAllHF` can liquidate the same user again later | Mirror and local copy differ in rounding and in repeat-liquidation semantics |
| `_updateDebtTime` | `from = max(lastUpdateTime, scenarioStartTime)`, `to = min(now, scenarioEndTime if set)`; `stop()` caps score at 10000 | Mirror is close but not identical |
| Contract state now | `challengeOpen = true`, `scenarioStartTime = 0`, `vETHPrice = 200000`, `numUsers = 5`; `ChallengeOpened` at block **11661556** (tx `0x59b9c28d…`); head ≈ 11678417 | `startBlock` hint for production is 11661556 (P1.2) |
| Public RPC | `eth_getLogs` capped at 50 000 blocks; **JSON-RPC batch requests accepted**; Multicall3 present at `0xcA11bde05977b3631167028862bE2a173976CA11` | Batching is the way to fit the CRE HTTP quota (P3.3) |
| CRE quotas (docs, `service-quotas`) | **HTTP: 5 requests per execution**, 10 KB request, 100 KB response; secrets: 5 concurrent, 5 fetch calls/execution, 2 KB per secret; cron ≥ 30 s; execution ≤ 5 min; private registry: **3 workflows per org** | Current handler makes ~15 HTTP calls and one 16-id `getSecrets` per tick — it cannot run under production limits (P3.3). One `PriceUpdate` log ≈ 575–640 B of JSON ⇒ the 100 KB cap is hit at ≈160 price levels |
| CRE toolchain | Installed CLI **1.2.0** (latest 1.33.0); SDK **1.18.0** (latest 1.20.1); simulator enforces production limits by default since CLI 1.20/1.23 (`--limits default|none`, `cre workflow limits export`); `cre execution list/status/events/logs` since 1.24; `cre hash` since 1.5 | Upgrade first (P3.1); expect limit enforcement in `simulate` |
| Confidential Workflows | `handlerInTee(trigger, fn, tees, hooks?)`; `{}` = any TEE; only `nitro` / `us-west-2` exist; `HTTPClient.sendRequest(teeRuntime, …)` is the correct in-enclave HTTP path; `ConfidentialHTTPClient` must **not** be used inside a TEE handler; simulation works without beta access; beta access is a **separate Google form**, not `cre account access` | P3.1, P3.5 |
| Account | `cre whoami`: `Deploy Access: Not enabled`, org `org_ujwRU2zIfiOsTJwv` | P0.1 |
| Local baseline | `bun run test` 44 pass (scenario 14, hunter 7, controller 23); `workflow` 9 pass; `forge test` 9 pass (after `forge install`); `bun run e2e` → `E2E PASSED`; `bun run codehash` → `0x051e72…` ≠ configs' `0x50188e…`; Bun 1.3.9 here vs `packageManager: bun@1.3.11` in `app/` | P1.3, P1.6 |

---

## Phase 0 — External requests and irreversible windows

These have latency the project cannot compress and no code dependency. Fire them first; nothing else waits on them except Phase 3 deployment.

| ID | Item | Acceptance | Effort |
|---|---|---|---|
| P0.1 | Request deploy access: `cre account access` → use case text: "Automated liquidation-protection confidential workflow (ETHOnline 2026 Chainlink challenge); commits a policy hash on Sepolia and posts EIP-712 receipts from the enclave." | `cre whoami` shows `Deploy Access: Enabled`; the request email is saved to `docs/deployment/access-request.md` (date, org id) | L (latency) |
| P0.2 | Request Confidential Workflows beta via the form linked from `docs.chain.link/cre/account/confidential-workflows-access` (same URL as the challenge README form). Include org id, both emails, use case. | Confirmation email saved as above | L (latency) |
| P0.3 | Create wallets `keel-prod` and `keel-demo` (`cast wallet new`), fund each ≥ 0.3 SepETH. Record addresses (never keys) in `docs/deployment/wallets.md`. | `cast balance <addr> --rpc-url $SEPOLIA` ≥ 0.3 ETH for both | S |
| P0.4 | `join()` from `keel-prod` on the official contract. The join window is open now and closes when organisers stop accepting entries; without it Keel can never run against the official contract, whatever else is finished. Use `cast send 0x8857…1ba1 "join()" --private-key $KEEL_PROD --rpc-url $SEPOLIA`. | `cast call 0x8857…1ba1 "isUser(address)(bool)" <keel-prod>` → `true`; `getUserPosition` → `(500,700000,111,0,t,0)`; `balanceOf(vETH)=500`, `balanceOf(vUSD)=700000`; tx hash recorded in `docs/deployment/wallets.md` | S |
| P0.5 | Post the open questions in the ETHGlobal Discord Chainlink channel (they gate §10 K1–K3): price-update cadence; whether `checkAllHF()` runs in the same block as `updatevETHPrice()` or after a delay; whether capital-efficiency is measured gross or net of `withdrawCollateral`/`borrow`; the discipline formula. | Questions and any answers saved verbatim in `docs/organiser-answers.md` | S |
| P0.6 | Always-on box for the fallback runner (the OCI A1 instance already available is sufficient): install Bun + CRE CLI, `cre login`. | `ssh box 'cre whoami'` succeeds | S |

---

## Phase 1 — Truth and reproducibility

Goal: the repo says nothing false, and a clean clone builds and tests on a machine that has never seen it. Everything later depends on P1.1–P1.4.

### P1.1 Correct the on-chain ABI in the workflow (**blocks P3, P4**) — S

Files: `workflow/src/chain.ts` (`LENDING_ABI`, `priceLogs`, `myActions`), `workflow/src/plan.test.ts`.

- Replace the event declarations with the official ones (table in §0). `priceLogs` decodes `newPrice` from the 2-arg event; `myActions` filters `Repay`, `Deposit`, `WithdrawCollateral`, `Borrow` by `user` (rename the indexed arg from `participant` to `user`).
- Add reads: `scenarioEndTime()`, `challengeOpen()`, `isUser(address)`; declare `getUserPosition` as returning the `userPosition` tuple.
- Add a fixture test: encode a `PriceUpdate(oldPrice,newPrice)` log exactly as Sepolia returns it (copy a real log JSON into `workflow/src/fixtures/`), decode it, assert the price ladder grows. Add a negative test proving the *old* topic hash would match nothing.

Acceptance: `bun test` in `workflow/` includes `"official PriceUpdate(uint256,uint256) log decodes to newPrice"` and `"topic0 equals keccak('PriceUpdate(uint256,uint256)') = 0x9266…5711"`; after P1.4 the Anvil E2E asserts `prices.length > 1` and `lastActionRound ≥ 0` after an action (see P3.4 for the CRE-driven version).

### P1.2 Log range and start block — S

Files: `workflow/src/config.ts`, `workflow/config.*.json`, `workflow/src/chain.ts`.

- `startBlock` becomes required and documented as "block of `ChallengeOpened` (or the deployment block of your own copy)". Production/staging value: `11661556`.
- The handler must not depend on logs older than the scenario: in the same batch (P3.3) fetch `ChallengeStarted` logs from `startBlock` and discard any `PriceUpdate` with `blockNumber < startedBlock`. This also protects the ladder against organiser test updates before `start()`.
- The private `keel_rpc_url` secret must be a provider without the 50 000-block cap (Alchemy/Infura). Document that the public fallback in config can serve `eth_call`/`eth_sendRawTransaction` but not full-range `eth_getLogs`.

Acceptance: a script `bun run rpc-check --rpc <url> --from 11661556` performs the exact `eth_getLogs` the handler will issue and exits 0; it is run in the deployment checklist (P3.5). Unit test: `PriceUpdate` logs before the `ChallengeStarted` block are excluded.

### P1.3 Reproducible `controllerCodeHash` — S

Problem: the hash is of a Bun-minified bundle, which differs across Bun versions (1.3.9 → `0x051e72…`, committed `0x50188e…`). It therefore binds nothing.

Decision: hash the **source tree**, not a build artifact. `controllerCodeHash = keccak256( ‖ over sorted files f ∈ packages/controller/src/*.ts \ {*.test.ts, fixture.ts} of (utf8(path) ‖ 0x00 ‖ utf8(content) ‖ 0x00) )`. Anyone with the git tree recomputes it with no toolchain beyond keccak. Separately record the CRE artifact hash (`cre hash` / deploy output) in `docs/deployment/` as evidence of *what was deployed*; the two together bind algorithm and binary.

Files: `workflow/src/codehash.ts` (rewrite), new `--check` flag comparing against all `workflow/config.*.json`, `tests/e2e/run.ts` (reads the config value — unchanged), `app/lib/policy.ts` (`DEMO_CODE_HASH` is a `0xcece…` placeholder → import the real function).

Acceptance: `bun run codehash --check` exits 0 on a clean clone on two different machines; CI job `codehash` runs it; changing one byte in `decide.ts` makes it exit 1.

### P1.4 Faithful local `ChallengeLending` + tokens (**blocks mirror fidelity, deposit path, CRE E2E**) — M

Files: `contracts/src/ChallengeLending.sol`, `contracts/src/TokenvETH.sol`, `contracts/src/TokenvUSD.sol`, `contracts/foundry.toml`, `contracts/script/Deploy.s.sol`, `contracts/test/ChallengeLending.t.sol`, `packages/scenario/src/mirror.ts`, `packages/scenario/src/mirror.test.ts`.

- Replace the three sources with the verified sources **verbatim** (from Blockscout, saved at `contracts/src/official/` with the fetch URL and block in a header comment; OZ imports via the pinned OZ version that compiles them). `foundry.toml`: `solc = "0.8.36"`, `optimizer = false`, `evm_version = "cancun"` for the official profile; keep `via_ir` only where `Receipts.sol` needs it (use a `[profile.default]` with `via_ir=true` and a `[profile.official]` if the two conflict — verify `Receipts` compiles without via_ir on 0.8.36 first; it likely does with `--optimizer`).
- `Deploy.s.sol`: deploy tokens, then lending, then `grantRole(ADMIN_ROLE, lending)` on both tokens (as the organisers' `scripts/deploy.js` does), then `open()`.
- Bytecode fidelity test (`contracts/test/Fidelity.t.sol` or a Bun script): compare `keccak(runtime bytecode of local ChallengeLending)` to `keccak(eth_getCode(0x8857…))` with the CBOR metadata trailer stripped from both. If they match, the copy is provably faithful; if only the metadata differs, record why (file path in metadata) — see K7.
- Mirror: port `liquidateUser`, `_updateDebtTime`, `stop` (cap 10000), `borrow`, `minCollateral`, and remove the sticky `liquidated` flag (keep a `liquidationCount` and `everLiquidated`). Extend the existing property test to run **the same 200 random action sequences against Anvil** — **[DONE]** `mirror.anvil.test.ts` deploys the faithful contract on a throwaway Anvil, replays each sequence, and asserts `(C, D, hf, cumulativeDebtTime, liquidationCount)` equal after every step. (Note: `skipIf(!anvil)` — silently skips when anvil is absent, so CI must guarantee anvil on PATH or the strongest fidelity proof does not run.)
- Foundry tests: keep the two existing, add `testJoinMintsSpareVeth` (caller holds 500 vETH), `testRepayBurnsFromAllowance` (revert without approval), `testRepeatLiquidation`, `testCloseDisablesActions`.

Acceptance: `forge test` ≥ 13 tests green; `bun test packages/scenario` includes the Anvil cross-check (skipped with a clear message only if `anvil` is absent — and §9 requires it present); the fidelity check prints `MATCH` or a documented metadata-only diff.

### P1.5 Clean-clone build — M

Files: root `package.json` (workspaces), `bun.lock` (single), `.bun-version`/`packageManager`, `.gitmodules` or `foundry.toml [dependencies]`, `contracts/README.md` (replace the Foundry boilerplate), `app/README.md` (replace the create-next-app boilerplate), new `.github/workflows/ci.yml`, new `LICENSE`.

- One lockfile: add `workflow`, `tests/e2e` and `app` to the root `workspaces`; delete `workflow/bun.lock` and `app/bun.lock`. Pin Bun in root `packageManager` and `.bun-version` (pick the version the CRE CLI's `cre-compile` supports — see P3.1); align `@noble/hashes` (`^1.5` in controller vs `^2.4` at root) and `viem` ranges so one resolution is used everywhere.
- Foundry deps: `forge install foundry-rs/forge-std@<tag> OpenZeppelin/openzeppelin-contracts@<tag>` as git submodules **committed** (`.gitmodules`), or Soldeer with a lockfile. Remove `contracts/lib/` from `.gitignore` accordingly.
- CI: `bun install --frozen-lockfile`, `bun run typecheck`, `bun run test`, `forge test`, `bun run codehash --check`, `bun run e2e` (Anvil installed via `foundry-toolchain`), `cd app && bun run build`, a grep gate that fails on any `keel_*=` value or 0x-private-key pattern outside `*.example*`.
- `LICENSE`: MIT (or the owner's choice) with the year and name.

Acceptance: on a fresh machine, `git clone --recurse-submodules … && bun install --frozen-lockfile && bun run test && bun run contracts:test && bun run e2e && (cd app && bun run build)` exits 0 with no manual step; CI is green on `master`.

### P1.6 Make the README true now (interim) — S

Until Phases 3–4 land, the README must not claim what does not exist. Edit `README.md`: remove "on-chain mode against deployed addresses"; change "faithful local copy" to reflect P1.4's status; fix the test counts; remove the dead `docs` link or create `docs/` with the inference note from P6.2's outline; delete the HANDOFF gotcha "participant holds 0 spare vETH" (it is false — `join()` mints 5.00 vETH); add a "Status" section that lists what is and is not done, maintained through Phase 6.

Acceptance: a reviewer can find no sentence in `README.md`/`HANDOFF.md`/`workflow/README-workflow.md` that describes behaviour the repo does not have; `HANDOFF.md` is either updated or deleted (it is a hackathon artefact — recommend deleting it once `docs/` exists).

---

## Phase 2 — The controller, properly

Goal: an honest, reproducible answer to "does Keel protect as well as a tuned fixed threshold?", and a controller whose every term does what the documentation says it does. Depends on P1.4 (mirror fidelity). Independent of Phase 3 except that production secrets (P3.5) must use the policy frozen here.

### P2.1 Fix the evaluation engine before tuning anything — M

Files: `packages/scenario/src/engine.ts`, `scoring.ts`, `scenario.ts`, `packages/hunter/src/index.ts` (`obsFromTrace`), `app/lib/engine.ts`, `app/app/verify/page.tsx`.

1. **Pre-action HF. [DONE]** `Tick` now carries `hfBpPre` (the HF the controller saw) and keeps `hfBp` as post-action display. `obsFromTrace` prefers `hfBpPre`; the Verify audit reconstructs pre-action HF from chain logs independently (and flags `RECEIPT HF MISMATCH` if a receipt's self-reported `hfBp` disagrees). Regression-guarded by the real-engine end-to-end test in `hunter.test.ts`.
2. **Reserves = `join()`.** Default engine reserves become `vETH: 500`, `vUSD: 700000` (today 1000 / 2 000 000). Capital caps then bind as they will on-chain.
3. **Check ordering as a parameter.** `EngineOpts.checkOrder: "act-then-check" | "check-then-act"`. Today the engine always lets the defender act on the tick it observes a price *before* `checkAllHF` — which is why a 1.05 keeper "wins": it never needs to act early. On-chain, organisers may call `checkAllHF()` in the same block as `updatevETHPrice()`. Every table in this project reports both orderings; tuning optimises the worse one (K1).
4. **Attacker family test-only.** `generateTrain()` cycles six families; `generateTest()` keeps seven. Regenerate the test seeds (`2001–2028`) once, because 1001–1024 have now been looked at while tuning was discussed.
5. **Starter reserves and cooldown.** The starter baseline must not inherit Keel's policy for `cooldown`/caps; give `makeStarter` its own `{arm, target, maxRepayPct, maxDeposit, cooldown}` matching the official template's semantics (repay first, then deposit if insufficient, caps from its env example).
6. **Discipline/capital constants** stay isolated in `scoring.ts`; add the README-literal "repay ≤ 15 % of original debt" starter variant as a named baseline.

Acceptance: `engine.test.ts` gains tests for (1) `hfBpPre ≤ armBp` on every non-emergency acted tick, (2) a deposit exceeding 5.00 vETH is impossible, (3) with `check-then-act` the `do-nothing` and a `1.02` keeper liquidate on `readme-crash` while Keel survives; `hunter.test.ts` `obsFromTrace` test uses `hfBpPre`.

### P2.2 The volatility term: decide by pre-registered protocol — M

Facts: with prior σ₀ = 0.02 and k = 1.0 the term is at its cap (200 bp) at round 0 and on 52 % of levels; it is therefore a near-constant +150–200 bp offset, and any attacker can pin it at the cap with one 2.2 % move. The tuned "base = 10500" winner *relies* on that offset.

Candidates, evaluated on **train only** under P2.1:
- **A** — current term (control).
- **B** — `kvol_bp = 0` (drop), re-tune `base` over `{10600 … 10900}` so the comparison is offset-fair.
- **C** — redesigned: σ²₀ = 0 (no volatility assumed until observed; term = 0 at round 0), `k ≈ 5000` so a 4 % per-level σ reaches the 200 bp cap, halflife unchanged. Same policy encoding (fields exist), so no commitment format change.

Decision rule (write it into `docs/results.md` *before* running): pick **B** unless C beats B on train mean by more than the paired bootstrap 95 % CI half-width **and** does not lose on the attacker family on test **and** the Hunter M2 hunt-price under C is not shallower than under B. Ties go to B (simplest, smallest attacker-inducible surface). Whichever is chosen, the policy fields stay in `Policy`/`policyBytes`; the losing branch's code stays only if it is the chosen one (`vol.ts` is deleted if B wins; the encoding keeps `kvol_bp/volcap_bp = 0`).

Acceptance: `bun run eval --stage train` prints A/B/C with means, worst, capital, liquidations, M2 width, hunt price, and the CI; `docs/results.md` records the decision with the numbers; `packages/controller/src/decide.ts` reflects it; `bun run test` green.

### P2.3 Tuner objective and honest train/test protocol — M

Files: `packages/scenario/src/tune.ts`, new `packages/scenario/src/eval.ts`, new `docs/results.md` (generated section), `packages/scenario/src/starter.ts`.

- Objective (lexicographic): `liquidations` (both orderings) → `mean` under `check-then-act` → `worst` → **M2 b-width descending** (confidentiality metric, currently absent) → capital.
- Fair baselines: the starter is tuned on the *same* train set over `arm ∈ {10300…11000 step 50} × target ∈ {arm+300…arm+800}`; the official defaults (1.08/1.15) and the README example (1.08/1.18, 15 % cap) are reported unmodified.
- Test set is evaluated **once**, by `bun run eval --stage test`, after the train winner is frozen in `packages/controller/src/tuned.ts` (exported, used by E2E, app and secrets template). The command refuses to run if `tuned.ts` changed since the last train run (hash check) unless `--retune` is passed, which also bumps the test seed range and records it.
- Report: a Markdown table generated into `docs/results.md` with a fixed random seed, both orderings, per-family rows, paired-difference CI vs the best starter, and the sentence the numbers support. **If Keel ties the tuned starter on protection quality, the report says so and states that the claimed win is non-invertibility (P6.2's bound), not score.** No further tuning after the test run.

Acceptance: `docs/results.md` contains `Generated by bun run eval @ <commit>`; re-running `bun run eval` at that commit reproduces it byte-for-byte; the README "Results" section links to it and makes no numeric claim not in it.

### P2.4 Controller consolidation (no behaviour change) — S

- `decide()` returns both legs (`dep`, `rep`) so `main.ts`, `engine.ts (keelPlan)` and `decide.ts` stop each recomputing the emergency `solveTarget` (three copies today).
- Emergency target rule and `LIQ_BP` semantics documented in `types.ts`.
- Add `borrow`/`withdraw` to `ActionKind` handling in `solver.ts` only as no-ops until P5.1/P5.2.

Acceptance: `keelPlan` deleted; `decide.test.ts` snapshot of decisions on the README paths is unchanged before/after (add the snapshot test first).

---

## Phase 3 — The CRE path, real

Goal: the handler runs under the CRE runtime, drives real transactions in an end-to-end test, respects production quotas, and is deployed against the official contract with the commitment posted before `start()`. This is the largest phase. P3.1–P3.4 need nothing external; P3.5–P3.6 branch on Phase 0's outcomes.

### P3.1 A real CRE project — M

Files: new `project.yaml` (root), new `workflow/workflow.yaml`, `workflow/package.json`, root `.env.example` and `secrets.example.yaml` (move from `workflow/`), `workflow/src/main.ts`.

- Upgrade: `cre update` (→ 1.33.x), `@chainlink/cre-sdk` → 1.20.1 (or latest; confirm `handlerInTee` signature unchanged in `dist/sdk/workflow.d.ts`), Bun to the version `cre-compile` documents. Record versions in `docs/toolchain.md`.
- `project.yaml` targets: `local-settings` (RPC `http://127.0.0.1:8545`, `--allow-insecure-rpc` if required), `staging-settings` (Sepolia, own faithful copy), `production-settings` (Sepolia, official). RPC URLs via `${VAR}` so no key is committed.
- `workflow/workflow.yaml`: per target `workflow-name` (`keel-local`, `keel-staging`, `keel`), `deployment-registry: "private"`, `workflow-path: ./src/main.ts`, `config-path: ./config.<target>.json`, `secrets-path: ../secrets.yaml`.
- `main.ts`: replace `process.env.KEEL_TEE` (module-load `process.env` is not available in the WASM runtime) with a `tee: boolean` field in config; validate config with a zod schema and `Runner.newRunner<Config>({ configSchema })`.
- First run: `cre workflow simulate workflow --target staging-settings --non-interactive --trigger-index 0` against the *unmodified* handler to surface runtime errors (`Buffer` — the SDK's own runner uses it, so expected fine; synchronous `.result()` ordering; bundling of `../../packages/controller`). Fix whatever breaks. Also run `bun x cre-compile workflow/src/main.ts /tmp/keel.wasm` and keep its static-analysis warnings at zero.

Acceptance: `cre workflow simulate … --target staging-settings --non-interactive --trigger-index 0` completes with a one-word return value (`IDLE` or `COMMITTED` in dry-run) and no engine error; the full terminal output is saved to `docs/evidence/simulate-first-run.txt`.

### P3.2 Quota-compliant handler (**required for anything deployed**) — M

Files: `workflow/src/chain.ts` (`ChainReader.rpc` → `rpcBatch`), `workflow/src/main.ts`, `workflow/src/policy.ts`, `secrets.example.yaml`, new `workflow/src/chain.test.ts` with a counting fake `HTTPClient`.

Budget: **≤ 5 HTTP requests per execution**, ≤ 10 KB each, ≤ 100 KB responses; **≤ 5 secrets per fetch**.

- Tick = **request 1** (one JSON-RPC batch array): `eth_blockNumber`, `eth_gasPrice`, `eth_getTransactionCount(pending)`, `eth_call` × {`vETHPrice`, `getUserPosition`, `scenarioStartTime`, `scenarioEndTime`, `challengeOpen`, `PolicyCommit.commits`, `vETH.balanceOf`, `vUSD.balanceOf`} (or a single Multicall3 `aggregate3` call for all eth_calls), `eth_getLogs` × {`ChallengeStarted`, `PriceUpdate`, `Repay(me)`, `Deposit(me)`, `WithdrawCollateral(me)`, `Borrow(me)`}. **Request 2**: batch of `eth_sendRawTransaction` for every leg + receipt (ordered by nonce). Reserve requests 3–5 for a single retry of request 2 and for a future confirmation read. Batch responses are matched by `id`, never by position.
- Response-size guard: if request 1's body exceeds 90 KB, re-issue only the `PriceUpdate` query from `startedBlock + (last known bound)` — implement the guard, and document the bound (≈160 levels) in K5.
- Secrets: pack the 13 policy parameters into one JSON secret `keel_policy` (< 2 KB); total secrets = `keel_policy`, `keel_salt`, `keel_rpc_url`, `liquidation_private_key` (4 ≤ 5). `parsePolicy` validates with zod and rejects unknown keys.
- Gate: `IDLE` when `!challengeOpen || scenarioStartTime == 0 || scenarioEndTime != 0 || !isUser || debt == 0`.
- One receipt **per leg**, posted at `legNonce + 1`; `planNonces` becomes `[L1, R1, L2, R2]`. Receipt `action` codes documented: 1 repay, 2 deposit, 3 withdraw, 4 borrow.
- Never log a policy value; the handler returns only `COMMITTED | IDLE | SAFE | DEFENDED | EMERGENCY`.

Acceptance: `chain.test.ts` runs the handler against a fake RPC (recorded Sepolia/Anvil responses) and asserts `httpCalls ≤ 5`, every request body `< 10 KB`, secrets fetched in one call of ≤ 5 ids; `cre workflow simulate … --limits default` (the CLI default) completes a `DEFENDED` tick without a quota error (evidence file saved).

### P3.3 Local target on Anvil and the CRE-driven E2E (**the handler in the loop**) — M

Files: new `tests/e2e/cre-e2e.sh`, new `tests/e2e/driver.ts` (admin side only: deploy, open, join, start, price updates, `checkAllHF`, stop), `workflow/config.local.json`, `tests/e2e/run.ts` renamed `controller-e2e.ts` (kept as the controller-level test).

- Driver loop: start Anvil (`--chain-id 11155111`, block time 1 s) → `forge script Deploy.s.sol` → write addresses into `config.local.json` and `.env.local` → `join()` from the participant key → **tick** = `cre workflow simulate workflow --target local-settings --non-interactive --trigger-index 0 --broadcast` → assert `COMMITTED` and `PolicyCommit.commits(participant).hash != 0` and two approvals mined → `start()` → for each price step: `updatevETHPrice` → tick → assert return ∈ {SAFE, DEFENDED, EMERGENCY} and, when DEFENDED, that a `Repay`/`Deposit` log from the participant and a `ReceiptPosted` log with the correct `round` exist, receipt tx nonce = action tx nonce + 1 → `checkAllHF` → assert not liquidated → after the run, `reveal()` succeeds and `packages/verifier` (P4.1) reproduces every decision from logs alone.
- Include at least one step where the solver chooses **deposit** (the faithful `join()` gives 5.00 spare vETH) so the deposit path is exercised on-chain for the first time.
- If the simulator cannot reach `127.0.0.1` (K6): run Anvil behind `cloudflared tunnel` and put the tunnel URL in `config.local.json`; the script handles both.

Acceptance: `bun run e2e:cre` prints `CRE E2E PASSED`, with a line `handler ticks: N, defended: ≥2, deposits: ≥1, repays: ≥1, receipts: = legs, rounds ok`; it runs in CI (Anvil + CRE CLI installed in the job; CLI login is not needed for `simulate`).

### P3.4 Keel contracts and the faithful copy on Sepolia (staging) — S

Files: `contracts/script/Deploy.s.sol`, `workflow/config.staging.json`, `app/.env.example`, `docs/deployment/addresses.md`.

- `forge script script/Deploy.s.sol --rpc-url $SEPOLIA --broadcast --verify` deploying `PolicyCommit`, `Receipts(policyCommit)`, `TokenvETH`, `TokenvUSD`, `ChallengeLending` (roles granted, `open()` called) with `keel-demo` as admin. Verify all five on Etherscan/Blockscout. Commit `contracts/broadcast/` for this chain (remove `broadcast/` from `.gitignore` for `11155111`).
- `join()` from `keel-demo` on the copy; wire addresses into `config.staging.json`; `startBlock` = deployment block.
- Drive a full scenario on the copy with the simulator in `--broadcast` mode on a 60 s loop from a laptop (`scripts/run-scenario.ts --target staging-settings --path readme-crash`), organiser side driven by `keel-demo` via `cast`. This is the first real-chain autonomous defence.

Acceptance: `docs/deployment/addresses.md` lists five verified addresses and the tx hashes of `Committed`, two approvals, ≥ 2 actions, their receipts, and `Revealed`; `cast call $POLICYCOMMIT "commits(address)" $KEEL_DEMO` shows `blockNumber` < the `ChallengeStarted` block on the copy; the app (P4) reads this deployment.

### P3.5 Production deployment against the official contract — L (external)

Branches by Phase 0 outcome. In every branch the production salt is fresh, generated on the deploying machine (`openssl rand -hex 32`), never written anywhere but `.env` (fallback) or the Vault DON, and `docs/deployment/production.md` records only public facts.

- **Common**: `config.production.json` → official lending, deployed `PolicyCommit`/`Receipts`, `startBlock: 11661556`, `tee: true`, `schedule: "0 */1 * * * *"` (60 s; 30 s only if `rpc-check` shows the provider tolerates it). `bun run codehash --check` on the deploying machine. `bun run rpc-check` against the private RPC. Secrets template filled from `packages/controller/src/tuned.ts` (P2.3).
- **Branch A — deploy access + TEE beta granted**: `cre secrets create secrets.yaml --target production-settings --secrets-auth=browser`; `cre secrets list` shows the four ids; `cre workflow deploy workflow --target production-settings`; `cre workflow list --registry private` shows `keel` active; first execution returns `COMMITTED` (visible via `cre execution list keel` / `cre execution logs`); `PolicyCommit.commits(keel-prod)` set, two approvals mined — all **before** `scenarioStartTime()` becomes non-zero.
- **Branch B — deploy access but TEE rejected** (`deploy` errors on TEE requirements): set `tee: false`, redeploy with `cre.handler`; the policy is still Vault-only but is decrypted on DON nodes; state this in `docs/deployment/production.md` and in the README's "what is protected" table. T1-style evidence then comes from the simulator run of the `tee: true` build (`docs/evidence/`).
- **Branch C — no deploy access**: fallback runner on the always-on box (P0.6): `scripts/fallback-runner.sh` = `while true; cre workflow simulate workflow --target production-settings --non-interactive --trigger-index 0 --broadcast; sleep 45; done` under `systemd` with restart, logs rotated, secrets in the box's `.env` (chmod 600). Disclose in the README that the code path is identical but execution is not on the DON. Liveness check script `scripts/liveness.sh` (wallet nonce, last receipt, `scenarioStartTime`).
- Whichever branch: keep the `keel-prod` key nowhere else; the private registry allows 3 workflows, so `keel-staging` and `keel` fit.

Acceptance: `docs/deployment/production.md` contains the branch taken, `cre workflow list` output (or the runner's `systemctl status`), the `Committed` tx hash and block, and a statement of what executed where; `cast call 0x8857… "scenarioStartTime()"` at commit time was `0`.

### P3.6 Reveal and post-scenario audit — S (after the organisers' run, or on the copy at any time)

- After `stop()` on the target contract, `reveal(policyBytes, salt)` from the same wallet (`scripts/reveal.ts`), then `bun run verify --participant <addr> --policy <bytes> --salt <hex>` (P4.1) reproduces every round; results appended to `docs/deployment/production.md`. On the official contract the production salt is revealed only after Chainlink publishes scores.

Acceptance: the verifier's output for the copy is committed under `docs/evidence/verify-staging.txt` and ends `ALL ROUNDS CONSISTENT`.

---

## Phase 4 — The app, real

Goal: `/verify` reads the chain; receipts, blocks and nonces are real; the split-screen and the Hunter run on real recorded runs as well as the engine. Depends on P3.4 (addresses, real receipts) and P2.1 (`hfBpPre`).

### P4.1 `packages/verifier` — pure, shared, CLI-able — M

Files: new `packages/verifier/src/{reconstruct,audit,index}.ts` + tests; `packages/hunter/src/index.ts` (`obsFromChain`).

- Input: `PriceUpdate`, `ChallengeStarted`, participant `Join/Deposit/Repay/WithdrawCollateral/Borrow/Liquidated` logs, `Committed`, `ReceiptPosted` (+ the receipt tx's `nonce` and the action tx's `nonce`), optional `(policyBytes, salt)`.
- Output: per-round `{block, price, C, D, hfBpPre, acted, kind, amount, receipt?, nonceAdjacent}` reconstructed from events only (no archive node needed: C/D are derived from `Join` + subsequent events); with the reveal: `{armBp, targetBp, expectedDecision, consistent}` using the shared `decide()`; commitment check `keccak(keccak(policy)‖salt) == commits.hash`; signer check via `recoverReceiptSigner`.
- `bun run verify --rpc … --lending … --policyCommit … --receipts … --participant … [--policy … --salt …]` prints the audit table and exits non-zero on any inconsistency.

Acceptance: tests use the P3.3 Anvil run's exported logs as fixtures; `bun run verify` on the P3.4 staging deployment ends `ALL ROUNDS CONSISTENT`; a deliberately altered salt ends `COMMITMENT MISMATCH`.

### P4.2 `/verify` reads Sepolia — M

Files: `app/app/verify/page.tsx`, new `app/app/api/chain/[...]/route.ts` (server-side viem `createPublicClient`, RPC key stays server-side; `revalidate = 30`), `app/lib/policy.ts` (delete `DEMO_CODE_HASH`, `DEMO_RECEIPTS_ADDR`; use `codehash` and the deployed address), `app/.env.example`.

- Modes: `?participant=0x…` (default: `keel-demo` on the staging copy; `keel-prod` on the official contract selectable). Sections: commitment (on-chain `commits`, `Committed` block vs `ChallengeStarted` block, Etherscan links), receipts (from `ReceiptPosted` logs; digest recomputed; `ecrecover == signer`; nonce adjacency from `getTransaction`), reveal (paste or read `Revealed`; audit table from P4.1). Local-proof mode remains as an explicitly labelled *demo* using the engine, never mislabelled as on-chain.
- Block numbers in receipts are the real `blockObserved`; the synthetic `9_000_000 + round*5` disappears.

Acceptance: with `NEXT_PUBLIC_*` set to the staging addresses, `/verify` shows the real `Committed` block, ≥ 2 receipts with ✓, and the reveal audit for the copy; with the vars unset the page says `DEMO (engine-generated)`; `grep -rn "9_000_000" app/` returns nothing; an integration test (`app/tests/verify.spec.ts`, Playwright or a route-handler test) hits the API route against a recorded RPC fixture.

### P4.3 Split-screen on real runs — M

Files: `app/lib/runs.ts`, `app/data/runs/*.json` (exported by `bun run export-run`), `app/app/replay/*`.

- On the staging copy, run **both** the official starter template (unmodified, second wallet) and Keel through the same driven scenario (P3.4 driver supports two participants). Export both traces from chain logs via `packages/verifier` into `app/data/runs/<scenario>.json` with tx hashes.
- The replay page offers `source: chain (recorded) | engine (live)`. Chain mode renders the recorded traces and links every action to Etherscan; engine mode is the existing in-browser replay using the tuned policy and `hfBpPre`.

Acceptance: at least two recorded chain runs (a crash and a wick) with real tx links; the engine mode's Hunter strip uses pre-action HF; `app` build green.

### P4.4 Hunter on observed history — M

Files: `app/app/hunter/*`, `packages/hunter/src/index.ts` (`obsFromChain` from P4.1 output).

- The Hunter page gets a `source` selector: engine suite (existing) | a chain participant (`?lending=…&participant=…`). Against the copy it targets the recorded starter and Keel runs; against the official contract it can be pointed at any `listUsers()` address after the organisers' run — the M1 posterior on a real competitor's public history is the strongest possible demonstration of the thesis and needs no private data.
- The attack console states its model honestly: taps are simulated by the engine; `attack.ts` currently passes `vUSD: 0n` to force deposits and only counts deposit legs as "forced" — either count repay legs too (with a vUSD reserve) or label the panel "vETH-drain model". Do the former.

Acceptance: `/hunter?source=chain&participant=<keel-demo>` renders M1/M2 from real logs with widths in bp; the hobbled `STARTER` policy in `hunter.test.ts` (`max_deposit: 6`, `emerg_bp: 9000`) is replaced by the official-template starter semantics from P2.1.

---

## Phase 5 — Completeness

Goal: everything the original design deferred, plus what makes Keel a project rather than an entry. Depends on Phases 2–4 (the levers change the policy encoding and the verifier).

### P5.1 `withdrawCollateral` recovery branch — M

Files: `packages/controller/src/{decide,solver,types,commitment}.ts`, `workflow/src/chain.ts`, `packages/scenario/src/mirror.ts`, `packages/verifier`.

- Rule (plan §4.7): when `hfBpPre ≥ targetBp + recover_margin_bp` for ≥ `recover_levels` consecutive levels and net deposited > 0, withdraw the amount that leaves `hf ≥ targetBp` and satisfies `minCollateral(debt)`. Policy gains `recover_withdraw: 0|1`, `recover_margin_bp`, `recover_levels`; `policyBytes` version → 2 (append fields; `encodePolicyBytes` handles v1 for old reveals).
- Default **off** until K3 (net vs gross capital) is answered; the engine evaluates both settings and `docs/results.md` reports the score delta under each capital semantics.

Acceptance: engine test "ghost-dip attack drains 3× less with recovery on under net accounting"; CRE E2E includes one withdraw with action code 3 and its receipt; verifier audits it.

### P5.2 `borrow()` re-leverage branch (new; the official contract has it) — M

- After a repay during a dip, once the price recovers, borrowing back the repaid amount restores debt-time (20-point weight) at the cost of one discipline action. Rule: if remaining scenario time × restorable debt / (D₀ × T_est) × 20 > discipline cost (2.5) and `hf` after borrow ≥ `targetBp`, borrow `min(repaid so far, amount keeping hf ≥ targetBp)`. Policy flag `reborrow: 0|1`, default off until K3.
- Mirror/verifier/receipt code 4 support; engine evaluation as in P5.1.

Acceptance: engine test on `readme-wick` shows loan-continuity ≥ 95 % with reborrow vs < 90 % without; `docs/results.md` reports it; CRE E2E exercises `borrow` on Anvil.

### P5.3 Hunter: richer models and the bound made checkable — M

- **Sequential mode**: posterior after each observation (animated in the UI), plus the count of observations to reach a 50 bp band — the "three actions locate a fixed threshold" claim becomes a measured number.
- **Cost-of-certainty curve**: hunt price vs required confidence (0.5–0.95) for starter and Keel.
- **M2 is exact for Keel's jitter** (uniform on `[0, jmax)` ⇒ the ramp likelihood is the true CDF); state that in `docs/inference-attack.md` and add a test that the M2 90 % band on Keel data never falls below `jmax − 2·grid step` over 1 000 synthetic scenarios (the bound, empirically).
- Adversary with knowledge of `kvol`: only relevant if P2.2 keeps the term; otherwise document why it is gone.

Acceptance: `hunter.test.ts` bound test; `/hunter` shows the sequential strip and the curve.

### P5.4 Position-scale framing — S

- `scaleEconomics` gets a written derivation (`docs/attack-economics.md`): bounty = 5 % × seized collateral value; defender loss = forced spends at tap prices; push cost is an **estimate** with the source stated. The ×N toggle in the UI links to it. No number appears in the UI that is not in the doc.

Acceptance: doc exists; UI numbers reconcile to its formulas in a unit test.

### P5.5 Operational hardening (needed for anything that runs unattended) — M

- Stuck-nonce recovery: if `pending − latest ≥ 1` for ≥ 3 ticks, re-send the lowest pending nonce with gas price ×1.5 (bounded by a cap secret `keel_max_gas_gwei`).
- RPC fallback: on request-1 failure, retry once on `cfg.rpc_url` (public) — still within the 5-call budget.
- Gas accounting: `docs/deployment/production.md` tracks SepETH burn per tick; `scripts/liveness.sh` alerts (stdout/exit code) when balance < 0.05.
- Own-liquidation detection: a `Liquidated(me)` log sets status `LIQUIDATED` in the return value; the handler keeps defending the remaining position.
- Secrets hygiene CI gate (P1.5) extended to `docs/evidence/*.txt` (simulator output must not contain policy values).

Acceptance: `chain.test.ts` covers stuck-nonce and fallback paths; a 24 h unattended run on the staging copy with a scripted organiser (`scripts/organiser-bot.ts` emitting a random README-family path every 5 min) ends with 0 liquidations and no missed tick (`docs/evidence/soak-24h.md`).

### P5.6 Beyond the challenge contract: a real lending protocol — recommendation — L

The thesis is about any threshold keeper, not about `ChallengeLending`. The controller is already protocol-agnostic (it consumes `C, D, P, θ` and emits `repay/deposit/withdraw/borrow`); what is protocol-specific is `chain.ts` and the mirror.

Recommendation: **do it, as the last item, and as an adapter, not a rewrite.**
- Introduce `packages/protocols/` with an interface `LendingAdapter { readState(batch) → {C, D, P, θ, hfBp, balances}; txs: repay(amount) | deposit(amount) | withdraw(amount) | borrow(amount) }` and two implementations: `challenge-lending` (today's `chain.ts`) and `aave-v3-sepolia` (Pool `getUserAccountData` gives total collateral/debt in base currency and the liquidation threshold; HF in 1e18; actions via `Pool.repay/supply/withdraw/borrow` with WETH/USDC test reserves on Sepolia).
- Commit/receipt contracts are unchanged (they are protocol-blind). The verifier gains an Aave reconstructor (events `Supply/Repay/Withdraw/Borrow/LiquidationCall` + oracle price from `AaveOracle.getAssetPrice` at block — this one does need historical `eth_call`, i.e. an archive-capable RPC).
- Test on an Anvil **fork** of Sepolia (`anvil --fork-url`), driving the oracle via `vm.mockCall`-style storage overrides (`anvil_setStorageAt` on the oracle's source) to create dips.
- Scope boundary: single-collateral, single-debt positions; no swaps/bridges (the CRE template's "swap-then-deposit" is out of scope).

Acceptance: `bun run e2e:aave` (fork) shows a Keel-defended Aave position surviving a driven oracle dip with commit + receipts; README documents the adapter interface and the boundary.

---

## Phase 6 — Documentation and presentation

Goal: an honest, complete, verifiable account. Depends on everything above for the numbers and addresses; the outlines can be written earlier.

| ID | Item | Acceptance | Effort |
|---|---|---|---|
| P6.1 | `README.md` rewrite: what Keel is, threat model, what is/isn't protected (quote the docs' "source and binary are not confidential"), architecture diagram, **Results** (link to `docs/results.md` only), **Deployment record** (links), **Verify it yourself** (P4.1 CLI command with real addresses), **Run it** (the §9 command list), status of each phase, LICENSE badge | Every claim traceable to a command or an on-chain link; a reviewer executes "Verify it yourself" from the README alone | M |
| P6.2 | `docs/inference-attack.md`: the binary-search argument with the measured observation counts (P5.3), the M2 bound with proof (`band ≥ jmax` because every action gives `base ≥ h_a − jmax`, every inaction `base < h_n`, and `h_n > h_a` for any consistent history), why upward-only jitter cannot cost survival, why a volatility term is attacker-inducible and what was decided (P2.2), and the limits (Kerckhoffs: the adversary knows the algorithm; the reserve is public; consequences are public) | Reviewed by someone who did not write it; equations match `packages/hunter` code; referenced from the README | M |
| P6.3 | `docs/architecture.md`: per-tick data flow, the 2-request batch design and quotas, commitment scheme, receipt binding chain (commit → signer → nonce adjacency), what runs where (enclave / DON / chain / app) | Diagram plus a table mapping each claim to a file/function | S |
| P6.4 | `docs/results.md` generated (P2.3), `docs/deployment/*` (P3.4–P3.6), `docs/evidence/*` (simulator outputs, `cre workflow list`, execution logs, soak run), `docs/organiser-answers.md`, `docs/toolchain.md` | All present; evidence files pass the secrets grep gate | S |
| P6.5 | Demo video (≤ 4 min if used for the hackathon, otherwise unconstrained): follows the original §12 shots but every on-screen number comes from `docs/results.md` or a live page; terminal segment shows `cre workflow simulate` returning `COMMITTED`/`DEFENDED` under `--limits default`, and `cre workflow list` or the fallback runner's status. Published unlisted; link in README | Script in `docs/video-script.md`; the video shows no policy value or salt except the demo salt | M |
| P6.6 | Delete `HANDOFF.md`; remove hackathon-only wording from code comments ("ponytail", cut-ladder references) | `grep -rn "cut ladder\|ponytail\|CP[0-9]" --include=*.ts --include=*.md .` empty outside `docs/history/` (where the original plan and audit are archived) | S |

**Opportunistic submission.** If the owner chooses to submit to the hackathon while this plan is in progress, the minimum honest subset is P0.4, P1.1–P1.3, P1.6, P3.1–P3.2 and one of P3.5's branches, with the README's status section stating exactly which phases are incomplete. Nothing in that subset is done differently for the submission than for completion.

---

## 7. Ordering constraints

```
P0.1 ─┐                                   P0.2 ─┐
P0.3 → P0.4                                     ├─→ P3.5 (branch) → P3.6
P0.5 → K1..K3 → P2.2/P2.3 decision text, P5.1/P5.2 defaults
P0.6 ──────────────────────────────────────────┘

P1.1 → P3.2 → P3.3 → P3.4 → P4.2, P4.3 → P4.4 → P5.3
P1.2 ↗                 ↘ P3.5
P1.3 → P3.4 (commit on Sepolia), P4.2 (real codehash in app)
P1.4 → P2.1 (mirror fidelity) → P2.2 → P2.3 → tuned.ts → P3.5 secrets, P4.3 engine mode
P1.4 → P3.3 (faithful contract on Anvil, deposit path)
P1.5 → CI for every later phase
P2.1 (hfBpPre) → P4.1 → P4.2, P4.4
P2.4 → P5.1, P5.2 (decide returns legs)
P3.3 → P5.5 soak;  P3.4 → P4.x;  P4.1 → P3.6
P5.1/P5.2 → policyBytes v2 → redo P3.4 commit on the copy (new hash) before P6
P5.6 last.  P6.1/P6.2 outlines any time; final text after P5.
```

Hard blockers: **P1.1** (nothing on a real chain is meaningful with the wrong ABI); **P1.4** (every "faithful" and "deposit path" claim); **P2.1** (every Hunter/verify number is wrong until pre-action HF exists); **P3.2** (nothing deployable exceeds 5 HTTP calls). External blockers: P0.1/P0.2 for P3.5 branches A/B only — branch C needs neither.

---

## 8. Files and functions index (where changes land)

| Area | Files |
|---|---|
| Workflow | `workflow/src/chain.ts` (`LENDING_ABI`, `rpcBatch`, `readAll`, `priceLogs`, `myActions`, `send`), `workflow/src/main.ts` (`onCronTrigger`, config schema, `tee` flag), `workflow/src/policy.ts` (`parsePolicy` from `keel_policy` JSON), `workflow/src/plan.ts` (`planNonces` per-leg receipts), `workflow/src/codehash.ts`, `workflow/workflow.yaml`, `workflow/config.{local,staging,production}.json` |
| CRE project | `project.yaml`, `secrets.example.yaml`, `.env.example`, `scripts/{run-scenario,fallback-runner.sh,liveness.sh,reveal,rpc-check,export-run,organiser-bot}.ts` |
| Controller | `decide.ts` (return legs; recovery/reborrow gates), `solver.ts` (withdraw/borrow candidates), `types.ts` (`Policy` v2 fields, `ActionKind`), `commitment.ts` (`encodePolicyBytes` v2), new `tuned.ts`; `vol.ts` per P2.2 |
| Scenario | `engine.ts` (`hfBpPre`, reserves, `checkOrder`), `mirror.ts` (official liquidation/debt-time/borrow), `mirror.anvil.test.ts`, `scenario.ts` (families split, new test seeds), `starter.ts` (official semantics), `tune.ts` (objective), new `eval.ts` |
| Hunter | `index.ts` (`obsFromTrace` pre-action, `obsFromChain`), `attack.ts` (repay legs), `m2.ts` (bound test), new `sequential.ts` |
| Verifier | new `packages/verifier/src/*` + `bun run verify` |
| Contracts | `src/{ChallengeLending,TokenvETH,TokenvUSD}.sol` (official verbatim), `script/Deploy.s.sol` (roles, open), `test/{ChallengeLending,Fidelity}.t.sol`, `foundry.toml`, `.gitmodules` |
| App | `app/lib/{policy,engine,hunter,runs}.ts`, `app/app/api/chain/**`, `app/app/{verify,replay,hunter}/*`, `app/data/runs/*.json`, `app/.env.example` |
| Docs | `README.md`, `LICENSE`, `docs/{architecture,inference-attack,attack-economics,results,toolchain,organiser-answers,video-script}.md`, `docs/deployment/*`, `docs/evidence/*`, `docs/history/{KEEL-build-plan,KEEL-audit}.md` |
| CI | `.github/workflows/ci.yml` |

---

## 9. Verification — the complete set of commands that must pass

Run from a fresh clone on a machine with Bun (pinned version), Foundry, the CRE CLI and `cloudflared` (only if K6 says it is needed). Each line states what passing proves.

| # | Command | Proves |
|---|---|---|
| V1 | `git clone --recurse-submodules <repo> && cd keel && bun install --frozen-lockfile` | Reproducible dependency set, no missing `contracts/lib`, one lockfile |
| V2 | `bun run typecheck` | All workspaces typecheck, including the workflow against the pinned SDK |
| V3 | `bun run test` | Controller, scenario (incl. Anvil mirror cross-check), hunter (incl. the ≥ jmax bound), verifier, workflow unit tests (incl. official-ABI fixture decode, ≤ 5 HTTP calls, ≤ 5 secrets) |
| V4 | `bun run contracts:test` | Faithful `ChallengeLending` behaviour (spare vETH, burnFrom, repeat liquidation, close()), `PolicyCommit`, `Receipts`, fidelity check |
| V5 | `bun run codehash --check` | `controllerCodeHash` in every config equals the source-tree hash |
| V6 | `bun run e2e` | Controller-level lifecycle on Anvil (existing test, faithful contract, deposit leg exercised) |
| V7 | `bun run e2e:cre` | The **CRE handler** drives commit → approvals → defence → receipts → reveal on Anvil via `cre workflow simulate --broadcast`, within quotas, verifier-consistent |
| V8 | `cre workflow simulate workflow --target staging-settings --non-interactive --trigger-index 0` (`--limits default` implied) | The handler runs against Sepolia under production limits and returns a one-word status |
| V9 | `bun run eval --stage test` (after `--stage train`) | Regenerates `docs/results.md` byte-identically at the recorded commit; the test set was evaluated once |
| V10 | `bun run verify --participant $KEEL_DEMO … --policy … --salt …` | Real on-chain commit, receipts, signer, nonce adjacency and per-round policy consistency on the staging copy → `ALL ROUNDS CONSISTENT` |
| V11 | `cd app && bun run build && bun run test` | App builds; `/verify` API route works against a recorded RPC fixture; no synthetic block numbers |
| V12 | `bun run secrets-gate` (CI grep) | No policy value, salt or private key anywhere outside `*.example*` |
| V13 | `cre workflow list --registry private` **or** `ssh box systemctl status keel-runner` | Production execution exists (branch A/B or C) |
| V14 | `cast call $POLICYCOMMIT "commits(address)((bytes32,address,uint64,uint64))" $KEEL_PROD --rpc-url $SEPOLIA` and `cast call 0x8857… "scenarioStartTime()(uint256)"` | Commitment present; its block precedes the scenario start |
| V15 | `bun run e2e:aave` (Phase 5.6 only) | Adapter works on a Sepolia fork |

CI runs V1–V7, V9 (train stage in check mode), V11, V12 on every push; V8, V10, V13–V15 are run manually and their outputs committed under `docs/evidence/`.

---

## 10. Known unknowns and how each is resolved

| ID | Unknown | Why it matters | Resolution |
|---|---|---|---|
| K1 | Whether organisers call `checkAllHF()` in the same block as `updatevETHPrice()` or after a delay, and the update cadence | Determines whether *any* reactive keeper can survive a large step and therefore the whole ranking (P2.1 item 3) | Ask (P0.5); read the organisers' tx pattern on the copy address they used for the template (`0x63b9…c4B7`) and on the official contract after their run; until answered, tune for `check-then-act` and report both |
| K2 | Exact capital-efficiency and discipline formulas | Scoring mirror constants (`scoring.ts`) | Ask (P0.5); constants isolated; `docs/results.md` states the assumed formulas |
| K3 | Whether capital consumed is net of `withdrawCollateral`/`borrow` | P5.1/P5.2 defaults | Ask; ship both branches off by default; evaluate both accountings |
| K4 | Whether the 5-HTTP-call quota applies identically inside `handlerInTee`, and whether a JSON-RPC batch counts as one call | P3.2 design | Empirical: `cre workflow simulate --limits default` with the batched handler; if batches are rejected, fall back to Multicall3 (1 call for all reads) + one `eth_getLogs` with combined topics (`[[topic_PriceUpdate, topic_Repay, …]]`) + sends = still ≤ 5 |
| K5 | Maximum scenario length (number of price levels) vs the 100 KB response cap (~160 levels) | Ladder reconstruction | Guard in P3.2; if organisers say scenarios are long, add a compact on-chain ladder checkpoint (a `Receipts`-style contract storing `(round, block)` posted with each action) so the enclave only needs logs since the last checkpoint |
| K6 | Whether the simulator's HTTP capability can reach `127.0.0.1:8545` | P3.3 | First attempt; fallback `cloudflared tunnel` built into the script |
| K7 | Whether the faithful copy's runtime bytecode matches the official one after metadata stripping (source path names are in metadata) | Strength of the "faithful" claim | P1.4 fidelity test; if only metadata differs, document it and rely on the verbatim-source + Anvil cross-check |
| K8 | CLI 1.33 ↔ SDK 1.20.1 ↔ Bun version compatibility; `cre-compile` static analysis on `@noble/*` and `viem` | P3.1 | Upgrade and run; record in `docs/toolchain.md`; pin |
| K9 | Whether Confidential Workflows beta is granted at all, and whether `nitro/us-west-2` has capacity for cron every 60 s | P3.5 branch | Wait for email; branch B/C exist |
| K10 | Whether `getSecrets` with more than 5 ids fails under limits | P3.2 | Packed policy secret makes it moot; test the packed form only |
| K11 | Whether `Buffer` is available in the WASM runtime in TEE mode (the SDK runner and the official template both use it) | P3.1 | Surfaces on first `simulate`; if absent, replace with `hexToBase64`/`TextEncoder` helpers from the SDK |
| K12 | Sepolia gas behaviour at 60 s cadence with legacy `gasPrice ×1.25` | Stuck txs | P5.5 stuck-nonce logic; soak run |
| K13 | Whether the organisers will run `close()` (which disables `onlyActive`) before `start()` | Handler gate | Gate on `challengeOpen` (P3.2) so the handler idles rather than reverts; ask (P0.5) |

---

## Appendix A — Findings beyond the audit

1. **Post-action HF everywhere.** `engine.ts` records `Tick.hfBp` after the tick's deposit/repay; `obsFromTrace` and `/verify`'s audit table consume it. Verified: 60/60 acted ticks have `hfBp > armBp`. Every Hunter width in the app and the audit's "225 bp vs 305 bp" were computed on biased observations.
2. **Engine ordering assumption decides the winner.** The engine always applies the defender's action before `checkAllHF()` on the same tick. That is exactly the condition under which a fixed 1.05 keeper cannot lose. The comparison the audit ran is only valid if the organisers behave that way.
3. **Engine reserves are 2× vETH and ~3× vUSD what `join()` gives** (`1000/2_000_000` vs `500/700000`), so capital caps never bind in tuning.
4. **`borrow()` exists on the official contract** — a re-leverage lever that recovers loan-continuity after a repay; nobody has modelled it.
5. **`close()` disables actions** (`challengeOpen=false` ⇒ `onlyActive` fails); the local copy's separate `joinOpen` hides this. The handler also never reads `scenarioEndTime`, so it would keep acting after `stop()`.
6. **Liquidation semantics differ**: official seizes `ceil(debtToRepay·1.05·100/price)`, guards `targetDebt ≥ D`, and can liquidate the same user repeatedly; local copy/mirror round differently and use a sticky flag.
7. **`repay` burns via `burnFrom`** and tokens are OZ `AccessControl`; the local tokens' `transferFrom` path and the missing role grant in `Deploy.s.sol` mean the real token path was never exercised.
8. **CRE quotas** (5 HTTP calls, 100 KB, 5 secrets) make the current handler undeployable as written; the simulator now enforces them by default.
9. **`KEEL_TEE` is read from `process.env` at module load** — unavailable in the WASM runtime.
10. **The app's commitment is synthetic**: `DEMO_CODE_HASH = 0xcece…`, `DEMO_RECEIPTS_ADDR = 0x…01`; `app/lib/engine.ts` recomputes `emergency` (`< 10300` hard-coded) and `reason` instead of using the controller's.
11. **Three lockfiles, two Bun versions**: root, `workflow/`, `app/` each have a `bun.lock`; `workflow` and `tests/e2e` are not workspaces; `@noble/hashes` major versions differ between controller (`^1.5`) and root (`^2.4`).
12. **`attack.ts` forces deposits** (`vUSD: 0n`) and counts only deposit legs as forced actions.
13. **`ChallengeOpened` block is 11661556**; with the public RPC's 50 000-block window the "from opening" scan stops working about a week after opening — `startBlock: 0` was never the only problem.
14. **The private registry allows 3 workflows per org** — enough for `keel-staging` + `keel`, not for per-scenario experiments; use the local target for those.

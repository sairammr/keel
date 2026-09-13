# KEEL — App Build Plan

Continues `HANDOFF.md`. Scope: the **Next.js dashboard** (`app/`) — `/verify`, `/replay`,
`/hunter`, home. Goal: make the app tell the truth end-to-end — every number on screen traces
to a chain event or an honestly-labelled engine demo. No synthetic data dressed as on-chain.

Plan of record for the whole protocol stays `PLAN.md` (Phase 4–6). This doc is the app slice,
sequenced, with the working method made explicit.

---

## 0. Working method (arca coding methodology)

Applied to every task below. Not arca-repo anything — the method only.

- **Golden rule — match effort to size.** Trivial tweak (copy, a className, delete dead demo
  const) → just do it, open the PR, skip the heavy loop. The pipeline is for real features
  (verifier package, chain-reading `/verify`, recorded replay) and non-trivial fixes.
- **Autonomous.** Drive each task to done. Surface only real decisions (the ones parked in §5).
  Don't hand-hold, don't narrate options you won't take.
- **The pipeline** (per non-trivial task):
  1. **Worktree** off the working branch — never edit the mainline directly.
  2. **Understand** — read the code the change touches, trace the real flow first.
  3. **Plan** — what files, what ripples. App is one surface but `lib/*` is shared across 3 routes.
  4. **Code** — smallest diff that works (ponytail ladder: reuse `lib/*` and `keel-controller`
     before writing new; native/stdlib before a dep).
  5. **Code review** — run the `code-reviewer` subagent over the diff, address findings.
  6. **Simplify** — run the strongest `code-simplifier` agent, take behaviour-preserving cleanups.
  7. **Smoke test** — `bun run build` green + click the route.
  8. **Side-effect test** — this is a **frontend, shared-lib** app: a `lib/policy.ts` or
     `lib/engine.ts` change ripples to all three routes. Check every route that imports the
     touched module, not just the one you meant to change.
  9. **Verify the surface — frontend → screenshots.** Run the app, screenshot each affected
     route (demo state AND real/chain state where both exist). Screenshots are the proof.
  10. **Test the feature** — exercise the new behaviour (real participant addr, reveal, toggle).
  11. **PR** — open it, **attach screenshots**, write it to the repo's PR standard.
- **Build memory** — as each route's data source gets wired, note where the truth lives
  (which event, which lib fn) so later tasks don't re-trace.

Verification commands that must stay green throughout (from `HANDOFF.md` §3):
`bun run test` · `bun test workflow/` · `bun run contracts:test` · `(cd app && bun run build)`.

---

## 1. Current app state (ground truth)

| Route | Real today | Fake / demo today |
|---|---|---|
| `/verify` | `LiveOnChain` reads live Sepolia commit + receipt count (real data, Etherscan links) | everything below it: engine-generated ticks, **synthetic blocks `9_000_000 + round*5`**, `DEMO_RECEIPTS_ADDR`, `DEMO_SALT`, per-round audit runs off the engine not chain events |
| `/replay` | — | engine-only split-screen (no recorded chain runs) |
| `/hunter` | — | engine suite only; `attack.ts` counts only deposit legs; `hunter.test.ts` uses a hobbled STARTER |
| home | static copy | fine (labelled narrative) |

Blocking gap: **no `packages/verifier`** — the app cannot reconstruct a per-round audit from
chain events, so `/verify`'s audit table is engine output, not proof.

---

## 2. Task order (dependency-first)

```
A. packages/verifier (P4.1)         ← blocks everything real in the app
B. /verify reads Sepolia (P4.2)     ← needs A
C. recorded split-screen (P4.3)     ← needs A + a two-participant driven run
D. hunter on chain history (P4.4)   ← needs A
E. app-facing polish (P5.3/4, P6)   ← after the above
```

A is the spine. B–D each depend on A and are otherwise independent — once A lands they can go
in parallel worktrees. Do A fully (incl. tests) before opening B.

---

## 3. Tasks

### A — `packages/verifier` (size: feature → full pipeline)

**Why first:** the app's honesty depends on reconstructing rounds from events alone. Pure,
shared, CLI-able; the app and a `bun run verify` command both consume it. (PLAN P4.1.)

Files: new `packages/verifier/src/{reconstruct,audit,index}.ts` + tests; `packages/hunter/src/index.ts` `obsFromChain`.

- **Input:** `PriceUpdate`, `ChallengeStarted`, participant `Join/Deposit/Repay/WithdrawCollateral/Borrow/Liquidated`, `Committed`, `ReceiptPosted` (+ receipt-tx and action-tx `nonce`), optional `(policyBytes, salt)`.
- **Output per round:** `{block, price, C, D, hfBpPre, acted, kind, amount, receipt?, nonceAdjacent}` — derived from events only (C/D from `Join` + subsequent events, no archive node). With reveal: `{armBp, targetBp, expectedDecision, consistent}` via the shared `decide()`; commitment check `keccak(keccak(policy)‖salt) == commits.hash`; signer check via `recoverReceiptSigner`.
- **CLI:** `bun run verify --rpc … --lending … --policyCommit … --receipts … --participant … [--policy … --salt …]` → prints audit table, exits non-zero on any inconsistency.

**Reuse, don't rebuild:** `decide()`, `recoverReceiptSigner`, `receiptDigest`, `encodePolicyBytes`,
`commitmentOf` all already live in `keel-controller`. The verifier is glue + an event reader, not new crypto.

**Acceptance** (PLAN P4.1): tests use the Anvil E2E run's exported logs as fixtures;
`bun run verify` on the staging deployment ends `ALL ROUNDS CONSISTENT`; a deliberately altered
salt ends `COMMITMENT MISMATCH`.

### B — `/verify` reads Sepolia (size: feature → full pipeline)

**Kills the fakes.** (PLAN P4.2.)

Files: `app/app/verify/page.tsx`, new `app/app/api/chain/[...]/route.ts` (server-side viem
`createPublicClient`, RPC key server-side, `revalidate = 30`), `app/lib/policy.ts` (delete
`DEMO_CODE_HASH`, `DEMO_RECEIPTS_ADDR`; use real `codehash` + deployed address), `app/.env.example`.

- Modes: `?participant=0x…` (default `keel-demo` on staging copy; `keel-prod` on official contract selectable).
- Sections wired to chain: **commitment** (on-chain `commits`, `Committed` vs `ChallengeStarted` block, Etherscan links) · **receipts** (from `ReceiptPosted`; digest recomputed; `ecrecover == signer`; nonce adjacency via `getTransaction`) · **reveal** (read `Revealed` or paste; audit table from verifier A).
- Real `blockObserved` replaces synthetic `9_000_000 + round*5`.
- Local-proof mode stays, but **explicitly labelled `DEMO (engine-generated)`** — never mislabelled on-chain. (The existing DEMO banner is the right pattern; keep it, make the fallback use it.)

**Side-effect watch:** `lib/policy.ts` is imported by `/verify` today and possibly others — grep
before deleting the DEMO consts.

**Acceptance** (PLAN P4.2): with `NEXT_PUBLIC_*` set to staging addrs, `/verify` shows real
`Committed` block, ≥2 receipts with ✓, reveal audit for the copy; unset → page says
`DEMO (engine-generated)`; **`grep -rn "9_000_000" app/` returns nothing**; integration test
`app/tests/verify.spec.ts` hits the API route against a recorded RPC fixture.
**Screenshots:** real-participant state + demo-fallback state.

### C — Split-screen on recorded chain runs (size: feature → full pipeline)

(PLAN P4.3.) Files: `app/lib/runs.ts`, `app/data/runs/*.json`, `app/app/replay/*`.

- Prereq run: on the staging copy, drive **both** the unmodified official starter template
  (second wallet) and Keel through the same scenario (the P3.4 driver takes two participants).
  Export both traces from chain logs via verifier A → `app/data/runs/<scenario>.json` with tx hashes.
- Replay page gains `source: chain (recorded) | engine (live)`. Chain renders recorded traces,
  every action links to Etherscan; engine mode is the existing in-browser replay on the tuned
  policy + `hfBpPre`.

**Acceptance:** ≥2 recorded chain runs (a crash + a wick) with real tx links; engine-mode Hunter
strip uses pre-action HF; `app` build green. **Screenshots:** both sources, both scenarios.

### D — Hunter on observed chain history (size: feature → full pipeline)

(PLAN P4.4.) Files: `app/app/hunter/*`, `packages/hunter/src/index.ts` (`obsFromChain` from A).

- `source` selector: engine suite (existing) | chain participant (`?lending=…&participant=…`).
  Against the copy → the recorded starter + Keel runs; against the official contract → any
  `listUsers()` address after the organisers' run.
- Fix the attack model honesty: `attack.ts` currently passes `vUSD: 0n` to force deposits and
  counts only deposit legs. Count repay legs too (with a vUSD reserve) — or label the panel
  "vETH-drain model". Do the former.

**Acceptance:** `/hunter?source=chain&participant=<keel-demo>` renders M1/M2 from real logs with
bp widths; the hobbled STARTER in `hunter.test.ts` is replaced by real official-template starter
semantics. **Screenshots:** engine source + chain source.

### E — App-facing polish (size: mixed — triage each)

Only the pieces that surface in the app. Triage by the golden rule.

- **P5.3 Hunter UI** (feature): sequential-posterior strip (animated, "N observations to a
  50 bp band") + cost-of-certainty curve (hunt price vs confidence 0.5–0.95, starter vs Keel).
- **P5.4 scale framing** (small): the ×N economics toggle must link to `docs/attack-economics.md`;
  **no UI number that isn't in the doc** — unit test reconciles UI ↔ formulas.
- **P6 presentation** (small, mostly copy): home/route copy matches the now-real data; remove any
  claim the app can't back with a chain event or a labelled demo. README app section true.

---

## 4. Definition of done (app)

- [ ] `grep -rn "9_000_000" app/` → nothing; no `DEMO_RECEIPTS_ADDR` / `DEMO_CODE_HASH` left.
- [ ] Every on-chain claim traces to an event via `packages/verifier`; every engine panel is
      labelled `DEMO (engine-generated)`.
- [ ] `/verify`, `/replay`, `/hunter` each offer real-chain + engine modes where both exist.
- [ ] `bun run test` · `bun test workflow/` · `bun run contracts:test` · `(cd app && bun run build)` all green.
- [ ] `bun run verify` on staging → `ALL ROUNDS CONSISTENT`; altered salt → `COMMITMENT MISMATCH`.
- [ ] Screenshots for every route in both modes attached to the PRs.

---

## 5. Decisions for the human (don't default these)

1. **Default participant** on `/verify` / `/replay` — `keel-demo` (staging copy, live now) vs
   waiting for `keel-prod` (official contract, gated on the organisers' run). Recommend: ship on
   `keel-demo` now, make `keel-prod` a selectable mode later — don't block the app on the gate.
2. **Recorded-run scenarios** for C — which two (a crash + a wick is the plan; confirm the exact
   README-family paths to drive on the copy).
3. **RPC provider** for the server route (B) — public caps at 50k blocks; full-range
   `eth_getLogs` on the official contract needs Alchemy/Infura. Staging copy is fine on public.

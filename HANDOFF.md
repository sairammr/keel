# KEEL — Handoff

Repo: https://github.com/sairammr/keel (public, `master`). Built + tested end-to-end locally. Deploy + submission remain — those are human/approval-gated. This doc is what you need to finish.

Cross-reference: `KEEL-build-plan.md` (the full plan — schedule §8, cut ladder §9, risks §10, checklist §11).

---

## 1. Current state — what is DONE and PROVEN

| Component | Path | Status |
|---|---|---|
| Controller (enclave logic) | `packages/controller` | 23 tests green |
| Scenario engine + tuner | `packages/scenario` | 14 tests; tuner runs |
| Hunter (Bayesian adversary) | `packages/hunter` | 7 tests |
| Contracts | `contracts` | 9 forge tests |
| CRE workflow | `workflow` | 9 tests, typechecks + bundles vs real SDK 1.18.0 |
| Dashboard | `app` | Next.js 15, builds clean, 5 routes |
| Real-chain E2E | `tests/e2e` | **E2E PASSED** on local Anvil |

Verify it all yourself:
```bash
bun install
bun test                 # 53 TS tests
bun run contracts:test   # 9 solidity
bun run e2e              # full loop on local Anvil → must end "E2E PASSED"
bun run tune             # winning policy + starter baselines
(cd app && bun run dev)  # dashboard :3000
```

### Proven invariants (from the E2E on chain-id 11155111)
- `join` → position `(500, 700000, hf 111)`.
- Commit block **precedes** `ChallengeStarted` block (the ordering `/verify` checks).
- Crash past the liquidation line: **undefended** hits `hf100 = 99/95/93` (liquidated); controller-defended **survives** at `hf 117/113/110`.
- On-chain `Receipts.digestOf` == off-chain `receiptDigest` (EIP-712 domain + typehash agree).
- On-chain committed `signer` == off-chain `recoverReceiptSigner`.
- `reveal(policyBytes, salt)` succeeds; wrong-salt reveal reverts.

---

## 2. What REMAINS (blocked on external access — see plan §2 gating, §10 risks)

Ordered by the plan's go/no-go checkpoints.

### G1/G2 — CRE CLI + deploy access `[A]`
- Install CRE CLI (`docs → /cre/getting-started/cli-installation/macos-linux`), `cre login`, `cre whoami` → note **Org ID**.
- `cre account access` → request deploy access. Use case: "ETHOnline 2026 Chainlink liquidation-protection challenge, confidential workflow".
- **~24h turnaround.** Do this FIRST.

### G3 — early-access Google form `[B]`
- Form URL in plan §0.3 (same as Confidential Workflows access form). State: ETHOnline 2026, T1+T3, need `handlerInTee` deployment, Org ID, both emails.

### G4 — Discord questions `[B]`
- ETHGlobal Discord → Chainlink channel. Ask: (a) scenario-cadence (seconds between `updatevETHPrice`); (b) the README wick inconsistency (`$1,620` = HF 0.90, "no action" — is `checkAllHF` run every price update?); (c) does capital-consumed net out `withdrawCollateral`? (d) exact capital-efficiency + discipline scoring formulas.
- Answers feed `packages/scenario/src/scoring.ts` (isolated — one-line swaps) and the `withdrawCollateral` decision (plan §4.7, currently OFF).

### G5/G6 — wallets + `join()` `[A]`
- Two fresh Sepolia wallets `keel-prod`, `keel-demo`, each ≥ 0.3 SepETH.
- `cast send 0x88574e7Cc0027afd04951daa09B64d4441931ba1 "join()" --private-key <keel-prod> --rpc-url $SEPOLIA`
- Confirm `getUserPosition(keel-prod)` = `(500, 700000, 111)`. **This key is `liquidation_private_key` for production — never reuse it elsewhere.**

### Deploy contracts to Sepolia `[A]`
```bash
cd contracts
forge script script/Deploy.s.sol --rpc-url $SEPOLIA --broadcast --private-key <deployer>
```
Deploys `PolicyCommit` + `Receipts(policyCommit)`. (`ChallengeLending` copy is only for the demo/local — production uses the official `0x8857…1ba1`.) Record the two addresses.

### Wire the deployed addresses
- `workflow/config.production.json` → official lending `0x88574e7Cc0027afd04951daa09B64d4441931ba1`, your `PolicyCommit`/`Receipts` addresses.
- `app/.env` → `NEXT_PUBLIC_POLICYCOMMIT_ADDR`, `RECEIPTS_ADDR`, `LENDING_ADDR`, `RPC_URL` (so `/verify` reads on-chain instead of local-proof mode).

### Secrets to Vault DON `[A]`
- Fill `workflow/secrets.yaml` from `secrets.example.yaml` with real values: all `keel_*` policy params (use the tuned winner below), a **fresh production `keel_salt`** (32 random bytes), `keel_rpc_url` (private Alchemy), `liquidation_private_key` (keel-prod).
- `cre secrets create secrets.yaml --target production-settings --secrets-auth=browser`
- **Never commit secrets.yaml or .env** (already gitignored).

### Deploy the workflow `[A]`
```bash
cre workflow deploy workflow --target production-settings
cre workflow list --registry private   # screenshot for T3 evidence
```
- If TEE deploy is rejected (private beta, risk R2): set `KEEL_TEE=0` for a plain (non-confidential) deploy so T3 continuity holds; T1 evidence then comes from `handlerInTee` **simulation** (accepted per prize text).
- If no deploy access by Fri (risk R1): run the fallback loop on an always-on box:
  ```bash
  while true; do cre workflow simulate workflow --target production-settings --broadcast --non-interactive --trigger-index 0; sleep 45; done
  ```

### First tick must post the commit BEFORE `start()`
- After deploy, watch for the `COMMITTED` status + the `PolicyCommit.Committed` tx + two `approveMax` txs on Etherscan.
- **This must land before organisers call `start()`.** That ordering is the whole T3 confidentiality proof.

---

## 3. Tuned policy (winning grid result — local train set)

`base_bp 10500, jitter_bp 200, buffer_bp 500, halflife 4, cronPeriod 30`, rest default:
```
kvol_bp 10000, volcap_bp 200, tmax_bp 11100, emerg_bp 10300,
target_cap_bp 12500, cooldown 1, max_repay_bp 3000, max_deposit 250, t_est_s 10800
```
→ 0 liquidations, mean 81.61 on train. Beats starter 1.08/1.15 and crushes do-nothing (0 vs 28 liqs).

**Honest caveat (from tuning):** on benign paths a well-tuned fixed keeper (1.05/1.12) marginally out-scores Keel — because the engine lets any strategy act on the tick it observes the bad price, so survival is a wash there and Keel's upward-only jitter is a deliberate secrecy tax (~14% more capital deployed). Keel's structural win shows on the **attacker family** and the **Hunter panel** (a fixed threshold gets located to ±0.005 and stop-hunted; Keel's band stays ≥ jitter wide). That's the thesis — don't fudge the scoring to force a benign-path win. Re-tune (`bun run tune`) once G4 gives the real scoring formulas.

---

## 4. `controllerCodeHash` — keep it in sync

The committed policy binds the algorithm via `keccak256` of the controller bundle. If you change `packages/controller/src/*`, recompute and update all `workflow/config.*.json`:
```bash
cd workflow && bun run codehash
```
Current value baked into configs: `0x50188e7c…934782`. **Recompute before deploy if controller changed.**

---

## 5. Demo / submission `[B]`

- `/verify` page: set the env addrs for on-chain mode; the **demo salt** is fixed and revealable on camera — the **production salt stays sealed** until Chainlink publishes scores (separate salts, plan §5.1 / R12).
- Video plan: plan §11 (3:30–4:00) + shot-by-shot script §12. Split-screen replay runs the shared controller **in the browser** (not two live simulators — plan R9); on-chain proof comes from real Sepolia txs recorded earlier.
- Submission checklist: plan §11 (T3 + T1 boxes).
- Freeze production Sat 12:00 (CP4); any post-freeze change needs a full local E2E re-run first.

---

## 6. Gotchas found this build (real, already handled)

- **Liquidation boundary is price ≤ $1,794.87** (hf100 = 100), not the README's `$181300`-ish examples. `hf` is integer ×100; true HF 1.009 liquidates. Controller treats `hfBp < 10100` (HF 1.01) as the line, emergency override at HF 1.03. Don't tune to "stay above 1.00" — you'd be dead.
- **`getUserPosition` returns 6 fields** (starter ABI says 5). The workflow decodes `collateral`/`debt` positionally but **always recomputes HF** via `hfBpOf(C,D,price)` — never trusts the decoded tail.
- **`handlerInTee(trigger, fn, {})`** — 3rd arg is the TEE constraint (`{}` = any region), verified against the SDK `.d.ts`. Resolved the plan's [unverified] note.
- **No policy value is ever logged.** Handler returns one-word statuses only (`COMMITTED`/`IDLE`/`SAFE`/`DEFENDED`). Keep it that way (rubric: "no private inputs in logs").
- **Deposit vs repay funding:** `join()` mints the 500 vETH collateral into the lending contract, so the participant holds 0 spare vETH → the solver picks repay (funded from the 700000 vUSD). Real balances are read; not a fudge.
- Contracts pinned to Solidity 0.8.20 with `via_ir = true` (15-field `abi.encode` / 6-field struct → stack-too-deep otherwise).

---

## 7. Quick reference

- Official contract: `0x88574e7Cc0027afd04951daa09B64d4441931ba1` · vETH `0x5dED1a40c3D56dA42E7f932f781c0432556c9814` · vUSD `0x6Fe92Ead5299040f50F095860b5A0A7A2D4041A2` · tokens 2 decimals.
- EIP-712 domain: `{ name: "KeelReceipts", version: "1", chainId: 11155111, verifyingContract }`.
- Frozen interface (do not drift): `packages/controller/src/types.ts`.
- HF: `HF = price / 1794.87`.

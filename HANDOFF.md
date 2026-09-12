# KEEL — Handoff

Repo: https://github.com/sairammr/keel. Working branch: **`feat/verifier-and-real-verify`**
(commits `5589952` → `7bb9e63` → `18dc21d`; open a PR to `main` when ready).

**Verifiable-secrecy liquidation protection on Chainlink CRE.** The controller hides its
health-factor policy, hides what that policy will do next (per-round jitter), *and* proves it
never changed (keccak commit → EIP-712 receipts → reveal). Built, deployed to Sepolia, and
verified end-to-end. The app reads the real chain — no mocked or synthetic data on `/verify`,
and `/hunter` + `/replay` both run over Keel's real on-chain run.

The only external gate left is CRE **DON deployment** (Confidential Workflows early access —
requested, on the waitlist). Everything on our side is one command away when it lands.

Plan of record: `PLAN.md`. App plan: `APP-BUILD-PLAN.md`. Deploy record: `docs/deployment/`.

---

## 1. Status

| Area | State |
|---|---|
| Controller / scenario / hunter (pure TS core) | ✅ controller 23 · scenario 15 · hunter 8 tests |
| Faithful `ChallengeLending` copy + fidelity | ✅ byte-for-byte match vs official deployed bytecode |
| CRE confidential workflow | ✅ `cre workflow simulate` runs the TEE handler under prod quotas (≤5 HTTP calls, batched) |
| **`packages/verifier`** (reconstruct + audit + CLI) | ✅ new; 4 tests; `bun run verify` → **ALL ROUNDS CONSISTENT** on the live stack |
| **`/verify`** app | ✅ server-rendered from Sepolia via the verifier — no synthetic blocks, no demo addrs |
| **`/hunter`** app | ✅ inference-source toggle: engine suite \| **chain** (Keel's real M1/M2 from on-chain logs) |
| **`/replay`** app | ✅ source toggle: engine (live) \| **chain (recorded)** (real run + Etherscan links) |
| Honest attack model | ✅ removed the `max_deposit:6` hobble; funds both reserves, counts repay+deposit legs, adaptive stop-hunt bounded by the liq floor |
| Ops scripts | ✅ `scripts/fallback-runner.sh`, `scripts/liveness.sh` |
| Confidential Workflows access form | ✅ submitted (waitlist), org `org_0NhyfJ57VzhSh1D8` |
| **DON deployment** | ⏳ gated on early-access email; `cre whoami` → Deploy Access **Not enabled**. Google-form early-access request re-raised 2026-09-13 with join/commit tx evidence. Discord staff signal: queue may not clear before deadline → fallback runner is the plan of record |
| Production join + commit on the official contract | ✅ 2026-09-13 — `keel-prod` joined (participant #8) + committed before start + max approvals; txs in `docs/deployment/wallets.md`. Fresh salt + policy (DEFAULT + `tjitter_bp:300`) in `.env.deploy`/`.env`. Prod simulate tick (incl. `--broadcast`) → IDLE ✅. `scripts/keel-runner.launchd.plist` ready for the scenario window |
| Phase 5/6 (levers, hardening, docs, CI) | ⚠️ not done — see §5 |

Last full sweep: **all green** — controller 23 · verifier 4 · hunter 8 · scenario 15 · app build OK · `bun run verify` CONSISTENT.

---

## 2. Live Sepolia deployment (fresh staging stack)

Deployer / admin / participant: `0x9673afB923d556979E4dfe6854d8C6e2D9994Eb4` (funded ~0.98 SepETH; key in `.env.deploy`, gitignored, `chmod 600`).

| Contract | Address |
|---|---|
| `ChallengeLending` (faithful copy) | `0xbc655f2febC8C9642C69BB746568050f53AAAc18` |
| `TokenvETH` | `0xd72f799E1af27E0d95aB4B9658A277A7811Fbcd0` |
| `TokenvUSD` | `0x974727EA649Ee0EfBB6A1b1A584614838B832cB3` |
| `PolicyCommit` | `0xE0e3C43Cc464e08b35Eb28Ff235c437166AFAc71` |
| `Receipts` | `0xf8A66135642a0DeA582e874531Ef45FB2Dd01ee6` |

On-chain proof (verified live): committed hash `0x69f60a2b…`, signer `0x073E0B46…`, commit block
**11682878** (before start), `Receipts.count == 2`, survived a crash that liquidates the
undefended position (rounds 3–5 `hf100` = 99/95/93). Full tx list in `docs/deployment/addresses.md`.
Official contract (production target): `0x88574e7Cc0027afd04951daa09B64d4441931ba1`.

Wallets: `docs/deployment/wallets.md`. `keel-prod` (`0x481ab1C25907dC363d3e6Ee03aE5e651387e9Fe3`)
is the official-contract wallet — **currently 0 SepETH, needs funding** (see §5.2).

---

## 3. How to demo

Three layers of proof: the **app** (reads the real chain), the **on-chain record** (Etherscan
+ `bun run verify`), and the **CRE simulation** (the confidential handler). A 4-minute demo hits
all three.

### 3a. The app (2–3 min, the main visual)

```bash
bun install
(cd app && bun run build && bun run start)      # http://localhost:3000  (reads live Sepolia)
```

Walk the three doors in order:

1. **`/verify`** — start here. The page is server-rendered from Sepolia by `packages/verifier`.
   Show: the live committed hash + signer + block; the receipts table (real tx links, nonces
   57/63); the **ALL ROUNDS CONSISTENT** verdict with commitment ✓ / signer ✓ / digest ✓; then
   the per-round audit — *every action fired exactly when HF crossed the now-revealed trigger.*
   Say: **"private isn't proof — this proves one sealed policy produced every action, without
   ever showing the policy."**

2. **`/replay`** — toggle **source → chain (recorded)**. Keel's real Sepolia run on the HF
   chart: the dashed line is the trigger (revealed + re-derived by the verifier), dots are the
   two defends, every action row links to Etherscan. Toggle back to **engine (live)** for the
   split-screen vs the fixed-threshold starter through any market.

3. **`/hunter`** — toggle **inference source → chain**. The real M1/M2 posterior computed from
   Keel's actual on-chain `(HF, acted?)` log stream; the band stays ≥ the jitter floor. The
   attack console: to force Keel the attacker must crash price to the liquidation edge and Keel
   de-levers — the fixed-threshold starter falls at a shallow, discoverable trigger.

> UI note: the source toggles are client buttons — click the button label directly.

### 3b. On-chain proof (30 s, terminal + Etherscan)

```bash
bun run verify \
  --rpc https://ethereum-sepolia-rpc.publicnode.com \
  --lending 0xbc655f2febC8C9642C69BB746568050f53AAAc18 \
  --policyCommit 0xE0e3C43Cc464e08b35Eb28Ff235c437166AFAc71 \
  --receipts 0xf8A66135642a0DeA582e874531Ef45FB2Dd01ee6 \
  --participant 0x9673afB923d556979E4dfe6854d8C6e2D9994Eb4 \
  --from 11682850
# → commitment OK ✓ · signers OK ✓ · digests OK ✓ · ALL ROUNDS CONSISTENT

bun run scripts/liveness.sh staging      # balance · nonce · state · receipts · OK
```

Open the `commit` and `reveal` txs from `docs/deployment/addresses.md` on Etherscan to show the
commit block precedes `start()`.

### 3c. CRE confidential handler (30 s, the T1 evidence)

```bash
(cd workflow && bunx cre-setup)          # one-time WASM tooling (Javy)
# export the 4 secrets (staging/dummy values ok), then:
KEEL_POLICY='{"base_bp":10700,"kvol_bp":10000,"volcap_bp":200,"jitter_bp":300,"tmax_bp":11100,"emerg_bp":10300,"buffer_bp":500,"target_cap_bp":12500,"halflife":4,"cooldown":1,"max_repay_bp":3000,"max_deposit":250,"t_est_s":10800}' \
KEEL_SALT="0x$(printf '5a%.0s' {1..32})" \
KEEL_RPC_URL="https://ethereum-sepolia-rpc.publicnode.com" \
LIQUIDATION_PRIVATE_KEY="<funded key from .env.deploy>" \
cre workflow simulate workflow --target staging-settings --non-interactive --trigger-index 0
```

Compiles to WASM, runs the TEE handler, does the batched Sepolia read, returns a one-word status
(never a policy value). Simulator evidence is accepted for the confidential-workflow prize.

### 3d. Drive a fresh scenario on-chain (optional, ~2 min of txs)

```bash
KEEL_DEPLOY_KEY=<funded key> bun run scripts/run-scenario-live.ts
# deploys a fresh copy? no — reuses config.staging.json; to get a clean run, redeploy first:
#   (cd contracts && FOUNDRY_PROFILE=official PRIVATE_KEY=<key> forge script script/Deploy.s.sol \
#     --rpc-url $SEPOLIA --broadcast)   then update workflow/config.staging.json addresses.
```

---

## 4. Run & verify everything (from a clean clone)

```bash
bun install
bun run test                     # controller 23 + verifier 4 + hunter 8 + scenario 15
bun run verify --rpc … --lending … --policyCommit … --receipts … --participant … --from …
bun run contracts:test           # forge
bun run codehash --check
(cd app && bun run build)        # 4 routes; /verify is ƒ (server-rendered from chain)
(cd packages/verifier && bunx tsc --noEmit) && (cd packages/hunter && bunx tsc --noEmit)
```

---

## 5. What's left

### 5.1 DON deployment (external gate)
Wait for the Confidential Workflows early-access email (form submitted, org `org_0NhyfJ57VzhSh1D8`).
When granted:
```bash
cre secrets create secrets.yaml --target production-settings --secrets-auth=browser
cre workflow deploy workflow --target production-settings
cre workflow list --registry private          # keel active
cre execution list keel                        # first exec → COMMITTED
```
If TEE is rejected but deploy works: set `workflow/config.production.json` `tee:false`, redeploy
with `cre.handler` (T1 evidence then from the `tee:true` simulator run). If no access at all:
`scripts/fallback-runner.sh production-settings` on an always-on box (same code path, not DON-scheduled).

### 5.2 Production run on the official contract (irreversible — needs a human decision)
Needs `keel-prod` (`0x481ab1…`) **funded** (currently 0 SepETH; use a faucet or transfer) and an
**uncapped RPC** (Alchemy/Infura — public caps `eth_getLogs` at 50k blocks; the official contract
needs full-range reads). Then `join()` on `0x8857…` + commit-before-start with a **fresh production
salt** (`openssl rand -hex 32`, never committed). This burns the one-shot commit gate — do it
deliberately.

### 5.3 On-chain starter duel (optional, makes the chain comparison two-sided)
Currently `/hunter` and `/replay` chain modes show Keel's **real** run and a **labeled engine
baseline** for the fixed-threshold starter. To make the starter side also on-chain, fund a second
wallet, `join()` it on a fresh staging copy, and drive both participants through one market
(extend `scripts/run-scenario-live.ts` to two policies). Then reconstruct both via the verifier.

### 5.4 Remaining depth (Phase 5/6)
- `withdrawCollateral` recovery (P5.1) and `borrow()` re-leverage (P5.2) levers — gated on
  organiser answer K3 (capital measured net vs gross).
- Operational hardening (P5.5): stuck-nonce recovery, RPC fallback, own-liquidation detection.
- `docs/results.md` (tuner scores), CI secrets-gate (P1.5), the Aave-v3 adapter (P5.6).
- Organiser answers **K1–K3** (price cadence, capital gross/net, discipline formula) — the
  scoring formulas are still assumed; they gate the levers and the tuner.

---

## 6. Layout

```
packages/{controller,scenario,hunter}   pure TS core (controller shared with the enclave)
packages/verifier                        reconstruct + audit from chain events; `bun run verify`
contracts/                               Foundry: official/ faithful copy + PolicyCommit + Receipts + fidelity.ts
workflow/                                CRE confidential workflow (TEE handler, batched RPC)
scripts/                                 run-scenario-live.ts · rpc-check.ts · fallback-runner.sh · liveness.sh
app/                                     Next.js: /verify (chain) · /replay (engine|chain) · /hunter (engine|chain)
  app/lib/{deployment,runs,hunter,engine}.ts   chain wiring + engine adapters
docs/deployment/                         addresses.md · wallets.md · access-request.md
```

---

## 7. Secrets & keys
- `.env.deploy` (gitignored, `chmod 600`): funded deployer + generated wallet keys. Never commit.
- `workflow/secrets.yaml` (gitignored) maps secret ids → env vars; `secrets.example.yaml` is the template.
- The handler returns only one-word statuses (`COMMITTED|IDLE|SAFE|DEFENDED|EMERGENCY`) — never a policy value or salt.
- The staging salt `0x5a…5a` is a demo salt (revealed on-chain). The production salt must be fresh and live only in `.env` / the Vault DON.

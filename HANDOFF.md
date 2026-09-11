# KEEL — Handoff

Repo: https://github.com/sairammr/keel (`master`). Verifiable-secrecy liquidation protection: the
controller hides its health-factor policy *and* proves it never changed (commit → EIP-712 receipts →
reveal), running as a Chainlink CRE confidential workflow. Built, deployed to Sepolia, and tested
end-to-end. The only remaining gate is CRE **DON deployment**, which needs Early Access approval
(already requested). This doc is the complete state + how to run/verify everything.

Plan of record: `PLAN.md`. Deploy record: `docs/deployment/`.

---

## 1. Status by phase

| Area | State |
|---|---|
| **Controller / scenario / hunter** | ✅ pure TS, 45 tests (controller 23, scenario 15 incl. Anvil cross-check, hunter 7) |
| **P1.1 official ABI** | ✅ workflow decodes the real `PriceUpdate(uint256,uint256)` + `Repay/Deposit/WithdrawCollateral/Borrow(address indexed user,…)`; topic0 verified on-chain |
| **P1.2 log range** | ✅ `startBlock` required; pre-`ChallengeStarted` PriceUpdate logs excluded; `bun run rpc-check` |
| **P1.3 reproducible codehash** | ✅ keccak of the controller **source tree** (not a build artifact); `bun run codehash --check` |
| **P1.4 faithful contract** | ✅ verbatim official 0.8.36 source in `contracts/src/official/`, **byte-for-byte MATCH** vs deployed 0x8857…1ba1 (`fidelity.ts`); mirror ported exactly, 200-seq Anvil cross-check (6870 assertions) |
| **P3.1/P3.2 CRE runtime** | ✅ real `cre init`-shaped project (`project.yaml`, `workflow/workflow.yaml`, zod config, packed secrets, WASM-safe handler); `cre workflow simulate` compiles to WASM, runs the `handlerInTee`, batched ≤5-call read against Sepolia, returns a status |
| **Live on Sepolia (staging)** | ✅ deployed + a full crash scenario ran on-chain: commit-before-start, 2 real defends + EIP-712 receipts, reveal |
| **App** | ✅ builds; `/verify` reads the **live** staging commit + receipts from Sepolia (real data + Etherscan links), plus an in-browser demo of the same crypto |
| **DON deployment** | ⏳ gated on CRE Early Access — requested (`docs/deployment/access-request.md`); simulation works without it |
| **Phase 4 (full app on-chain)** / **Phase 5–6** | ⚠️ not done: `/verify` shows live commit+receipts but not the full per-round on-chain audit; recovery/reborrow levers, verifier package, results.md, CI, docs — see PLAN.md |

---

## 2. Live Sepolia deployment (real)

Deployer / admin / participant: `0x9673afB923d556979E4dfe6854d8C6e2D9994Eb4` (funded; key in `.env.deploy`, gitignored).

| Contract | Address |
|---|---|
| `ChallengeLending` (faithful copy) | `0x0DCC9ca6262b658E8cbD29bdCe18b5ca370e3949` |
| `TokenvETH` | `0xE08232A16e7109d276edac850D88ABBFaC6e2F7A` |
| `TokenvUSD` | `0x236263155D275448fa95BC6295fAb579f099fe76` |
| `PolicyCommit` | `0xACbf2d364817AB8c42C6573C748702BE0f7aAA6b` |
| `Receipts` | `0x726717FBe26e1502c5575647d1D46E618e912Aee` |

On-chain proof (verified live): committed hash `0x69f60a2b…`, signer `0x073E0B46…`, commit block **11682596**,
`Receipts.count == 2`. Full tx list (commit-before-start, defends, receipts, reveal) in
`docs/deployment/addresses.md`. Official challenge contract (production target): `0x88574e7Cc0027afd04951daa09B64d4441931ba1`.

---

## 3. Run & verify everything

From a fresh clone with Bun + Foundry + the CRE CLI installed:

```bash
bun install                          # workspaces (controller/scenario/hunter)
(cd workflow && bun install)         # workflow deps (separate — not yet a workspace, P1.5)

bun run test                         # controller 23 + scenario 15 (incl. Anvil cross-check) + hunter 7
bun test workflow/                   # workflow unit tests (19): official ABI, ≤5-call batch, packed secrets
(cd workflow && bunx tsc --noEmit)   # workflow typecheck
bun run codehash --check             # controllerCodeHash == source-tree hash everywhere
bun run contracts:test               # forge: 13 (ChallengeLending + PolicyCommit + Receipts)
(cd contracts && FOUNDRY_PROFILE=official forge build --skip test --skip script && bun run script/fidelity.ts)  # → MATCH
bun run e2e                          # controller-level lifecycle on Anvil → E2E PASSED
(cd app && bun run build)            # Next.js build (5 routes)
```

**Last full sweep: all green** — controller 23 · scenario 15 · hunter 7 · workflow 19 · forge 13 · fidelity MATCH · codehash OK · E2E PASSED · app build OK.

### CRE workflow simulation (the confidential handler under the real runtime)

```bash
(cd workflow && bunx cre-setup)      # one-time WASM tooling (Javy)
# export the 4 secrets (dummy/staging values ok for sim), then:
KEEL_POLICY='{"base_bp":10700,"kvol_bp":10000,"volcap_bp":200,"jitter_bp":300,"tmax_bp":11100,"emerg_bp":10300,"buffer_bp":500,"target_cap_bp":12500,"halflife":4,"cooldown":1,"max_repay_bp":3000,"max_deposit":250,"t_est_s":10800}' \
KEEL_SALT="0x$(printf '5a%.0s' {1..32})" \
KEEL_RPC_URL="https://ethereum-sepolia-rpc.publicnode.com" \
LIQUIDATION_PRIVATE_KEY="<funded key from .env.deploy>" \
cre workflow simulate workflow --target staging-settings --non-interactive --trigger-index 0
```

Compiles to WASM, runs the TEE handler, does the batched Sepolia read, returns a status. Current staging
scenario is stopped → returns `IDLE` (correct gate). To see `DEFENDED`, run against a fresh **started**
staging copy with a price drop.

### Drive a real scenario on Sepolia

```bash
KEEL_DEPLOY_KEY=<funded key> bun run scripts/run-scenario-live.ts   # deploy(if needed)→commit→start→crash→defend→receipts→reveal, all on-chain
```

---

## 4. Secrets & keys

- **`.env.deploy`** (gitignored, `chmod 600`) holds the funded deployer key `KEEL_DEPLOY_KEY` and generated wallet keys. Never commit it.
- **`workflow/secrets.yaml`** (gitignored) maps secret ids → env vars; `secrets.example.yaml` is the committed template. Real values come from env / the Vault DON, never the repo.
- The handler returns only one-word statuses (`COMMITTED|IDLE|SAFE|DEFENDED|EMERGENCY`); it never logs a policy value or salt.
- Salt `0x5a…5a` used on staging is a **demo** salt (revealed on-chain). The production salt must be fresh (`openssl rand -hex 32`) and never written anywhere but `.env` / the Vault DON.

---

## 5. What's left

1. **DON deployment** — wait for CRE Early Access (requested). Then `cre workflow deploy workflow --target staging-settings`, activate, and the workflow appears at `app.chain.link/cre/workflows`. Nothing else blocks it; the workflow already simulates.
2. **Production run** — `join()` + commit-before-start on the official contract from `keel-prod`, with a fresh production salt; needs an uncapped RPC (Alchemy/Infura) for full-range `eth_getLogs` (public RPC caps at 50k blocks).
3. **Phase 4 depth** — extend `/verify` to reconstruct the full per-round on-chain audit (currently shows live commit + receipt count); split-screen replay on recorded chain runs.
4. **Phase 5/6** — recovery/reborrow levers, `packages/verifier`, generated `docs/results.md`, CI (`P1.5`), the doc set. See `PLAN.md`.

---

## 6. Layout

```
packages/{controller,scenario,hunter}   pure TS core (+ mirror cross-checked vs Anvil)
contracts/                              Foundry: official/ (faithful copy) + PolicyCommit + Receipts + fidelity.ts
workflow/                               CRE confidential workflow (main.ts handlerInTee, chain.ts batched RPC)
project.yaml, workflow/workflow.yaml    CRE project descriptors (cre init layout)
scripts/                               rpc-check.ts, run-scenario-live.ts
app/                                    Next.js dashboard (/verify live-wired, /replay, /hunter)
docs/deployment/                        addresses.md, wallets.md, access-request.md
tests/e2e/                              controller-level Anvil E2E
```

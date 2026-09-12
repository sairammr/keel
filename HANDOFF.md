# KEEL — Handoff (2026-09-13, pre-deadline)

Repo: https://github.com/sairammr/keel (**PRIVATE — must flip to public before judging**).
Branch: `master` (pushed, head `504a2e2`). Old feature branch `feat/verifier-and-real-verify` is merged history — ignore.

**Verifiable-secrecy liquidation protection on Chainlink CRE.** Policy (trigger/target/caps)
lives only in the Nitro enclave and moves every round (vol-adaptive + salt jitter); secrecy is
provable via keccak commit before start → EIP-712 receipts signed in-TEE per action → reveal
after. Entered in **two tracks**: T3 Automated Liquidation Protection Challenge ($500) and
T1 Best Confidential Workflow ($2,000). T2 is continuity-only (repo predates event) — not eligible.

**DEADLINE: Sept 13, 16:00 UTC (9:30 PM IST).** After it: workflow frozen; Chainlink runs the
one-shot scenario on the official contract within 24h (`close()` → `start()` → `updatevETHPrice()`
rounds → `checkAllHF()` partial liquidations → `stop()` writes `loanContinuityScore` on-chain).

---

## 1. Status

| Area | State |
|---|---|
| Core (controller/scenario/hunter/verifier) | ✅ tests: controller 26 · hunter 10 · verifier 5 · policy 9 · scenario 14 (+1 flaky Anvil-fuzz receipt-timeout under load — logic clean, 4.9k asserts pass) |
| **join() on official contract** | ✅ participant #8 `keel-prod`, 5 vETH / 7000 vUSD / HF 1.11 |
| **Commit-before-start** | ✅ block 11691103, commit `0xc6d21b2d…`; handler-side re-derivation == on-chain |
| **Approvals** | ✅ max vETH + vUSD from keel-prod to lending |
| Gas | ✅ 0.35 SepETH on keel-prod (deployer holds ~0.6 more) |
| **Workflow** | ✅ `handlerInTee`, 4 Vault secrets, ≤2 HTTP/tick, one-word statuses. **Two triggers**: cron (60s heartbeat, index 0) + `PriceUpdate` log trigger (LATEST confidence, index 1). Both simulate green |
| tjitter parser fix | ✅ `workflow/src/policy.ts` accepts optional `tjitter_bp` — before this the v2 restore-jitter never reached the enclave and would have broken the commitment match |
| controllerCodeHash | ✅ `0xd0897455…` (source-tree = configs = app; `bun run codehash --check` green). Commit binds it — **do not touch `packages/controller/src` any more** (workflow/src is free) |
| Official-scenario eval | ✅ committed policy: **0 liquidations, mean 81.48, 20/20 continuity, least capital** — beats tuned-grid winner + starter on the official README paths (`scripts/eval-official.ts`, results in `docs/results.md`) |
| **Fallback runner** | ✅ LIVE — pid via `pgrep -f fallback-runner`, `caffeinate -i` wrapped, logs `/tmp/keel-runner.log`, ticks every 45s (IDLE until start()). launchd blocked by macOS Documents TCC — runner is a detached nohup process; **dies on reboot, restart cmd in §4** |
| DON deploy access | ⏳ `cre whoami` → Not enabled. CW Google form filled in Chrome tab (user must tick terms + submit). Discord: queue 24–48h, may not clear pre-deadline; **simulation is what's judged** (Darby, on record) |
| ETHGlobal submission | ⏳ draft started (KEEL / DeFi / ⚓ filled, not created). Paste-ready copy: `docs/submission.md`. Must tick **Chainlink T1 + T3** |
| Demo video | ❌ NOT recorded. ≤4 min, no speed-ups (manually verified). Script `docs/video-script.md`, beats in `docs/submission.md` |
| Discord post | ⏳ drafted (idea + tx list + fork-vs-standalone question) — in session log, not posted |

## 2. On-chain records (Ethereum Sepolia)

**Official stack** (production target, `workflow/config.production.json`):

| What | Address / tx |
|---|---|
| ChallengeLending (official) | `0x88574e7Cc0027afd04951daa09B64d4441931ba1` |
| vETH / vUSD | `0x5dED1a40c3D56dA42E7f932f781c0432556c9814` / `0x6Fe92Ead5299040f50F095860b5A0A7A2D4041A2` |
| PolicyCommit (prod) | `0xACbf2d364817AB8c42C6573C748702BE0f7aAA6b` |
| Receipts (prod) | `0x726717FBe26e1502c5575647d1D46E618e912Aee` |
| Participant `keel-prod` | `0x481ab1C25907dC363d3e6Ee03aE5e651387e9Fe3` |
| join() | `0x6a918f1241d0a33275100818e530a456b74b495f5d67b6063b1ac7ddeb7d3297` |
| commit() | `0x1a97b6fb0cd73fdffbaf24006a01713e6b30cec79e1cae7f64b334872fa3d7a2` |
| approve vETH / vUSD | `0xbb1a1863…13267` / `0xfa32b548…35f84` |

**Staging stack** (full verified run: commit → 2 defends + receipts → reveal → `bun run verify`
→ ALL ROUNDS CONSISTENT): addresses + tx list in `docs/deployment/addresses.md` / `wallets.md`.

## 3. Secrets (never commit; all gitignored)

- `.env.deploy` (chmod 600): `KEEL_DEMO_KEY/ADDRESS`, `KEEL_PROD_KEY/ADDRESS`, `KEEL_DEPLOY_KEY/ADDRESS`, **`KEEL_PROD_SALT`** (the sealed production salt), **`KEEL_PROD_POLICY`** (JSON, = DEFAULT + `tjitter_bp:300` — exactly what the commit binds).
- `.env` (repo root, chmod 600): the four workflow env names (`KEEL_POLICY`, `KEEL_SALT`, `KEEL_RPC_URL`, `LIQUIDATION_PRIVATE_KEY`) + `CRE_ETH_PRIVATE_KEY` — this is what simulate/runner read.
- Staging salt `0x5a…5a` is demo-only (already revealed on-chain). Prod salt must never appear anywhere public until the post-run reveal.

## 4. Ops — scenario window (the only part that matters after deadline)

Mac must stay awake (lid open; `caffeinate -i` already wraps the runner).

```bash
# runner health
pgrep -f fallback-runner && tail -5 /tmp/keel-runner.log      # expect "tick ok" every ~45-75s

# restart after reboot/kill (from repo root)
cd ~/Documents/GitHub/keel && nohup bash -c 'set -a; source .env; set +a; export PATH="$HOME/.cre/bin:$PATH"; exec caffeinate -i ./scripts/fallback-runner.sh production-settings 45' >> /tmp/keel-runner.log 2>&1 &

# if/when Deploy Access flips to Enabled (cre whoami) — two commands, then the DON does the window:
cre secrets create secrets.yaml --target production-settings --secrets-auth=browser
cre workflow deploy workflow --target production-settings
cre workflow list --registry private && cre execution list keel
```

During the run, watch: `cast call <lending> "positions(address)(uint256,uint256,uint256,uint256,uint256)" <keel-prod>`
and Etherscan on keel-prod. After `stop()`: run the verifier against the official stack + reveal
(`PolicyCommit.reveal(policyBytes, salt)` — encode via `commitmentOf`/`encodePolicyBytes` with
`KEEL_PROD_POLICY`+`KEEL_PROD_SALT`), then `/verify` tells the whole story.

## 5. Human to-dos before 16:00 UTC (priority order)

1. **Record video** (≤4 min). Beats + script: `docs/submission.md` §demo, `docs/video-script.md`.
2. **ETHGlobal**: ethglobal.com/events/ethonline2026/project → create (KEEL/DeFi/⚓ prefilled in Chrome tab) → paste from `docs/submission.md` → tick **Chainlink T1 + T3** → submit.
3. **Repo → public** (Settings → Danger Zone). Safe: secrets gitignored, prod salt never committed.
4. **CW access form** (Chrome tab, all fields filled): tick Private Beta Terms + submit.
5. Optional: post the drafted Discord message in #partner-chainlink (idea + tx list + fork-vs-standalone question) — staff replies double as judge visibility.

## 6. Field intel (Discord scrape + on-chain recon, details in `docs/discord-partner-chainlink-log.md`)

- 8 participants total. Fully armed: `0x6c4c…` (ERC-8004 agent angle), `0xb8AD…` (clean-opsec fresh wallet), us. `0x12Fbc…` (nonce 898) is the sophisticate — own staging stack, MockKeystoneForwarder `report` testing, MetaMask Delegation Toolkit — but no approvals on official yet. `0xBe23…` approved vUSD only → **repay-only defender** (bleeds continuity). Two look inactive.
- Staff on record: **simulation is what's judged**; CW access only via the Google form (CLI `cre account access` is a different system); judges assess confidentiality manually — repo/config/log inspection + "execution receipt" evidence (our receipts hit that rubric line verbatim).
- Nobody else in the field claims verifiable secrecy / inference-attack resistance.

## 7. Verify everything from a clean clone

```bash
bun install && bun run test
bun run codehash --check
bun run verify --rpc https://ethereum-sepolia-rpc.publicnode.com \
  --lending 0xbc655f2febC8C9642C69BB746568050f53AAAc18 \
  --policyCommit 0xE0e3C43Cc464e08b35Eb28Ff235c437166AFAc71 \
  --receipts 0xf8A66135642a0DeA582e874531Ef45FB2Dd01ee6 \
  --participant 0x9673afB923d556979E4dfe6854d8C6e2D9994Eb4 --from 11682850   # staging: ALL ROUNDS CONSISTENT
bun run scripts/eval-official.ts                                             # official-path scores
(cd app && bun run build && bun run start)                                   # /verify /replay /hunter (live chain)
set -a; source .env; set +a
cre workflow simulate workflow --target production-settings --non-interactive --trigger-index 0   # cron → IDLE
# log trigger (replay a real PriceUpdate):
cre workflow simulate workflow --target staging-settings --non-interactive --trigger-index 1 \
  --evm-tx-hash 0x85b86646f0fc9dda99d5c6c94e35cff92ef3e7abf84e750f64781a775e88a38a --evm-event-index 0
```

## 8. Layout

```
packages/{controller,scenario,hunter,verifier}   pure TS core + engine + attacker + auditor
contracts/                                        Foundry: faithful copy + PolicyCommit + Receipts
workflow/                                         CRE confidential workflow (TEE handler, 2 triggers)
scripts/                                          commit-prod.ts · eval-official.ts · fallback-runner.sh · liveness.sh
app/                                              Next.js: /verify · /replay · /hunter (real chain)
docs/                                             submission.md · results.md · video-script.md · inference-attack.md
                                                  cre-bootcamp/ (16 scraped pages) · discord log · deployment/
```

Open scoring assumptions (K1–K3: price cadence, capital gross/net, discipline formula) remain
unanswered by organisers — survival + action counts don't depend on them; only decimals of the mean do.

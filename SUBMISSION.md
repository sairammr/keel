# KEEL — verifiable-secrecy liquidation protection

> The starter hides the number. Keel hides the number, hides what the number will do
> next, and **proves the number never changed** — that is the difference between
> secrecy and *verifiable* secrecy.

Built at **ETHOnline 2026**. Live pages: `/` (product) · `/pitch` (deck) · `/replay` ·
`/hunter` · `/verify` — every number on screen traces to a chain event or an
honestly-labeled engine run.

---

## The product, in plain words

Anyone with a leveraged lending position on-chain has a liquidation price — and if a
bot defends that position, the bot has a **trigger**: the health factor at which it
acts. That trigger is the most valuable secret in the whole setup, and today it leaks
by default:

- Your collateral, debt, and wallet balances are public.
- Every action or inaction your bot takes at a given price is **one bit of a binary
  search** over its trigger. Three well-placed price pushes locate a fixed threshold
  to ±0.005 HF — a **$9 price window**.
- A located trigger plus a public reserve is a drain plan: push price to the line,
  force a defensive spend, repeat until the reserve is gone, then push through it.

This is not hypothetical behavior: whales get publicly hunted (a $521M short on
Hyperliquid drew coordinated "8 figures committed" hunts), and one visible oversized
position triggered Solend's $170M seizure panic.

Putting the bot in a TEE does **not** fix this. Hidden code still produces visible
behavior, and the behavior is what leaks. Privacy that only hides the source is trust,
not protection.

**KEEL is a liquidation-defense agent whose trigger cannot be located from its
behavior — and whose honesty can be independently verified after the fact.**

## The three mechanisms

**1. The tripwire moves (non-invertible trigger).**
`trigger = clamp(base + k·σ + jitter(HMAC(salt, price-level)))`. One fresh,
deterministic-but-secret draw per price level, shifted **only upward** — randomness can
make Keel act *earlier*, never later, so it never costs survival. No sequence of
observations narrows the base below the jitter width: an action proves the trigger was
above the observed HF, an inaction proves it was below — but the fresh draw means the
next trigger is somewhere new in the band regardless. The restore *target* is jittered
by an independent draw too, so even the position Keel restores to leaks nothing. Formal
write-up: `docs/inference-attack.md`.

**2. The sealed envelope (commit → receipts → reveal).**
Before the market moves, Keel commits `keccak256(policyHash ‖ salt)` on-chain. Every
defense it makes carries an **EIP-712 receipt** signed by a key derived from the salt
*inside the enclave*. Afterward, `reveal(policy, salt)` makes the whole thing public —
and anyone can recompute every round's trigger from public `PriceUpdate` logs and check
that every action matched the policy that was sealed before anything happened. Private
during, provable after.

**3. Survival by construction.**
A hard floor trigger and an emergency override sit *under* all the cleverness. The
clever part can only ever move action earlier.

## We shipped the attacker

Talk is cheap, so the repo includes the adversary: a real Bayesian **Hunter** that
watches public `(HF, acted?)` streams and runs two estimators — M1 (assumes a fixed
threshold) and M2 (models base + jitter). Against the fixed-threshold starter, M1
collapses to a point in ~3 observations. Against Keel, the honest metric — the
predictability of the *next* trigger — is floored at the jitter width (≥300 bp) no
matter how long it watches. The `/hunter` page runs this live, including a full attack
simulation where the starter gets stop-hunted and Keel forces the attacker to the
liquidation edge.

## What is real, on-chain, right now

| Artifact | Where |
|---|---|
| Official challenge joined (participant #8) | `join()` tx `0x6a918f12…7d3297` |
| Policy hash sealed **before scenario start** | commit tx `0x1a97b6fb…2fa3d7a2`, block 11691103 |
| Sealed commitment | `0xc6d21b2d…5ce1e355` on PolicyCommit `0xACbf2d36…7aAA6b` |
| Full dress-rehearsal on our staging copy | commit-first-tick → autonomous defends with signed receipts → reveal → verifier prints **ALL ROUNDS CONSISTENT** |
| Byte-fidelity of our test contract | `bun run script/fidelity.ts` proves our local `ChallengeLending` matches the deployed official bytecode (metadata stripped) |

## Results (official 5 scenarios, byte-proven engine)

| strategy | mean | worst | liquidated | capital used |
|---|---|---|---|---|
| **Keel — committed policy** | **81.48** | 79.53 | **0 / 5** | **1,146,950** |
| Tuned grid winner | 81.38 | 79.55 | 0 / 5 | 1,200,650 |
| Starter 1.08 / 1.15 | 81.39 | 79.46 | 0 / 5 | 1,197,800 |
| Do nothing | 42.08 | 40.79 | 5 / 5 | 0 |

Zero liquidations, 20/20 loan continuity in every scenario, least capital of any
surviving strategy — with a trigger no observer can locate. Full provenance:
`docs/results.md`.

## Architecture

A Chainlink CRE **confidential workflow**: two triggers (60s cron heartbeat + a
`PriceUpdate` log trigger for instant reaction) wake a `handlerInTee` running in a TEE.
The handler pulls four Vault DON secrets (policy, salt, RPC credential, signer key),
reads the chain in **one batched call**, decides, defends when armed, posts the signed
receipt, and reports a single status word — `IDLE · SAFE · DEFENDED` — so nothing
numeric ever leaves the enclave. Quota-compliant (≤5 HTTP calls per tick).

```
cron 60s ─┐
          ├─▶ CRE confidential workflow ──▶ one batched read ──▶ Sepolia
log trig ─┘      handlerInTee (TEE)     ◀── defend tx + EIP-712 ──  ChallengeLending
                 Vault DON: 4 secrets                               PolicyCommit · Receipts
```

## Who this is for (beyond the challenge)

- **Leverage loopers** — billions in looped staked-ETH debt sits near HF 1.05 on Aave;
  defending it today telegraphs the exact level where forced buys happen.
- **Funds & DAO treasuries** — run a private defense, then *prove* to LPs and token
  holders the committed policy ran unchanged.
- **Automation providers** — today's position automation runs fully public triggers;
  Keel is the confidential drop-in with per-action receipts as the honesty proof.

## Run it yourself

```bash
git clone https://github.com/sairammr/keel && cd keel && bun install

bun test packages workflow          # 75 tests
bun run typecheck

# the app (reads live Sepolia)
cd app && bun run build && bun run start    # http://localhost:3000

# independently audit a recorded run from public logs only
bun run verify --rpc <sepolia-rpc> \
  --lending <lending> --policyCommit <policyCommit> --receipts <receipts> \
  --participant <participant> --from <startBlock>

# the confidential workflow, under production quotas
cre workflow simulate workflow --target staging-settings --non-interactive --trigger-index 0
```

## Honest status — what's simulated and what isn't

- The TEE path runs under `cre workflow simulate` (identical `handlerInTee` code path);
  DON scheduling awaits Confidential Workflows early access. A fallback runner
  (`scripts/fallback-runner.sh`) loops the same handler on an always-on box.
- The receipt-signing key is **derived from the salt**, not hardware attestation — by
  design, so the reveal is reproducible by anyone.
- The official scenario window runs post-deadline; our commit at block 11691103 already
  binds whatever happens there to the policy sealed today.

## Repo map

```
packages/controller   decide/solve, HF math, jitter, commitment, receipts (unit-tested)
packages/scenario     byte-proven ContractMirror engine + official scenario suite
packages/hunter       the Bayesian adversary (M1/M2, attack simulation)
packages/verifier     chain reconstruction + independent audit (CLI + app)
workflow/             the CRE confidential workflow (cre-init shaped, WASM-safe)
contracts/            faithful official contract copy + PolicyCommit + Receipts
app/                  Next.js product: / · /pitch · /replay · /hunter · /verify
docs/                 inference-attack.md · results.md · video-script.md · deployment/
```

# ETHOnline 2026 — Submission form (copy-paste ready)

Each section below maps 1:1 to a field on the ETHGlobal project form.

---

## Project name

KEEL

## Category

DeFi

## Emoji

⚓

## Demo link

https://keel-ebon-six.vercel.app/

## Short description (≤100 chars)

Liquidation protection whose strategy is sealed in a TEE — and provably never changed.

## Description

Every on-chain liquidation-protection bot has a secret: the health factor at which it acts. That trigger is the most valuable number in the whole setup, and today it leaks by default. Collateral, debt, and wallet balances are public, so every action or inaction the bot takes at a given price is one bit of a binary search over its trigger — three well-placed price pushes locate a fixed threshold to ±0.005 HF. A located trigger plus a public reserve is a drain plan: push price to the line, force a defensive spend, repeat until the reserve is empty, then push through it. Whale positions get hunted like this in the real world (Hyperliquid's $521M short, Solend's $170M seizure panic).

Putting the bot in a TEE does not fix this. Hidden code still produces visible behavior, and the behavior is what leaks.

KEEL is a liquidation-defense agent whose trigger cannot be located from its behavior — and whose honesty can be independently verified afterwards. Three mechanisms:

1. **The tripwire moves.** trigger = clamp(base + k·σ + jitter(HMAC(salt, price-level))). One fresh, deterministic-but-secret jitter draw per price level, shifted only upward — randomness can make Keel act earlier, never later, so it never costs survival. No sequence of observations narrows the base below the jitter width.

2. **The sealed envelope.** Before the market moves, the enclave commits keccak256(policyHash ‖ salt) on-chain. Every defense carries an EIP-712 receipt signed by a key derived from the salt inside the enclave. Afterwards, reveal(policy, salt) lets anyone recompute every round's trigger from public PriceUpdate logs and check every action matched the policy that was sealed before anything happened. Private during, provable after.

3. **Survival by construction.** A hard floor trigger and an emergency override sit under all the cleverness; the clever part can only ever move action earlier.

We also shipped the attacker: a real Bayesian Hunter that watches public (HF, acted?) streams. Against the fixed-threshold starter it collapses to a point estimate in ~3 observations; against Keel its uncertainty is floored at the jitter width no matter how long it watches. The live app runs the replay, the Hunter, a full stop-hunt attack simulation, and a /verify page that reconstructs everything from Sepolia events — commitment block before scenario start, receipt signature recovery, reveal preimage check, per-round trigger audit.

On the official 5 challenge scenarios (run on a byte-proven mirror of the deployed contract): zero liquidations, 20/20 loan continuity, and the least capital consumed of any surviving strategy — with a trigger no observer can locate. The policy commitment is already sealed on Sepolia, posted before the official scenario window.

## How it's made

The core is a Chainlink CRE **confidential workflow**: a `handlerInTee` woken by two triggers (60s cron heartbeat + a `PriceUpdate` log trigger for instant reaction) that runs the entire protection loop inside the enclave and returns a single status word — IDLE / SAFE / DEFENDED — so nothing numeric ever leaves the TEE. Chainlink CRE is what makes the thesis possible at all: Vault DON secrets released only to the enclave mean the salt (which drives the jitter, the receipt-signing key, and the commitment) genuinely never exists outside it.

**How the protection loop actually works, tick by tick.** The enclave is stateless, so every tick it rebuilds the world from public data: one batched read (≤5 HTTP calls, quota-compliant) fetches `vETHPrice`, the position struct, `scenarioStartTime`, all `PriceUpdate` logs since the scenario started, and its own past `Repay`/`Deposit` logs. The price-update count is the **round number** — the clock everything else runs on.

From `collateral × price × 0.78 / debt` it computes the health factor in basis points, using the contract's own integer math (the on-chain `hf` is a floored ×100 integer, so true HF 1.009 already liquidates — Keel treats HF 1.01 as the real liquidation line, not 1.00). Then it builds this round's trigger from three layers:

1. **Volatility term** — an EWMA over log-returns of the price series (half-life ~4 updates) scales the trigger up when the market moves fast, capped at +0.02 so an attacker who manufactures volatility can't drag the trigger up indefinitely.
2. **Jitter** — `HMAC-SHA256(salt, round)` mapped to a uniform draw in `[0, jmax)`, added **upward only**. One fresh draw per price level; re-used while price sits still, so camping at one level leaks nothing new. Upward-only is the survival proof: randomness can only make Keel act *earlier*, never later.
3. **Hard floor + emergency override** — the base trigger is the floor under everything, and if HF ever drops below the emergency line the controller acts immediately, ignoring jitter, cooldown, and per-action caps. Survival never depends on the clever part.

If HF ≤ armed trigger (and a one-price-level cooldown has passed), a **cost solver** decides *what* to do, not just *that* it acts: it prices repay vs deposit in expected score points — repay lifts HF ~35% more per dollar but forfeits debt-time score, so deposit wins early in the scenario and repay wins late — and solves for the exact amount that restores HF to a **jittered target** (an independent draw, so even the level Keel restores to leaks nothing). Then it signs the defend tx inside the enclave, signs an EIP-712 receipt with a key derived from the same salt, and sends both — action at nonce n, receipt at n+1, same EOA, so the binding is checkable on Etherscan.

The controller is one pure, integer-math package (contract-exact arithmetic, no boundary mismatch), and the exact `decide()` that runs in the enclave is the exact function the replay and the Hunter's attack simulator import — one source of truth, no demo-vs-prod drift.

On-chain: `PolicyCommit` (one-shot commit, reveal verifies keccak256(policyHash ‖ salt)) and `Receipts` (EIP-712, ecrecover must equal the committed signer), plus a byte-for-byte copy of the official `ChallengeLending` — proven identical to the deployed bytecode by a fidelity script (metadata stripped), then property-tested against a real local deployment over 200 random action sequences so our scoring mirror is trusted, not assumed. The policy commitment includes a reproducible keccak hash of the controller source tree, so the reveal binds the algorithm, not just the numbers.

The statelessness is also what makes verification possible: because the jitter round is just the public price-update index, anyone holding the revealed salt can replay every round's trigger from logs alone and audit every action and every inaction. The verifier does exactly that — it never trusts a receipt's self-reported HF, it recomputes it independently from `PriceUpdate` logs and flags mismatches.

## GitHub repository

https://github.com/sairammr/keel

## Tech stack (form checkboxes / tags)

TypeScript · Bun · Chainlink CRE (confidential workflows, handlerInTee, Vault DON) · viem · Foundry · Solidity · Next.js 15 · Vercel · @noble/hashes · Anvil · Ethereum Sepolia · EIP-712

## Select prizes

- Chainlink — T3: Automated Liquidation Protection Challenge
- Chainlink — T1: Best Confidential Workflow

## Prize form — Chainlink

**How are you using this Protocol / API? / Why applicable:**

The entire product runs as a Chainlink CRE confidential workflow: a `handlerInTee` (AWS Nitro, dual-triggered by 60s cron + a `PriceUpdate` log trigger for instant reaction) holds the whole liquidation-defense policy as Vault DON secrets, reads Sepolia in one batched call, and signs both the defend tx and an EIP-712 honesty receipt inside the enclave — the salt that drives the jittered trigger, the receipt-signing key, and the on-chain policy commitment never exists outside the TEE. This targets T3 (autonomous liquidation protection with a private strategy) and T1 (a confidential workflow whose outputs — jitter draws, receipt signatures — are impossible without enclave-held secrets, not a placeholder).

**Link to the line of code:**

https://github.com/sairammr/keel/blob/master/workflow/src/main.ts#L159

**How easy is it to use the API / Protocol? (1–10):**

7

**Additional feedback for the Sponsor:**

The `cre workflow simulate` loop is excellent — WASM compile + TEE code path locally with no approval gate made iteration fast. Friction points: (1) the starter's `getUserPosition` ABI is out of sync with the deployed contract struct (5 fields vs 6 — silent wrong decode of the tail fields; we recompute HF from primitives instead); (2) Confidential Workflows deploy access is a form + email turnaround, so hackathon evidence for the TEE path ends up simulation-only — a self-serve sandbox DON would fix that; (3) log-trigger simulation requires an already-mined tx hash matching the registered filter address, which makes config/stack mismatches fail with a filter error that doesn't name the expected address — printing the registered filter address in the error would save time; (4) docs and starter disagree on the `handlerInTee` TEE-constraint argument position (3rd vs 4th arg) — we had to read the `.d.ts` to settle it.

## Video

⚠️ TODO — record & paste unlisted YouTube link (≤4 min, no speed-up). Script: `docs/video-script.md`.

## Future

- Withdraw-on-recovery so ghost-dip attacks become a no-op instead of a drain.
- Chainlink Data Streams as the price source for sub-block reaction.
- Generalize past the challenge contract: Aave/Morpho adapters — billions in looped staked-ETH debt sits near HF 1.05 with fully public triggers today.
- Production DON deployment once Confidential Workflows early access lands (currently proven under `cre workflow simulate`, same handler code path).

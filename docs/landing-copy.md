# KEEL — landing page content

Copy per section, ready to drop into `app/app/page.tsx`. Sections marked **NEW** don't
exist on the page yet.

---

## Hero

**Eyebrow:** liquidation protection · chainlink cre · verifiable secrecy

**Headline:**
Defense bots leak their trigger. **Keel's can't be found.**

**Subhead:**
Every liquidation-protection bot broadcasts its strategy through its own behavior —
act, and the market learns your trigger is above this price; stay quiet, and it's
below. A few moves later you're a stop-hunt target. Keel's trigger can't be located
from its behavior — and when the run is over, it proves on-chain that the sealed
strategy is exactly what ran.

**CTAs:** Watch it survive → `/replay` · Attack it → `/hunter` · The pitch → `/pitch`

## The idea, in three moves

**Section intro:**
A bot's actions are public, so a fixed trigger is a secret that leaks one bit at
every price level. Keel removes the leak — then proves it played fair.

**1 · The trigger moves.**
Keel starts from a hard floor it will never go below, then adds a jitter drawn from
a secret salt at every new price level — shifted only upward. Randomness can make it
act earlier, never later, so it never costs survival. Watching it fire tells you
nothing about where it fires next.

**2 · The strategy is sealed first.**
Before the market moves, a hash of the entire policy — every parameter, plus a
fingerprint of the code — goes on-chain. A sealed envelope, handed to the referee
before the match. From that block on, it cannot be swapped or tuned.

**3 · Everything is provable after.**
Every defense carries a receipt signed by a key that only exists inside the enclave,
posted at the very next nonce. Afterwards the envelope opens, and anyone can replay
every round from public logs — every action, and every silence, checked against the
sealed strategy.

## See it for yourself (tour cards)

**Intro:** Three pages, in order: watch the defense, run the attack, check the proof.

**1 · Replay** — The same crash hits two defenders. The fixed-trigger bot gets
located; Keel doesn't. *Watch it survive →*

**2 · Hunter** — A real Bayesian attacker hunts both bots — and drains the one it can
predict. Scale it ×1000 to see the $400k stop-hunt economics. *Attack it →*

**3 · Verify** — The on-chain proof, rebuilt live from Sepolia events. Commit before
start, signatures recovered, every claim linked to Etherscan. *Check the proof →*

## Live proof strip

**Eyebrow:** live on sepolia · official challenge participant #8

**Line:** Policy sealed on-chain before the scenario started, then autonomous defenses
with signed receipts, then reveal: **ALL ROUNDS CONSISTENT**.

**Sub:** commitment posted at block 11691103 — before scenario start

**CTA:** Verify it yourself → `/verify`

## NEW — Results strip (numbers row, after proof strip)

**Intro:** Privacy didn't cost performance. Five official challenge scenarios:

| stat | value |
|---|---|
| Liquidations | **0 / 5** |
| Loan continuity | **20 / 20** in every scenario |
| Capital used | **least** of any surviving strategy |
| Attacker's view of the next trigger | **≥ 300 bp wide — forever** |

## Who needs this

**Headline:** Who needs this? Anyone whose position is **public.**

**Intro:** On-chain, your collateral, your debt, and your defender's behavior are all
visible. The only thing that can stay secret is *when you'll act* — and only if it's
built to stay secret under observation.

**Leverage loopers** — Billions in looped staked-ETH debt sits near HF 1.05 on Aave.
Any bot defending those positions telegraphs its level today. Keel defends without
handing hunters a price target.

**Funds & DAO treasuries** — A treasury's positions are public by address. Keel runs
a private defense and still proves to LPs and token holders, after the fact, that the
committed policy ran unchanged.

**Automation providers** — Position-automation services run fully public triggers
today. Keel is the confidential drop-in with per-action receipts: prove execution
honesty without exposing customers.

## NEW — How it runs (one-strip architecture, before footer)

**Headline:** One enclave. One batched read. One word out.

**Body:** Keel is a Chainlink CRE confidential workflow. A 60-second heartbeat and a
price-update event wake a handler inside a TEE; it pulls its secrets from the Vault
DON, rebuilds its entire state from public logs — it keeps no memory between ticks —
decides, defends when armed, and reports a single status word. Nothing numeric ever
leaves the enclave.

## NEW — Honest boundary (small print, footer area)

The confidential handler runs under `cre workflow simulate` today — identical code,
real TEE path; attested DON deployment is gated on CRE Early Access. Receipt keys are
salt-derived by design, so the reveal is reproducible by anyone. What's already real:
the commitment, the receipts, the reveal, and the independent verifier — all on
Sepolia.

---

## Changes vs current page

- Hero subhead: explains *how* the leak works in one breath (act = above, quiet = below) instead of asserting it.
- Step 1: adds hard floor + upward-only survival argument (currently implied only).
- Step 2: adds "fingerprint of the code" — the commit binds the algorithm, not just numbers.
- Step 3: adds nonce-adjacency + "every silence" (inaction is audited too).
- Hunter card: adds the ×1000 / $400k hook.
- NEW results strip: the 0/5 · 20/20 · least-capital numbers exist only on /pitch today — strongest social proof, belongs on landing.
- NEW architecture strip + honest-boundary small print: judges reward the disclosed boundary.

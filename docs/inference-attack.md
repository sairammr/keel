# The inference attack, and why Keel's trigger cannot be located

*(PLAN P6.2. Every number here is taken from code or on-chain record; sources cited inline.
Equations match `packages/hunter/src/m1.ts` / `m2.ts` and `packages/controller/src/{jitter,vol,decide}.ts`.)*

## 1. Threat model

The adversary sees everything the chain publishes about a protected position on
`ChallengeLending`:

| Observable | Source |
|---|---|
| Price per level `P_i` | `PriceUpdate` events / `vETHPrice()` |
| Position `(C, D)` ⇒ HF per level `h_i` | `getUserPosition` / `Repay`/`Deposit` events |
| Action / inaction per level `a_i ∈ {0,1}` | presence of the participant's `Repay`/`Deposit` tx |
| Action kind and amount | tx calldata / events |
| Reserve | `balanceOf(participant)` — public by construction |

The adversary also knows the **algorithm** (public repo — Kerckhoffs) and, if it can move
the oracle price, can choose the probe sequence. It does not know the Vault secrets: the
policy parameters and the 32-byte salt. Its goal: locate the trigger HF precisely enough
that a minimal price push forces a defensive spend (the stop-hunt), repeatedly, until the
reserve is drained before the real move.

The arena is small. `HF(p) = 5·p·0.78/7000 = p/1794.87`, so:

```
HF 1.114 ⇔ $2,000 (start)      HF 1.03 ⇔ $1,849 (Keel emergency floor)
HF 1.08  ⇔ $1,938              HF 1.01 ⇔ $1,813 (integer-HF liquidation line)
```

The whole game is a **$205 window** ($2,000 → $1,795), and 0.01 of HF is ≈ $18 of price.

## 2. The binary-search attack on a fixed threshold

A fixed threshold θ turns every observation into one bit:

- **action at HF `h_a`** ⇒ θ ≥ `h_a`
- **inaction at HF `h_n`** ⇒ θ < `h_n`

The posterior is always the interval `[max h_a, min h_n)`; an adaptive prober halves it
per probe, and even a *passive* observer of an ordinary choppy path brackets θ at the gap
between consecutive levels. Worked on the real contract numbers (θ = 1.08, the official
template's example trigger):

| Price | HF = p/1794.87 | Observation | Posterior on θ |
|---|---|---|---|
| $1,960 | 1.0920 | no action | θ < 1.0920 |
| $1,935 | 1.0781 | **acts** | θ ∈ [1.0781, 1.0920) |
| $1,945 | 1.0836 | no action | θ ∈ [1.0781, 1.0836) |
| $1,936 | 1.0786 | **acts** | θ ∈ [1.0786, 1.0836) |

Three informative observations: a **0.005-wide** interval (±0.0025 around 1.081), i.e. a
**$9 price window** around $1,940. The measured version is in
`packages/hunter/src/hunter.test.ts` ("collapses on true fixed threshold 1.08"): the M1
posterior's 90% HPD width falls to **≤ 0.005** on a 9-observation descending ladder.
Putting the threshold *value* in a TEE (the official starter) changes none of this — the
enclave hides the number, not what the number does. Located threshold + public
`balanceOf` reserve = a fully specified stop-hunt: push $2 below $1,938, collect the
forced spend, revert, repeat.

## 3. Keel's construction

Per price level `i` (the index of the `PriceUpdate`, reconstructed from public logs):

```
arm_i    = clamp(base + v_i + j_i, base, tmax)                    decide.ts:16
v_i      = min(vcap, round(k·σ_i))   σ_i = EWMA of log-returns    vol.ts
j_i      = floor(frac_i · jmax),  frac_i = u64(HMAC-SHA256(salt, "keel/jitter/v1" ‖ uint32be(i)))/2^64
                                                                   jitter.ts
act at level i  ⇔  h_i ≤ arm_i   (plus cooldown; emergency at h < emerg ignores all of it)
```

`j_i ∈ [0, jmax)` is uniform to anyone without the salt, independent across levels, and
**strictly upward**: `arm_i ≥ base` always (the clamp's lower bound is `base`). Reference
width in the test policy: `jitter_bp = 300` (0.03 HF ≈ **$54** of price;
`packages/controller/src/fixture.ts`). Production values are Vault secrets.

### 3.1 The no-collapse bound

**Setup.** Take the jitter-only case (`k = 0`; §3.3 handles the vol term). Observations
`(h_i, a_i)`; the adversary knows `jmax`'s range but not the draws.

- action at `h_a`: `h_a ≤ arm_a = base + j_a < base + jmax` ⇒ **`base > h_a − jmax`**
- inaction at `h_n`: `h_n > arm_n ≥ base` ⇒ **`base < h_n`**

So the set of `base` values consistent with any history is the interval
`( H_A − jmax , H_N )` with `H_A = max h_a` over actions, `H_N = min h_n` over inactions,
and its width is `W = H_N − H_A + jmax`.

**Proposition.** For any history in which no inaction is observed at an HF below the
highest action HF (`H_N ≥ H_A` — true of every descending probe sequence, and generically
true because a triggered action is immediately followed by a restore above the arm),
**`W ≥ jmax`**. The interval never shrinks below the jitter width, no matter how many
observations are collected. Contrast §2: three observations pinned a fixed threshold to
0.005; here 300 bp of irreducible width remains after any number of them.

**What about histories with `H_N < H_A`?** Possible in principle (a low jitter draw at one
level, a high draw at another), and then `W = H_N − H_A + jmax < jmax` — but such an
inaction is exactly a low-probability draw, and its evidential weight is what the honest
Bayesian analysis (M2, §4) prices: each fresh probe at height `h` inside the jitter band
is one Bernoulli sample of the ramp probability `q(h) = (base + jmax − h)/jmax`, so the
posterior on `base` narrows only statistically, at rate **O(jmax/√n)** in the number of
*fresh price pushes*, each push a real, costly market move. Keel does not make inference
impossible; it degrades it from a free 3-probe binary search to a paid statistical
estimation problem whose every sample is a price manipulation. (PLAN P5.3 specifies the
empirical form of the bound — M2's 90% band on Keel data staying ≥ `jmax − 2·grid step`
over 1,000 synthetic scenarios; that batch test is pending, see §6.)

### 3.2 Re-probing a level is free for the defender

The draw is keyed to the **price-update index**, not to wall-clock ticks
(`jitter.ts`: `HMAC(salt, "keel/jitter/v1" ‖ uint32be(round))`). While the price sits at
one level, every cron tick recomputes the *same* `j_i` — the trigger is frozen. Sitting at
one HF for an hour yields exactly one observation. Only a new `PriceUpdate` — a push the
attacker must pay for — mints a new draw. And one action per level is enforced separately
(`cooldown`, `decide.ts:31-33`): even a triggered level yields at most one spend.

### 3.3 Upward-only jitter cannot cost survival

`arm_i ≥ base` unconditionally (`clamp(…, base, tmax)`), so jitter and the vol term only
ever move action **earlier** than a fixed trigger at `base` would. Survival is carried by
parameters that sit *under* the confidentiality mechanism: the floor `base` itself, and
the emergency override `h < emerg` (reference 10300 = HF 1.03), which ignores jitter,
cooldown and caps (`decide.ts:30,39-42`). The confidentiality mechanism is provably free
with respect to the survival objective.

### 3.4 The volatility term is attacker-inducible — and capped

An attacker who manufactures volatility raises σ and hence `arm` — making Keel spend
earlier, the opposite of hiding. This is why `v_i` is hard-capped at `vcap` (reference
200 bp = 0.02 HF): one induced move can raise the trigger by at most 0.02, once, and the
attack of §3.1 gains nothing from it (fold `v` into the offset: action gives
`base > h_a − jmax − vcap`, inaction still gives `base < h_n`; the interval *widens* by
`vcap`). Note honestly: with the prior σ₀ = 0.02 and `k = 1.0` the term sits at its cap on
most levels, so it acts as a near-constant offset; PLAN P2.2 pre-registers a protocol for
keeping, dropping, or redesigning it (candidate B: `kvol = 0`, re-tuned base). That
evaluation has not yet been recorded (`docs/results.md` does not exist); the term is
currently in the code as described.

### 3.5 The restore target is jittered too

The post-action HF reveals the restore target (`targetBp + 100 bp` solver headroom,
`solver.ts:48`). In `decide.ts:17-21`, `targetBp = clamp(armBp + buffer + v, …)` — it is
built **on top of `armBp`**, so it carries the *same* per-level jitter draw as the
trigger, plus the secret `buffer`. Observing where Keel restores to is therefore a second
reading of an already-spent draw shifted by an unknown constant — no fresh information
about `base` beyond what the action itself gave.

## 4. M1 vs M2 — the two estimators, and which number is honest

Both are real Bayesian grid posteriors in `packages/hunter` (log-space, underflow-safe),
prior uniform, slip `ε = 0.03` covering cron latency and integer-HF rounding.

**M1** (`m1.ts`) assumes a fixed threshold: grid θ ∈ [1.00, 1.20] step 0.0005 (401 cells),
likelihood `P(a=1|θ,h) = ε + (1−2ε)·1[h ≤ θ]`. Against the starter it collapses (≤ 0.005
in the test). Against Keel it is **misspecified**: jittered data is contradictory for a
step likelihood, and the tests show it stays ≥ 0.03 wide — but a misspecified posterior
can also collapse to a *narrow wrong* answer on unlucky data. **M1's width against Keel is
not the metric.**

**M2** (`m2.ts`) is the adversary who has read the code: joint grid over `(b, w)` —
`b` the base (401 cells) × `w ∈ {0, 0.005, …, 0.08}` (17 cells) — with the ramp likelihood
`q = 1` if `h ≤ b`, `0` if `h > b+w`, else `(b+w−h)/w`. For Keel's uniform per-level draw
this ramp is the **exact** true action probability, so M2 is the correctly-specified
adversary. **The honest confidentiality metric is M2's 90% HPD band on the marginal of
`b`**, and it is floored by the mechanism of §3.1: measured ≥ 0.03 = `jitter_bp` on
jittered data (`hunter.test.ts` "bounds jitter and hunts near the floor"). M2 also emits
the **hunt price**: the largest price with posterior-predictive `P(act) ≥ 0.9`. Against a
located fixed threshold that sits $2 under the trigger; against Keel it is pushed down
toward the *floor* `base` — a strictly deeper, costlier push per forced action (verified
end-to-end in `hunter.test.ts`, where the attack driver runs the **real** `decide()`).

## 5. What still leaks, and what it costs to exploit

| Leak | Quantified | Mitigation / status |
|---|---|---|
| **Emergency floor** `emerg` semantics are public code (value is secret; reference 1.03) | Forcing the emergency branch means pushing to ≈ **$1,849**, a 7.6% single-name oracle move, **$36 above the $1,813 liquidation line** — an attacker with that much price control liquidates outright instead; the branch also fires at most once per level and restores decisively | Accepted by design: it is the survival backstop, and reaching it costs nearly the full attack |
| **Reserve** is `balanceOf` | Fully public, zero inference needed | Displayed as public in the app; Keel's defence never relies on hiding it. Per-action caps (`max_deposit`, `max_repay_bp`) bound the per-tap drain |
| **Action kind + amount** | Public calldata | Reveals nothing not already on-chain (the `Repay`/`Deposit` event is the observation); amounts are solved-to-target, so they encode `targetBp` — covered by §3.5 (same jitter draw + secret buffer) |
| **Post-action restore level** | Reveals `target + 100bp` | **Jittered via `armBp`** (§3.5, `decide.ts:17`) — not a fresh draw, no independent leak |
| **The algorithm itself** | Public repo | By design (Kerckhoffs): M2 *is* the algorithm-aware adversary and is still floored at `jmax` |
| **Statistical leakage across many pushes** | O(jmax/√n) narrowing, one paid price push per sample (§3.1) | Economic, not cryptographic, protection — stated as such |

## 6. Honest limits

- **The receipt key is salt-derived, not hardware-attested.** `receiptKey =
  keccak(salt ‖ "keel/receipt/v1")`: anyone holding the salt can produce valid receipts.
  That is deliberate (reveal must be reproducible by an auditor), but it means receipts
  prove *policy consistency with the commitment*, not *execution inside an enclave*.
- **The TEE path is simulated.** `handlerInTee(…, [{ tee: "nitro", regions: ["us-west-2"] }])`
  (`workflow/src/main.ts:150`) runs under `cre workflow simulate` — locally, in WASM, no
  real enclave — pending CRE Early Access (`Deploy Access: Not enabled`). With
  `config.tee = false` the identical handler runs non-confidentially and the DON sees the
  secrets. The live Sepolia scenario (`docs/deployment/addresses.md`) ran the same
  controller code outside an attested TEE.
- **The empirical bound test is pending.** P5.3's 1,000-scenario batch check of
  `M2 width ≥ jmax − 2·grid step` is specified but not yet in `hunter.test.ts`; the
  current tests cover the fixed-threshold collapse, the jittered non-collapse (≥ 0.03),
  and the real-controller end-to-end width comparison.
- **The bound protects `base`, not the fact of defence.** Every action still proves a
  policy exists and the floor is below the action's HF. Keel hides *where the next line
  is*, not *that there is one*.

# Results — grid search & baselines (P2.3)

Generated output of `bun run tune` (train family, 40 scenarios). Every number quoted in the
README, landing page, or app must trace to this file or to on-chain events.

- Command: `bun run tune`
- Date: 2026-09-13
- Repo state: 1c83a1d (working tree includes the tjitter_bp restore-target jitter)
- Scoring: survive/40 + debtTime/20 + capEff/15 + discipline/10 (max 85), engine = ContractMirror
  cross-checked against the deployed contract (see README P1.4).

## Honest read

- The tuned Keel policy survives all 40 train scenarios (0 liquidations), mean 82.15.
- It **beats** the official starter threshold (1.08/1.15: mean 81.42) and **ties within 0.1** the
  best tuned fixed threshold (1.05/1.12: mean 82.22 — a threshold that is discoverable in ~3
  observations and stop-huntable; Keel's is not).
- Claim to use in the pitch: *same protection as the best fixed threshold, plus the threshold
  cannot be extracted* — not a score win.
- do-nothing baseline: 28/40 liquidated, mean 54.64.

## Raw tuner output

```

Keel grid search — 270 combos × 40 train scenarios

rank  liq   mean    worst   capital   config
----  ---  ------  ------  --------  ------------------------------------------
   1    0   82.15   76.45    181571  base=10500 jmax=200 buf=700 H=4 cron=30
   2    0   82.15   76.45    181571  base=10500 jmax=200 buf=700 H=4 cron=60
   3    0   82.14   76.45    181918  base=10500 jmax=200 buf=700 H=6 cron=30
   4    0   82.14   76.45    181918  base=10500 jmax=200 buf=700 H=6 cron=60
   5    0   82.06   76.45    183914  base=10500 jmax=200 buf=700 H=3 cron=30
   6    0   82.06   76.45    183914  base=10500 jmax=200 buf=700 H=3 cron=60
   7    0   81.93   76.41    192584  base=10500 jmax=300 buf=700 H=4 cron=30
   8    0   81.93   76.41    192584  base=10500 jmax=300 buf=700 H=4 cron=60
   9    0   81.92   76.41    193042  base=10500 jmax=300 buf=700 H=6 cron=30
  10    0   81.92   76.41    193042  base=10500 jmax=300 buf=700 H=6 cron=60

=== WINNING POLICY ===
{
  "base_bp": 10500,
  "kvol_bp": 10000,
  "volcap_bp": 200,
  "jitter_bp": 200,
  "tjitter_bp": 300,
  "tmax_bp": 11100,
  "emerg_bp": 10300,
  "buffer_bp": 700,
  "target_cap_bp": 12500,
  "halflife": 4,
  "cooldown": 1,
  "max_repay_bp": 3000,
  "max_deposit": 250,
  "t_est_s": 10800
}
cronPeriod = 30
liquidations=0  mean=82.15  worst=76.45  capital=181571

=== BASELINES (train) ===
starter 1.08/1.15    liq=0  mean=81.42  worst=76.87  capital=171769
starter 1.05/1.12    liq=0  mean=82.22  worst=77.15  capital=144861
do-nothing           liq=28  mean=54.64  worst=32.75  capital=0

=== KEEL vs BASELINES (mean, worst, liquidations) ===
vs starter 1.08/1.15    mean WIN  (82.15 vs 81.42)  liq WIN  (0 vs 0)
vs starter 1.05/1.12    mean lose (82.15 vs 82.22)  liq WIN  (0 vs 0)
vs do-nothing           mean WIN  (82.15 vs 54.64)  liq WIN  (0 vs 28)
```

## Official README scenarios (challenge repo, Sept 2026) — `bun run scripts/eval-official.ts`

Exact price paths from the challenge README "Market scenarios examples", dt=120s steps,
cron=60s (prod schedule), engine = ContractMirror. Scored survive/40 + debtTime/20 +
capEff/15 + discipline/10 (confidentiality/15 is a judge assessment, not simulated).

| Strategy | mean | worst | liq | capital (×100 vUSD) |
|---|---|---|---|---|
| **Keel committed prod policy** (DEFAULT + tjitter 300, on-chain commit `0xc6d21b2d…`) | **81.48** | 79.53 | 0 | **1,146,950** |
| Tuned grid winner (base 10500/j200/buf700) | 81.38 | **79.55** | 0 | 1,200,650 |
| Starter 1.08/1.15 | 81.39 | 79.46 | 0 | 1,197,800 |
| Do-nothing | 42.08 | 40.79 | **5/5** | 0 |

Per-scenario (committed policy): gradual 80.23 · crash 79.53 · wick 83.56 · two-stage 80.28 ·
safe-vol 83.78. All five survive with 1–2 actions each; loan continuity is a full 20/20 in every
scenario (defense is deposit-led, debt never reduced below start where avoidable).

Notes:
- The committed policy **beats the tuned grid winner on the official literal paths** (tuner was
  fit to the 40-scenario train family) and uses the least capital of any surviving strategy —
  the second tie-breaker. No recommit needed.
- Robustness: identical scores for dt ∈ {60,120,300}; salt sweep (3 salts) moves mean only
  81.28–81.48, always 0 liquidations.
- Even the "safe volatility" official path dips HF below 1.0 (price 1750 ⇒ HF 0.975), so
  do-nothing liquidates in all 5 scenarios — every path requires at least one defense.

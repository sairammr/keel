# KEEL — video pitch script (deck-first cut)

**Flow: `/pitch` deck walkthrough (0:00–2:15) → frontend/demo run-through (2:15–3:45) → close (3:45–3:58).**
Runtime target 3:55. Hard stop 4:00. Record 1080p, human voice, no speed-up.
Arrow-key through the deck; narration below is written to land as each slide appears.

Rules: no policy value or salt on screen except the demo salt (already revealed on-chain).
Never show `.env*`, `secrets.yaml`, production config.

---

## PART 1 — THE DECK (`localhost:3000/pitch`) · 0:00–2:15

**Slide 01 / title (10s)**
> This is KEEL. The official starter for this challenge hides a number. Keel hides the
> number, hides what the number will do next — and proves the number never changed.

**Slide 02 / problem (18s)**
> Every liquidation-defense bot has a trigger: the health factor where it acts. And it
> broadcasts it. Every action or silence at a price is one bit of a binary search —
> three pushes locate a fixed threshold to a nine-dollar price window. A located trigger
> plus a public reserve isn't a defense, it's a drain plan. Whales get hunted this way
> in the real world.

**Slide 03 / $205 (12s)**
> The playing field makes it brutal: health factor is a straight line in price. The
> entire game — opening health, every trigger, liquidation — lives inside two hundred
> and five dollars. Hide where you act inside that window, under observation, or lose.

**Slide 04 / fix one — the tripwire moves (18s)**
> Fix one: the tripwire moves. The trigger is a floor, plus volatility, plus a jitter
> drawn from an HMAC of a salt that never leaves the enclave. One fresh draw per price
> level — strictly upward, so randomness can only make Keel act earlier, never later.
> It never costs survival, and no amount of watching narrows the base below the jitter
> width. Non-invertible by construction.

**Slide 05 / fix two — sealed envelope (15s)**
> Fix two: you don't have to trust that. Before the scenario starts, a hash of the whole
> policy goes on-chain. Every defense carries an EIP-712 receipt signed by a key derived
> inside the enclave. Reveal afterward — and anyone recomputes every round from public
> logs. That's the difference between private and provably unchanged.

**Slide 06 / architecture (15s)**
> It runs as a Chainlink CRE confidential workflow. Two triggers — a sixty-second cron
> and a PriceUpdate log trigger for instant reaction — wake a handler inside a TEE. It
> pulls policy, salt, and keys from Vault DON secrets, reads the chain in one batched
> call, defends when armed, and reports a single status word. Nothing numeric ever
> leaves the enclave.

**Slide 07 / the attacker (15s)**
> And because talk is cheap, we shipped the attacker: a real Bayesian hunter. Against
> the starter, it locates the trigger in three observations — stop-huntable forever.
> Against Keel, its estimate of the next trigger is floored at three hundred basis
> points, no matter how long it watches.

**Slide 08 / results (15s)**
> On the five official challenge scenarios, run on a byte-proven mirror of the deployed
> contract: zero liquidations, a perfect twenty out of twenty loan continuity in every
> scenario, and the least capital of any surviving strategy — with a trigger no observer
> can locate.

**Slide 09 / on-chain proof (12s)**
> This isn't a slide claim. We've joined the official challenge, and the policy hash is
> already committed on Sepolia — sealed before the scenario starts. Whatever the market
> does, the policy that defends is provably the one sealed here.

**Slide 10 / tracks (10s)**
> Two tracks, one build: a confidential workflow whose secrecy you can verify, and
> liquidation protection that survives being watched. Let me show it running.

## PART 2 — FRONTEND / DEMO RUN-THROUGH · 2:15–3:45

**`/hunter` (30s).** Run the attack on the starter — taps fill, capital drains. Then the
same attack on Keel. Click ×1000.
> This is the hunter live, driving the real controller code. Fixed threshold: tap just
> under the located trigger, force a spend, revert, repeat — the reserve bleeds out.
> Keel: the attacker's own model says push all the way to the floor — deeper, costlier,
> one action per price level. At a thousand times the size, that's a four-hundred-
> thousand-dollar bounty game.

**Live-run footage — two terminals + Etherscan (35s).** Terminal A statuses flipping
`COMMITTED → SAFE → DEFENDED → EMERGENCY`; Terminal B driving rounds
$2,000 → $1,850 → $1,700 → $1,550 → $1,450 → $1,800; deposit + receipt txs appearing.
> This is a real run on Sepolia. First tick: the enclave commits — before the scenario
> starts. Then five price rounds, down to a level where an undefended position
> liquidates. This terminal only moves the market; the workflow decides alone —
> and every defend is followed at the next nonce by a receipt signed inside the enclave.
> Health factor never touches the line.

**`/verify` + verifier terminal (25s).** Run the printed verify command; hold on
**ALL ROUNDS CONSISTENT**; flash `/verify` in the browser showing the same run.
> After the run, the envelope opens. The verifier reads only public data: it recomputes
> every round's trigger from the price logs, recovers every receipt's signer, and checks
> every action — and every silence — against the sealed policy. All rounds consistent.
> Private the whole time, provably never changed.

## CLOSE · 3:45–3:58

**Screen:** end card — ⚓ KEEL · repo URL.
> Today the confidential handler runs under Chainlink's simulator — same code, real TEE
> path; attested deployment is an access gate, not a design gap. KEEL: private smart
> contracts you can still audit.

**CUT. ≤ 4:00.**

---

## Fill-in after recording

| Slot | Source |
|---|---|
| Live-run clip | fallback-runner + demo-live footage on stack `0x4974601B26B3299a9787Ed7Ad88c76088B921a9e` |
| Verify command | printed by demo-live at run end |
| Etherscan tabs | lending address · commit tx · one defend + adjacent-nonce receipt · reveal tx |

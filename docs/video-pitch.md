# KEEL — video pitch script

**Flow: deck (0:00–2:15) → app demo (2:15–3:45) → close (3:45–3:58).** Under 4:00.
Record in your own voice, no speed-up.

Framing: this is a **product pitch** — a real DeFi problem and a real protection agent.
The Chainlink challenge is the proving ground, not the story.

Written to be spoken — natural, but professional. Line breaks are breathing points.
If a phrase doesn't sit right in your mouth, reword it; keep the point.

Don't show on screen: `.env*`, `secrets.yaml`, production config. The demo salt is fine.

---

## PART 1 — THE DECK (`localhost:3000/pitch`) · 0:00–2:15

**Slide 01 — title (~10s)**

> Hi, this is KEEL — liquidation protection whose strategy stays secret while it runs,
> and becomes provable after.
>
> Because in DeFi today, if a bot defends your position, the whole market can reverse-
> engineer exactly how. Keel fixes that.

**Slide 02 — the problem (~20s)**

> Here's the problem. Billions of dollars of leveraged positions sit on-chain — and the
> bots defending them all have a trigger: the health factor where they step in.
>
> That trigger leaks, by design. When the bot acts, the market learns the trigger is
> above that price. When it stays quiet — it's below. That's a binary search, running
> on you for free. A few price moves and an attacker has your trigger nailed down.
>
> Then they drain you: push the price to your line, force a spend, pull back, repeat.
> This isn't theory — whales get hunted like this publicly. A five-hundred-million-
> dollar short on Hyperliquid drew coordinated hunts. One visible position triggered
> Solend's hundred-seventy-million-dollar panic.

**Slide 03 — the arena (~10s)**

> To prove this properly, we built for Chainlink's liquidation protection challenge —
> a live arena on Sepolia where everything, from opening health to liquidation, fits
> inside two hundred and five dollars of price. If your trigger can stay hidden there,
> under fire, it can stay hidden anywhere.

**Slide 04 — fix one (~18s)**

> Our first fix: the tripwire moves.
>
> A normal bot defends at one fixed line. Keel starts with a hard floor — a level it
> will never go below — and adds a random jitter on top. That jitter comes from a
> secret salt that lives only inside the enclave, and every new price level gets a
> fresh draw. So Keel acts at a slightly different point every time.
>
> The key design choice: the jitter only ever moves the trigger up. Keel can act
> earlier than it strictly needs to — but never later. The randomness is free.
> It never risks the position.

**Slide 05 — fix two (~15s)**

> The second fix: you don't have to trust any of that. We prove it.
>
> Before the market moves, Keel hashes its entire strategy and posts it on-chain —
> a sealed envelope. Every defense then carries a signed receipt, signed by a key
> that only exists inside the enclave.
>
> Afterwards, the envelope opens — and anyone can replay the run from public logs and
> confirm every action matched the strategy sealed before anything happened.
>
> That matters beyond hackathons: it's how a fund proves to its LPs, or a DAO to its
> token holders, that the committed strategy actually ran. Unchanged.

**Slide 06 — how it runs (~14s)**

> Under the hood, this is a Chainlink CRE confidential workflow.
>
> Two things wake it up: a sixty-second heartbeat, and a price-update event — so it
> reacts the moment the price moves. The handler runs inside a TEE, pulls its secrets
> from the Vault DON, reads the chain in one batched call, defends when needed, and
> reports back a single word. Nothing numeric ever leaves the enclave.

**Slide 07 — we built the attacker (~14s)**

> Talk is cheap, so we also built the attacker.
>
> It's a real Bayesian hunter that watches public chain data and tries to locate the
> trigger. Against a conventional fixed-threshold bot, it wins in three observations —
> located, permanently. Against Keel, its estimate of the next trigger never gets
> sharp. It stays wide, no matter how long it watches.

**Slide 08 — results (~14s)**

> And privacy didn't cost performance. Across the five official challenge scenarios:
> zero liquidations, perfect loan continuity in every single one, and the least
> capital spent of any strategy that survived.
>
> It wins on both.

**Slide 09 — it's live (~10s)**

> This is running today. We've joined the official challenge on Sepolia, and our
> strategy hash is already committed on-chain — sealed before the scenario starts.
> Whatever the market does next, the strategy that defends is provably this one.

**Slide 10 — who it's for (~10s)**

> And the market for this is real: leverage loopers sitting near the edge on Aave,
> funds and DAO treasuries that need private execution with public accountability.
>
> Private smart contracts you can still audit. Let me show it running.

## PART 2 — THE DEMO · 2:15–3:45

**`/hunter` — attack console (~30s).** Attack the fixed-threshold bot, then Keel, then ×1000.

> This is the hunter, live, attacking the real controller code.
>
> First, a bot with a fixed trigger — the way protection works today. Watch: it taps
> the price just under the line, forces a spend, pulls back, and repeats. The reserve
> just bleeds out.
>
> Now the same attack on Keel. Its own model tells it: to force anything, push all the
> way down to the floor. Much deeper, much more expensive — and even then, it buys
> one action per price level.
>
> Scale it up a thousand times — a ten-million-dollar position — and this becomes a
> four-hundred-thousand-dollar game. That's the real-world attack Keel is built for.

**The live run — two terminals + Etherscan (~80s, the centerpiece).**

Screen: Terminal A left (workflow ticks), Terminal B right (market driver), Etherscan
tab on the lending contract. Point at each thing as you name it. This beat carries the
whole pitch — take the time here, save it elsewhere.

> This is a real run on Sepolia, with two terminals that never talk to each other.
> The only thing they share is the blockchain.
>
> The left terminal is Keel — the confidential workflow. It wakes up every thirty
> seconds, and on each tick it does one read of the chain: the current price, its
> position, and everything that's happened so far. It keeps no memory between ticks —
> it rebuilds the whole picture from public data every time, decides inside the
> enclave, and reports back a single word. While nothing is happening, that word
> is "idle."
>
> On its very first tick, it commits. It takes the entire strategy — the floor, the
> jitter width, every parameter, even a fingerprint of the code — hashes it, and
> posts that hash on-chain. That's the envelope being sealed, and it happens before
> a single price has moved. From that block on, the strategy can't be swapped or
> tuned. The commit transaction is on Etherscan, dated before the scenario starts.
>
> The right terminal drives the market — that's the only thing it does. Each round,
> it drops the price and the health factor falls with it: eighteen-fifty, seventeen
> hundred, fifteen-fifty, down to fourteen-fifty. After every drop it runs the
> contract's liquidation check — the same check that wipes out any position under
> the line. At fourteen-fifty, an unprotected position is simply gone.
>
> Nobody ever touches the left terminal. Between rounds, Keel wakes up on its own,
> recomputes the health factor, rolls the jitter for that price level, and compares.
> If it's still above the trigger, it reports "safe" and does nothing — and that
> nothing is also a decision that gets audited later. When the health factor crosses
> the trigger, it defends.
>
> The defense is two transactions, back to back. First, the action itself — a
> measured deposit, not a panic dump. Keel solves for the cheapest move that
> restores a safe buffer: early in a crash it adds collateral, late in a crash it
> pays down debt. Second, at the very next nonce from the same wallet, comes the
> signed receipt — what it saw, what it did, signed by a key that only exists inside
> the enclave. So at the moment it acts, it also proves the sealed strategy is the
> one acting.
>
> When the crash goes deep enough, the status flips to "emergency." That's the
> survival floor under all the cleverness — below that line, Keel drops the jitter
> and the cooldowns and just saves the position.
>
> Five rounds of crash, and the health factor never touches the liquidation line.
> The position survives.

**Verify (~25s).** Run the verify command, hold on the last line.

> The run is over, so the envelope opens.
>
> This verifier only reads public data. It rebuilds every round's trigger from the
> price logs, checks every receipt's signature, and compares every action — and every
> silence — against the sealed strategy.
>
> And there it is: all rounds consistent.
> Private the entire time, and provably never changed.

## CLOSE · 3:45–3:58

**Screen:** end card — ⚓ KEEL · repo URL.

> One honest note: the confidential handler runs under Chainlink's simulator today —
> same code, real TEE path. Enclave deployment is an access gate, not a design gap.
>
> That's KEEL. Private smart contracts — that you can still audit. Thanks for watching.

**CUT. Under 4:00.**

---

## Recording tips

- The live run is now the ~80s centerpiece, so the deck must shrink to fit 4:00:
  - Cut slide 03 to one sentence ("We proved it in Chainlink's live challenge arena —
    where the whole game fits in two hundred dollars of price.")
  - Cut slide 06 to one sentence ("It runs as a Chainlink CRE confidential workflow —
    you'll see exactly how in a second.") — the live run now explains the tick loop
    better than the slide can.
  - Keep the hunter at ~25s and verify at ~20s.
  Target: deck ~1:45 · hunter 0:25 · live run 1:20 · verify 0:20 · close 0:10 = 4:00.
- Dry run with a timer; hard stop is 4:00.
- Explain it like you would to a colleague, at a relaxed pace.
- If you stumble, pause and redo that slide; fix it in the edit.
- Let two moments breathe: the commit landing on-chain, and "all rounds consistent."

## Fill-in after recording

| Slot | Source |
|---|---|
| Live-run clip | fallback-runner + demo-live footage on lending `0x4974601B26B3299a9787Ed7Ad88c76088B921a9e` |
| Verify command | printed by demo-live at the end of the run |
| Etherscan tabs | lending address · commit tx · one defend + its receipt (next nonce) · reveal tx |

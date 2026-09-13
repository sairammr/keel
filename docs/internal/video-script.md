# Demo video script — KEEL (PLAN P6.5)

**Target length 3:30–4:00.**

## Rules (non-negotiable)

- 2–4 minutes total. Hard stop at 4:00.
- ≥ 720p (record at 1080p), screen + **human voice** — no TTS, no speed-up of footage.
- ≤ 4 bullets on any slide.
- **No policy value or salt on screen except the staging salt** (`0x5a…5a`, already
  revealed on-chain). Never show `.env`, `secrets.yaml`, or the production config.
- Every on-screen number comes from the repo, a live page, or Sepolia — nothing invented.

## Prep checklist (before recording)

1. `cd app && bun run dev` → dashboard on `localhost:3000`; open `/`, `/replay`, `/hunter`, `/verify` in tabs.
2. Terminal 1: repo root, font large. Terminal 2: `workflow/` ready for the simulate command.
3. Etherscan tabs pre-loaded (Sepolia):
   - commit tx `0xa63f24f20941a30f7a8010a544249eb12479f1e958a20f4964e4ece486856205` (block **11682878**)
   - round-1 defend `0x12358069c613d4c36ff89e17ce1c79743f239ea263ded96bd424be216549bc04` + its receipt `0x486ccffdc2c2f8b0eddf7473d4c4b9a6b396729a5b3dea784c4d5f397d9034f2`
   - round-3 defend `0xdd78fa342c61860e643e24f59f6ad1f8e28f49455ce4458de5599d017baf6613` + its receipt `0x8ba5a8f0e97c56635a6362cc39574e297848d9ec78f1cfed0ebe6e2d8205cffc`
   - reveal `0xd874ee6b2c95c28e43b5d3aa9ffbc3431a763987087d5a5cd55a1eac100e8d96`
4. `workflow/src/main.ts` open in the editor, cursor on line 150.
5. Do one silent full run-through; the timings below assume no fumbling.

---

## 0:00–0:25 — Hook: the posterior collapse, side by side

**Screen:** `/hunter`. Source toggle on **ENGINE**. The two posterior strips visible:
M1 band on the fixed-threshold starter (collapsed to a sliver) next to the Keel band
(wide, ≥ 0.03).

**Action:** slow cursor circle around the starter's collapsed band, then the wide Keel band.

**Voice:**
> "Two liquidation-protection bots, watched by the same attacker, using nothing but
> public chain data. Left: the official template — three observations and its secret
> trigger is located to half a basis point of health factor. Right: Keel. Same attacker,
> same math, and the estimate never gets narrower than this band. That gap is the
> product."

## 0:25–0:50 — The problem: a public trigger is a stop-hunt target

**Screen:** landing page `/` (the HF formula panel), or a slide, max 4 bullets:
- `HF(price) = price / 1794.87` — the whole game is a **$205 window** ($2,000 → $1,795)
- action at HF h ⇒ trigger ≥ h · inaction at h ⇒ trigger < h
- 3 observations ⇒ a **$9 price window** around the trigger
- reserve is `balanceOf` — already public

**Voice:**
> "Every one of these bots has a number: the health factor where it acts. Put that number
> in a hardware enclave and it's still not private — every action or inaction is one bit
> of a binary search. Three bits, and the attacker knows the price that forces you to
> spend, and your reserve was public all along. Push two dollars under the trigger,
> collect the forced spend, revert, repeat, drain."

## 0:50–1:20 — The solution, one breath, code on screen

**Screen:** editor on `workflow/src/main.ts:150`, the line highlighted:

```ts
cre.handlerInTee(trigger, onCronTrigger, [{ tee: "nitro", regions: ["us-west-2"] }])
```

Then a 5-second cut to `packages/controller/src/jitter.ts` (the HMAC line).

**Voice:**
> "Keel's trigger is a floor plus a jitter drawn from an HMAC of a salt that never leaves
> the enclave — one fresh draw per price level, and strictly upward, so it can only make
> Keel act earlier, never later. Watching it act tells you a floor exists. It never tells
> you where the next line is. And because we commit to the policy on-chain before the
> scenario starts, secrecy comes with proof."

## 1:20–2:40 — Live Sepolia evidence: commit → defend → receipts → reveal → verify

**Screen sequence (Etherscan + terminal):**

1. *(~15s)* Commit tx `0xa63f24f2…` — point at block **11682878**, then the `start` tx
   `0x04dd5107…` in the next block. "Committed **before** start."
2. *(~20s)* Round-1 defend `0x12358069…` (`deposit 51` = 0.51 vETH) and its receipt tx
   `0x486ccffd…`; show on the address page that the receipt sits at the **next nonce**
   from the same EOA (`0x9673afB9…4Eb4`). Then round-3 defend `0xdd78fa34…` — "at this
   round an undefended position is at hf 99: liquidated. Keel's never left 111."
3. *(~10s)* Reveal tx `0xd874ee6b…` — the staging salt `0x5a…5a` and policy bytes, public.
4. *(~35s)* Terminal 1, run the independent verifier:

```bash
bun run verify \
  --rpc https://ethereum-sepolia-rpc.publicnode.com \
  --lending 0xbc655f2febC8C9642C69BB746568050f53AAAc18 \
  --policyCommit 0xE0e3C43Cc464e08b35Eb28Ff235c437166AFAc71 \
  --receipts 0xf8A66135642a0DeA582e874531Ef45FB2Dd01ee6 \
  --participant 0x9673afB923d556979E4dfe6854d8C6e2D9994Eb4 \
  --from 11682850
```

   Let the per-round table print (`rnd price HF arm target … ok ✓`), hold on the final
   line: **`ALL ROUNDS CONSISTENT`**. Then flip to `/verify` in the app — same commit,
   same 2 receipts, signer recovered, reconstructed from Sepolia in the browser.

**Voice (over the sequence):**
> "This ran for real on Sepolia, against a byte-for-byte copy of the challenge contract.
> The enclave committed a hash of the policy — block one-one-six-eight-two-eight-seven-eight
> — before the scenario started. A crash came; rounds where an undefended position
> liquidates at health factor point-nine-nine. Keel defended twice, and each action tx is
> followed at the very next nonce by an EIP-712 receipt signed by a key derived from the
> same salt as the commitment. After the run: reveal. And now anyone — this is our
> verifier, but the data is all public — recomputes every round's trigger from the price
> logs and checks every action and every silence against the committed policy. All rounds
> consistent. The policy was private the whole time, and provably never changed."

## 2:40–3:20 — The attacker demo

**Screen:** `/hunter`. Attack console.

**Actions, in order:**
1. Source toggle: click **CHAIN** — "this inference is running on the real Sepolia
   events you just saw" — then back to **ENGINE** for the attack sim.
2. Run the attack on the starter: watch the tap list fill, counters climb —
   **forced spends**, **capital drained**, **debt-time burned**, **deepest push**.
3. Same attack against Keel: taps land clear, deepest push is far lower, spends bounded.
4. Click the **×1000** chip: dollar counters rescale.

**Voice:**
> "Here's that attack, driving the real controller code. Against the fixed threshold: tap
> just under the located trigger, force a spend, revert, repeat — the reserve bleeds out.
> Against Keel the attacker's own best model says: to be ninety percent sure of forcing
> anything, push all the way to the floor — deeper, costlier, and it still buys one
> action per price level. At times one thousand — a ten-million-dollar position — this
> is a four-hundred-thousand-dollar bounty game. That's who stop-hunts exist for."

## 3:20–4:00 — Real vs Simulated, and the close

**Screen:** Terminal 2 first (~15s):

```bash
cre workflow simulate workflow --target staging-settings --non-interactive --trigger-index 0
```

Hold on the confidential handler compiling to WASM and returning its one-word status
(`COMMITTED` / `SAFE` / `DEFENDED`). Then the honest slide, exactly 4 bullets:

- **Real:** on-chain commit-before-start, defends, EIP-712 receipts, reveal, independent verifier — Sepolia, links in the README
- **Real:** `handlerInTee` workflow, simulated under the CRE runtime (WASM, TEE code path)
- **Simulated:** no attested enclave yet — DON deploy pending CRE Early Access
- Receipt key is salt-derived, not hardware attestation — reveal is reproducible by design

**Voice:**
> "Being honest about the boundary: the confidential handler runs under Chainlink's
> simulator today — same code, real TEE path, not yet an attested enclave; that's gated
> on early access, and nothing in the design changes when it lands. What's already real
> is everything you can check: the commitment, the receipts, the reveal, the verifier.
> Keel is a private smart contract you can still audit — proving you followed a rule,
> without ever showing the rule."

**End card:** repo URL + `docs/inference-attack.md`. Cut at ≤ 4:00.

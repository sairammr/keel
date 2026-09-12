---
version: 1
slug: "site-index-html"
primary_target: "site/index.html"
related_targets: []
---

# Surface brief — site/index.html (KEEL landing)

Scope: the static landing page in `site/` (no build step, vendored GSAP). Visitor mode: Persuade.
Audience: ETHOnline 2026 judges (T1 Confidential Workflow, T3 Liquidation Protection); secondary
developers who clone and verify. Action: open /verify app, run `bun run verify`, or read source.
Proof material (all real, never extend): commit block 11,682,878 before start; receipts r1/r3 with
tx hashes; reveal tx; undefended HF 0.99/0.95/0.93 liquidated vs Keel ≥1.10; ALL ROUNDS CONSISTENT;
TEE simulation banner (AWS Nitro us-west-2); 71+14 tests. Constraint: painterly sunset-sky artwork
and nautical identity are user-pinned; user rejected full-screen pinned "PPT" slides — normal
document scrolling.

## Direction contract

THESIS: The landing page is a measured written argument — a judge reads one column of reasoning
while the chain's own artifacts accumulate alongside it in a margin ledger. It refuses the
category default: full-screen animated feature slides with scroll-jacked pinning.

OWN-WORLD: Deep-ink page (#0d1826) under a painterly sunset-sky hero band; cream ink (#f3e7cf);
Fraunces for display and text; gold (#e6b36b) carries links and emphasis, ember (#c04a41) only
danger/liquidation; 1px hairline rules at 14% cream; margin artifacts as thin-bordered ledger
slips with tabular numerals and real tx hashes; nautical PD glyphs sparse (ship on the horizon,
wave marks as section rules). Monospace only for data: hashes, blocks, HF values, commands.

STORY: The judge arrives thinking "another TEE bot," follows the leak argument (every action
leaks a bit), sees why upward-only salted jitter defeats inference, then meets proof they can
check without trusting us — commit before start, per-action EIP-712 receipts, reveal, and an
independent verifier's ALL ROUNDS CONSISTENT — and leaves able to reproduce it in one command.

FIRST VIEWPORT: Sky band ~62vh: left-aligned KEEL (≤6rem) with the one-line thesis under it and
two actions — "Verify the live run" (gold, primary) and "Read the source" — ship silhouette
riding the band's base line. Below the band, already visible: the essay's opening line ("Your
liquidation bot has a number.") and the first margin slip (the commit block card), promising
the whole structure before any scroll.

FORM: The Argument — essay column + on-chain margin ledger; my ranked-list index 6; seed key
1183d84e (surface scope, persuade).

SIGNATURE INTERACTION: Margin slips file in — each artifact slides from the right and settles
with a slight rotation, like a ledger slip being pinned beside the passage that cites it; the
crash figure draws itself once when it enters. No pinning, no scroll-jacking; everything else
is still.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the
verdict, DESIGN.md, and every shipping raster carrying its provenance.

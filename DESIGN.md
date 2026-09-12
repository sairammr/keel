---
name: KEEL
description: Verifiable-secrecy liquidation protection — a written argument under a sunset sky.
colors:
  ink: "#0d1826"
  ink-raised: "#131f31"
  cream: "#f3e7cf"
  cream-60: "rgba(243, 231, 207, 0.64)"
  cream-40: "rgba(243, 231, 207, 0.58)"
  hairline: "rgba(243, 231, 207, 0.14)"
  gold: "#e6b36b"
  gold-dim: "rgba(230, 179, 107, 0.35)"
  gold-bright: "#f0c586"
  ember: "#d4695a"
typography:
  display:
    fontFamily: "Fraunces, Georgia, 'Times New Roman', serif"
    fontSize: "clamp(3.4rem, 8vw, 6rem)"
    fontWeight: 560
    lineHeight: 1
    letterSpacing: "0.08em"
  headline:
    fontFamily: "Fraunces, Georgia, 'Times New Roman', serif"
    fontSize: "clamp(1.7rem, 3.2vw, 2.3rem)"
    fontWeight: 460
    lineHeight: 1.22
  body:
    fontFamily: "Fraunces, Georgia, 'Times New Roman', serif"
    fontSize: "1.0625rem"
    fontWeight: 360
    lineHeight: 1.66
  label:
    fontFamily: "Fraunces, Georgia, 'Times New Roman', serif"
    fontSize: "0.78rem"
    fontWeight: 560
    letterSpacing: "0.14em"
  data:
    fontFamily: "ui-monospace, 'SF Mono', SFMono-Regular, Menlo, monospace"
    fontSize: "0.84rem"
rounded:
  sm: "3px"
  md: "4px"
  lg: "6px"
spacing:
  paragraph: "1.15rem"
  slip-gap: "1.1rem"
  passage-y: "clamp(3rem, 6vh, 4.5rem)"
  page-x: "clamp(1.25rem, 5vw, 3rem)"
components:
  button-primary:
    backgroundColor: "{colors.gold}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "0.72rem 1.5rem"
  button-primary-hover:
    backgroundColor: "{colors.gold-bright}"
    textColor: "{colors.ink}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.cream}"
    rounded: "{rounded.sm}"
    padding: "0.72rem 1.2rem"
  slip:
    backgroundColor: "rgba(19, 31, 49, 0.55)"
    textColor: "{colors.cream}"
    rounded: "{rounded.md}"
    padding: "1.05rem 1.15rem"
---

# Design System: KEEL

## Overview

**Creative North Star: "The Argument"**

KEEL's landing surface is a measured written argument, not a product tour. A single essay
column carries the reasoning in a variable serif (Fraunces, roman and italic, self-hosted),
while the chain's own artifacts — commit block, receipt hashes, health factors — accumulate
beside it in a margin ledger of thin-bordered slips. The page reads under a painterly
sunset-sky hero band (user-pinned artwork) that dissolves into deep ink; below the horizon,
everything is document scrolling. The world explicitly refuses the category default of
full-screen animated feature slides and scroll-jacked pinning.

The material character is nautical print: cream ink on a deep-ink sea, hairline rules at 14%
cream, an overlaid film grain, ledger slips pinned at fractional rotations, sparse public-domain
glyphs (the ship on the horizon, wave marks as section rules). Data never wears the serif —
hashes, blocks, HF values, and commands are always monospace with tabular numerals.

**Key Characteristics:**
- One essay column plus one margin ledger; normal scrolling, no pinning.
- Cream on deep ink; gold carries links and emphasis; ember appears only for danger.
- Fraunces for all reading text; monospace strictly for on-chain data and commands.
- Depth by hairlines and translucent raised panels, not by heavy elevation.
- Motion is one authored idea: slips file in and figures draw themselves, once.

## Colors

A two-ink nautical palette — cream text on deep ink — with gold as the single voice of
emphasis and ember reserved for what liquidates.

### Primary
- **Harbor Gold** (`{colors.gold}`): links, emphasis (`em` and `code` render gold), the
  primary button, key ledger figures, the Keel line in charts, selection background,
  focus outlines, caret, scrollbar thumb. It is the only color allowed to ask for attention.
- **Pale Gold** (`{colors.gold-bright}`): primary-button hover only.
- **Dim Gold** (`{colors.gold-dim}`): quiet gold borders (formula box, nav GitHub chip) and
  the wave glyphs in part rules.

### Secondary
- **Ember** (`{colors.ember}`): danger only — the liquidation line, undefended HF values,
  crash bands, "liquidated" labels. Never decoration, never a link.

### Neutral
- **Deep Ink** (`{colors.ink}`): the page sea; also text on gold surfaces and hero overlays.
- **Raised Ink** (`{colors.ink-raised}`): formula-box fill; at 55% alpha it backs ledger
  slips and close cards.
- **Cream** (`{colors.cream}`): all reading text.
- **Cream 60** (`{colors.cream-60}`): secondary text — nav links, slip titles and notes,
  captions, footer.
- **Cream 40** (`{colors.cream-40}`): faint figure labels.
- **Hairline** (`{colors.hairline}`): every structural rule and quiet border — section
  top-rules, slip borders, table row rules, the terminal frame.

### Named Rules
**The One Voice Rule.** Gold is the only attention color. Ember exists solely to mean
liquidation danger; if it isn't danger, it isn't ember.

**The Hairline Rule.** Structure is drawn with 1px rules at 14% cream, often faded to
transparent at their ends. No opaque borders, no heavy dividers.

## Typography

**Display & Body Font:** Fraunces variable, roman + italic (self-hosted woff2, weights
300–700), falling back to Georgia / Times New Roman.
**Data Font:** ui-monospace system stack (SF Mono, Menlo).

**Character:** A wide-gamut serif doing both the oratory and the footnotes — literary but
precise, italic used for the thesis and asides. The monospace voice is reserved for what the
chain said.

### Hierarchy
- **Display** (560, clamp(3.4rem, 8vw, 6rem), lh 1, tracking 0.08em): the hero wordmark only.
- **Headline** (460, clamp(1.7rem, 3.2vw, 2.3rem), lh 1.22): section headings, each opening
  above a hairline top-rule.
- **Body** (360, 1.0625rem, lh 1.66): essay prose, max measure 66ch; italics for emphasis
  render gold. Openers may carry a gold drop cap (3.9em, weight 500).
- **Label** (560, 0.78rem, tracking 0.14em, uppercase): ledger slip titles only.
- **Data** (mono, 0.78–0.84rem, `font-variant-numeric: tabular-nums`): hashes, block numbers,
  HF values, tables, terminal output, the closing verdict.

### Named Rules
**The Mono-Means-Chain Rule.** Monospace appears only for data and commands — hashes, blocks,
HF values, code. Prose never goes mono; data never goes serif.

**The Sparse Wordmark Rule.** Letterspaced caps exist in exactly two sizes: the display
wordmark (0.08em) and the nav mark (0.32em). Body-level text is never uppercased outside
slip titles.

## Layout

The passage grid centers a `minmax(0, 42rem)` prose column beside a `minmax(15rem, 19rem)`
margin ledger, column gap clamp(2.5rem, 5vw, 5rem), horizontal padding clamp(1.25rem, 5vw, 3rem).
Sections stack with vertical padding clamp(3rem, 6vh, 4.5rem) and are separated by centered
part rules (a wave glyph between two fading hairlines). Wide figures span both columns up to
62rem. The hero band is min-height 62vh (56vh under 720px) with content capped at 72rem; a
1px horizon line closes it, ship silhouette riding its base. The nav is a fixed bar over a
fade-to-transparent ink gradient. Under 900px the ledger folds beneath the prose as a wrapping
row of flexible slips (min 240px, rotation removed); under 720px nav links hide and the small
sky raster loads; under 640px wide figures scroll horizontally at min-width 600px.

## Elevation & Depth

Depth is atmospheric, not elevational. Raised surfaces (slips, close cards) are translucent
raised-ink panels (`rgba(19,31,49,0.55)`) inside hairline borders; a fixed SVG-noise grain
overlay (opacity 0.4, `mix-blend-mode: overlay`) unifies the page. Shadows are rare and
serve legibility or weight, never chrome.

### Shadow Vocabulary
- **Button lift** (`box-shadow: 0 6px 24px rgba(13,24,38,0.45)`, hover
  `0 10px 30px rgba(13,24,38,0.5)` with `translateY(-1px)`): the primary button only.
- **Terminal weight** (`box-shadow: 0 18px 50px rgba(0,0,0,0.35)`): the terminal block.
- **Sky legibility** (`text-shadow: 0 4px 40px rgba(13,24,38,0.6)` and softer variants):
  hero text over the artwork; drop-shadow under the hero ship.

### Named Rules
**The Quiet Water Rule.** Ledger slips and cards carry no box-shadow — hairline border plus
translucent fill is the entire treatment. Only the primary button and the terminal cast
shadows.

## Shapes

Near-square geometry: 3px radius on buttons and chips, 4px on slips and the formula box,
6px on the terminal and close cards. Nothing is a pill, nothing is a hard 0. Ledger slips
settle at fractional rotations (0.4deg odd, −0.35deg even) — pinned paper, not a grid.
Structural lines fade at their ends (horizon, part rules). Glyphs are public-domain nautical
silhouettes (ship, wave) rendered via `currentColor`, used sparsely: the ship appears twice
(horizon, footer), the wave only as section punctuation.

## Components

### Buttons
- **Shape:** near-square (3px radius).
- **Primary:** Harbor Gold on Deep Ink text, 0.72rem × 1.5rem padding, weight 560, with the
  button-lift shadow.
- **Hover:** brightens to Pale Gold, rises 1px, shadow deepens; 160ms ease transitions.
- **Ghost:** transparent with a 40%-cream 1px border, cream text; border and text turn gold
  on hover. The nav GitHub chip is a small ghost variant with a dim-gold border.
- **Focus:** 2px gold outline, 3px offset (global `:focus-visible`).

### Ledger Slips (signature component)
- **Style:** hairline border, 4px radius, translucent raised-ink fill, 1.05rem × 1.15rem
  padding, pinned at a fractional rotation.
- **Anatomy:** uppercase label title (0.78rem, 0.14em, cream-60); optional big mono figure
  (1.18rem, gold — ember when danger); mono links that wrap anywhere; serif notes in cream-60.
- **Tables:** mono, tabular numerals, hairline row rules, right column cream-60, danger rows
  ember.

### Cards / Containers
- **Close cards:** hairline border, 6px radius, translucent raised-ink fill, 1.4rem × 1.5rem
  padding, gold `h3`, mono `pre` content.
- **Formula box:** dim-gold border, 4px radius, Raised Ink fill, gold mono content.

### Terminal
Hairline frame, 6px radius, terminal-weight shadow; title bar `#1a2436` with a truncating
mono command; body `#0a1220`, mono 0.8rem, cream text with gold `<b>` highlights.

### Navigation
Fixed bar over a fading ink gradient. Wordmark: 0.95rem, weight 600, 0.32em tracking.
Links: 0.88rem italic serif, cream-60 → gold on hover. GitHub as a bordered chip. Links
hidden under 720px.

### Figures
Inline SVG only, styled by the `f-*` class vocabulary: hairline axes, ember dashed
liquidation lines, gold Keel strokes (3px round caps) vs ember undefended strokes (2.5px),
mono 20px labels in cream-40, gold defend markers with ink strokes.

### Motion (signature interaction)
GSAP (vendored, ScrollTrigger + DrawSVG). One idea: ledger slips file in from the right
(x 48, +2.5deg over their settle rotation, power3.out, ~0.75s) and pin themselves, `once: true`;
figures draw themselves a single time on entry; the hero plays one quiet staggered entrance
with the ship sliding in. Micro-transitions elsewhere are 160ms ease. No pinning, no
scroll-jacking, no looping animation. `prefers-reduced-motion` and `?nomotion` disable
everything (CSS forces slips and figures fully visible).

## Do's and Don'ts

### Do:
- **Do** keep the essay-plus-margin-ledger structure: reasoning in the prose column, on-chain
  artifacts as slips beside the passage that cites them.
- **Do** set every hash, block number, HF value, and command in the mono stack with
  `tabular-nums`, and link real tx hashes to Etherscan.
- **Do** draw structure with 1px hairlines at 14% cream, fading at their ends.
- **Do** keep motion once-per-element and entrance-only, honoring reduced-motion and
  `?nomotion`.
- **Do** keep the sunset-sky artwork and ship silhouette (user-pinned identity); serve the
  small raster under 720px.

### Don't:
- **Don't** use ember for anything but liquidation danger, or introduce a second accent.
- **Don't** pin sections, scroll-jack, or build full-screen slide layouts — the user
  rejected the "PPT" pattern explicitly.
- **Don't** put prose in monospace or data in the serif.
- **Don't** add box-shadows to slips or cards; the Quiet Water Rule reserves shadows for the
  primary button and the terminal.
- **Don't** invent evidence — every figure, hash, and verdict on the surface is real and
  fixed; extend the page only with artifacts that exist on-chain.

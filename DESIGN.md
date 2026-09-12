---
name: KEEL
description: Verifiable-secrecy liquidation protection — a dense dev-tool landing under a sunset sky.
colors:
  ink: "#0b1522"
  ink-2: "#101d2f"
  ink-3: "#16263c"
  cream: "#f3e7cf"
  cream-70: "rgba(243, 231, 207, 0.72)"
  cream-55: "rgba(243, 231, 207, 0.55)"
  hairline: "rgba(243, 231, 207, 0.13)"
  gold: "#e6b36b"
  gold-dim: "rgba(230, 179, 107, 0.35)"
  gold-bright: "#f0c586"
  ember: "#d4695a"
typography:
  display:
    fontFamily: "Gloock, Georgia, serif"
    fontSize: "clamp(2.5rem, 5.6vw, 4.7rem)"
    fontWeight: 400
    lineHeight: 1.08
    letterSpacing: "0.01em"
  headline:
    fontFamily: "Gloock, Georgia, serif"
    fontSize: "clamp(2rem, 4.4vw, 3.3rem)"
    fontWeight: 400
    lineHeight: 1.1
    letterSpacing: "0.005em"
  body:
    fontFamily: "Schibsted Grotesk, -apple-system, 'Helvetica Neue', sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Schibsted Grotesk, -apple-system, 'Helvetica Neue', sans-serif"
    fontSize: "0.86rem"
    fontWeight: 500
  data:
    fontFamily: "ui-monospace, 'SF Mono', SFMono-Regular, Menlo, monospace"
    fontSize: "0.8rem"
rounded:
  sm: "5px"
  md: "6px"
  lg: "8px"
  xl: "10px"
  pill: "999px"
spacing:
  section-y: "clamp(4.5rem, 10vh, 7.5rem)"
  page-x: "clamp(1.25rem, 4vw, 2.5rem)"
  card-gap: "1.1rem"
  container: "72rem"
components:
  button-primary:
    backgroundColor: "{colors.gold}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0.78rem 1.6rem"
  button-primary-hover:
    backgroundColor: "{colors.gold-bright}"
    textColor: "{colors.ink}"
  button-ghost:
    backgroundColor: "rgba(11, 21, 34, 0.3)"
    textColor: "{colors.cream}"
    rounded: "{rounded.md}"
    padding: "0.78rem 1.3rem"
  card:
    backgroundColor: "rgba(11, 21, 34, 0.55)"
    textColor: "{colors.cream-70}"
    rounded: "{rounded.xl}"
    padding: "1.5rem 1.5rem 1.4rem"
  stat:
    backgroundColor: "rgba(16, 29, 47, 0.92)"
    textColor: "{colors.cream-70}"
    padding: "1.3rem 1.4rem"
---

# Design System: KEEL

## Overview

**Creative North Star: "The Harbor Console"**

KEEL's landing surface is a conventional high-craft dev-tool landing — the craft bar is
Linear/Vercel, recorded as a brand commitment in PRODUCT.md — kept in KEEL's own harbor
world: a painterly sunset-sky hero (user-pinned artwork), a ship silhouette, cream ink on
deep sea-ink, film grain over everything. Dense sections with short copy replace the earlier
longform essay (rejected as too wordy): a centered 88vh sky hero, a stat strip that overlaps
the hero's base, alternating full-width tinted bands, one pinned scrubbed showpiece (the
storm chart), a numbered proof pipeline, and a terminal-anchored enclave split.

The voice is two-faced by design: Gloock, a high-contrast serif at weight 400 only, speaks
every headline; Schibsted Grotesk does all reading and UI text; the monospace stack is
reserved for chain data — hashes, block numbers, HF values, commands, and the verdict.
Emphasis (`em`, `code`) renders gold, never italic. Every number on the page is real
Sepolia evidence.

**Key Characteristics:**
- Dense sectioned landing, short copy, stat strip, one scrubbed showpiece — never a slideshow.
- Gloock 400 for display only; Schibsted Grotesk 400–900 for everything read; mono for chain data.
- Cream on deep ink; gold is the single accent; ember means liquidation danger only.
- Translucent ink panels on hairline borders, backdrop blur, deep soft shadows on hero surfaces.
- Motion: once-only rise-ins and line-mask headline reveals; exactly one pinned scrub (the storm).

## Colors

A deepened nautical palette: three inks for layered surfaces, cream for text, gold as the
sole voice of emphasis.

### Primary
- **Harbor Gold** (`{colors.gold}`): links, `em`/`code` emphasis, the primary button, stat
  numbers, card titles, the Keel chart line, tx links, selection, focus outlines, caret,
  scrollbar. The only color that asks for attention.
- **Pale Gold** (`{colors.gold-bright}`): primary-button hover only.
- **Dim Gold** (`{colors.gold-dim}`): quiet gold borders — formula box, nav GitHub chip,
  pipeline line and step badges, tx-link underlines, card hover borders.

### Secondary
- **Ember** (`{colors.ember}`): danger only — liquidation line, threat bands, the located-target
  mark, "liquidated" labels, the leak figure caption. Never decoration, never a link.

### Neutral
- **Deep Ink** (`{colors.ink}`): the page sea; text on gold; hero and storm overlays.
- **Mid Ink** (`{colors.ink-2}`): tinted section bands (gradient full-bleed); at 0.92 alpha
  backs stat tiles; at 0.6 backs pipeline steps and close cards.
- **Raised Ink** (`{colors.ink-3}`): the terminal title bar.
- **Cream** (`{colors.cream}`): headings and primary reading text.
- **Cream 70** (`{colors.cream-70}`): secondary text — subs, list copy, captions, footer.
- **Cream 55** (`{colors.cream-55}`): faint figure labels.
- **Hairline** (`{colors.hairline}`): every structural border and rule at 13% cream — list
  row rules, card/tile/terminal borders, the solidified nav's bottom edge.

### Named Rules
**The One Voice Rule.** Gold is the only attention color; ember exists solely to mean
liquidation danger. If it isn't danger, it isn't ember.

**The Three Inks Rule.** Depth is layered ink, not new hues: page in Deep Ink, bands in Mid
Ink, raised chrome in Raised Ink — panels are translucent ink inside hairline borders.

## Typography

**Display Font:** Gloock (400 only, self-hosted woff2), falling back to Georgia.
**Text/UI Font:** Schibsted Grotesk (variable 400–900, roman + italic, self-hosted).
**Data Font:** ui-monospace system stack (SF Mono, Menlo).

**Character:** A high-contrast editorial serif doing nothing but headlines, over a sturdy
workmanlike grotesk that carries all copy and chrome. Italics are unused; emphasis is gold.

### Hierarchy
- **Display** (Gloock 400, clamp(2.5rem, 5.6vw, 4.7rem), lh 1.08, 0.01em): the hero headline,
  balanced (`text-wrap: balance`). Gloock also sets the nav wordmark (1rem, 0.3em tracking).
- **Headline** (Gloock 400, clamp(2rem, 4.4vw, 3.3rem), lh 1.1): section headings, often with
  an authored line break.
- **Sub** (Grotesk 400, 1.02–1.2rem hero / 1.05rem sections, lh 1.55–1.6, cream-70): one or
  two short sentences under each heading, max measure 36–46rem.
- **Body/UI** (Grotesk 400–700, 0.82–0.98rem): list copy at 400 cream-70 with 700 cream
  lead-ins; buttons 600–700; nav links 500.
- **Data** (mono 500, `tabular-nums`): stat numbers (clamp(1.25rem, 2.2vw, 1.7rem)), the
  verdict (clamp(1.5rem, 4.4vw, 3rem), 0.08em), tx links and step badges (0.78rem), figure
  labels, terminal (0.8rem).

### Named Rules
**The One Weight of Gloock Rule.** Gloock exists at 400 only and never sets body copy, UI,
or data — headlines and the wordmark, nothing else.

**The Mono-Means-Chain Rule.** Monospace appears only for chain data and commands — hashes,
blocks, HF values, code, the verdict. Prose never goes mono; data never goes grotesk.

## Layout

Content lives in a 72rem container with clamp(1.25rem, 4vw, 2.5rem) side padding; sections
stack at clamp(4.5rem, 10vh, 7.5rem) vertical padding. The hero is a centered 88vh sky band
(copy capped at 62rem, sub at 36rem, ship silhouette below the actions); the 4-across stat
strip overlaps its base by −4.6rem. Sections alternate plain and tinted: tinted bands run
full-bleed with a transparent → Mid Ink → transparent vertical gradient while their content
stays in the container. Section heads are left-aligned at max 46rem. Grids: leak and enclave
are asymmetric two-column splits (1fr / 1.25fr and 1fr / 1.15fr) collapsing at 880px; the
jitter row is 3 equal cards (1 column at 880px); the pipeline is 4 steps over a drawn
connector line (2-up at 880px, line hidden; 1-up at 560px); the storm showpiece is a
full-bleed 100vh pinned panel over the darkened sky. Nav links hide at 760px; the small sky
raster loads at 720px; the storm chart scrolls horizontally at 640px (min 600px). Facts
render as hairline-ruled list rows, never bullets.

## Elevation & Depth

Depth is layered translucent ink over the fixed grain (opacity 0.35, overlay blend), with
backdrop blur on chrome that floats over imagery: the solidified nav (blur 10px over 86%
ink), stat tiles (blur 8px), the ghost button (blur 4px). Panels sit inside hairline borders;
only surfaces that float over the hero or anchor a section carry shadows — and those shadows
are deep and soft.

### Shadow Vocabulary
- **Strip float** (`box-shadow: 0 30px 70px rgba(0,0,0,0.45)`): the overlapping stat strip.
- **Terminal weight** (`box-shadow: 0 26px 70px rgba(0,0,0,0.45)`): the terminal block.
- **Button lift** (`box-shadow: 0 8px 28px rgba(11,21,34,0.5)`, hover `0 12px 34px` with
  `translateY(-1px)`): the primary button.
- **Sky legibility** (`text-shadow: 0 6px 50px rgba(11,21,34,0.65)` and softer): hero text
  over the artwork; drop-shadow under the hero ship.

### Named Rules
**The Floating Chrome Rule.** Shadows belong to the three hero surfaces — stat strip,
terminal, primary button. Cards, steps, and list rows get hairline borders and, at most, a
gold-dim border with a −2px lift on hover.

## Shapes

A four-step radius scale plus the pill: 5px (nav chip), 6px (buttons), 8px (formula box),
10px (cards, steps, terminal, stat strip, close cards), 999px pills for the pipeline's
numbered badges (mono `01`–`04`, ink-filled, gold-dim border, straddling each card's top
edge). Full-bleed bands fade in and out with gradients rather than hard edges. The ship
silhouette (public-domain, `currentColor`) appears exactly twice — dark against the hero
sky, cream in the footer — and is the only glyph; the sky artwork appears twice (hero, and
darkened at 50% brightness behind the storm).

## Components

### Buttons
- **Shape:** 6px radius.
- **Primary:** Harbor Gold, Deep Ink text at weight 700, 0.78rem × 1.6rem padding, button-lift
  shadow; hover brightens to Pale Gold, rises 1px; 160ms ease transitions.
- **Ghost:** translucent ink fill with backdrop blur, 42%-cream 1px border, cream text at
  600; border and text turn gold on hover.
- **Nav chip:** small ghost variant — 0.84rem/600, dim-gold border, 5px radius.
- **Focus:** global 2px gold outline, 3px offset.

### Stat Strip (signature component)
4-up grid (2-up at 900px) fused by 1px hairline gaps inside one 10px-radius hairline frame,
floating over the hero seam with the strip-float shadow. Each tile: blurred near-opaque Mid
Ink, a gold mono tabular number (counts up on entry), a small cream-70 grotesk caption.

### Cards / Steps
- **Feature card:** hairline border, 10px radius, translucent Deep Ink fill, gold grotesk-700
  title, cream-70 copy; hover: gold-dim border + `translateY(-2px)`, 200ms.
- **Pipeline step:** same anatomy on Mid Ink 0.6 with a pill-numbered mono badge overlapping
  the top border and a `.tx` mono link (gold, dim-gold underline, `↗` suffix) to Etherscan.
- **Close card:** 10px radius, Mid Ink 0.6, gold title, mono `pre` commands.
- **Formula box:** dim-gold border, 8px radius, translucent ink, gold mono formula.

### Fact Lists
`leak-points` / `enc-facts`: borderless lists whose rows are separated by hairline top rules
(bottom rule on the last), cream-70 copy with grotesk-700 cream lead-ins. No bullet glyphs.

### Terminal
Hairline frame, 10px radius, terminal-weight shadow; Raised Ink title bar with a truncating
mono command; body `#081120`, mono 0.8rem cream with gold `<b>` status words.

### Navigation
Fixed bar, transparent at top; past the hero it solidifies (86% ink, 10px blur, hairline
bottom border, 240ms ease). Gloock wordmark, grotesk-500 links (cream-70 → gold), GitHub chip.

### Figures
Inline SVG styled by the `f-*` vocabulary: hairline axes, dashed ember liquidation line,
ember bands/target, gold Keel stroke (3.5px round caps) vs ember undefended (2.5px), mono
19px labels in cream-55, gold defend markers with ink strokes.

### Motion
GSAP (vendored: ScrollTrigger, SplitText, DrawSVG). Grammar: hero loads with a sky
scale-settle (1.08 → 1) and line-masked headline rise (SplitText, yPercent 110, power3.out),
then parallaxes out on scroll; section headlines rise through line masks once; everything
else enters via batched once-only rise-ins (y ~30, stagger 0.08, 0.7s); stat numbers count
up once. Exactly one pinned scrub: the storm chart draws under scrub over +150% scroll
(lines draw, defend markers pop with `back.out(2)`, verdict labels land). Two light scrubbed
accents: the pipeline connector draws, the footer ship sails in. Micro-transitions 160–240ms
ease. `prefers-reduced-motion` and `?nomotion` disable all of it.

## Do's and Don'ts

### Do:
- **Do** keep sections dense and copy short — a Gloock headline, one or two sub sentences,
  then cards, fact rows, or a figure. The craft bar is Linear/Vercel.
- **Do** set every hash, block, HF value, command, and stat in the mono stack with
  `tabular-nums`, linked to real Etherscan artifacts where one exists.
- **Do** keep the sunset sky and ship silhouette (user-pinned identity); reuse the sky
  darkened for showpiece backdrops rather than introducing new imagery.
- **Do** keep entrance motion once-only and honor reduced-motion and `?nomotion`.
- **Do** build depth from the three inks: translucent panels, hairline borders, backdrop
  blur on floating chrome.

### Don't:
- **Don't** add a second pinned/scrubbed section — the storm is the one showpiece; the page
  must never read as slides (the user rejected the PPT pattern).
- **Don't** use Gloock beyond 400-weight headlines and the wordmark, or set prose in mono /
  data in the grotesk. No italic emphasis — `em` is gold, upright.
- **Don't** use ember for anything but liquidation danger, or add any accent beyond gold.
- **Don't** put shadows on cards, steps, or list rows; the Floating Chrome Rule reserves
  them for the stat strip, terminal, and primary button.
- **Don't** invent evidence — every number and hash is the real Sepolia run; extend only
  with artifacts that exist on-chain.

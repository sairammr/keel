# KEEL — scroll site

A GSAP + ScrollTrigger scroll-story that tells the whole KEEL argument in six pinned
chapters: the leak → the jitter → the proof pipeline → the storm → the enclave → run it.

## Run it (anything works)

No build step, no dependencies, fully static. GSAP is vendored in `vendor/`.

```bash
# any static server, from this directory:
python3 -m http.server 4173      # → http://localhost:4173
# or
bunx serve .
# or from the repo root:
bun run site
```

Opening `index.html` directly (file://) also works — scripts are plain, not modules.
The Fraunces webfont needs internet; offline it falls back to Georgia gracefully.

## What's inside

| Piece | Source |
|---|---|
| `assets/sky.jpg` / `sky-small.jpg` | The sunset-sky artwork (2560w / 1280w JPEG) |
| `assets/ship.svg` | "Sailing Ship 2" — Icooon Mono via SVG Repo, public domain |
| `vendor/*.js` | GSAP 3.13 + ScrollTrigger + SplitText + DrawSVGPlugin (all free since 3.13) |
| `js/main.js` | All scroll choreography — pinned beat sections, horizontal pipeline, DrawSVG storm chart, count-ups |

All tx hashes, block numbers, and the ALL ROUNDS CONSISTENT verdict on the page are
from the real staging run on Sepolia (`docs/deployment/addresses.md`).

Respects `prefers-reduced-motion`: everything renders statically, no pins, no scrubs.

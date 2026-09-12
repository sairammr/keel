# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary (confirmed by user): ETHOnline 2026 hackathon judges evaluating the Chainlink CRE
tracks (T1 Best Confidential Workflow, T3 Automated Liquidation Protection). They scan a
submission in ~2 minutes, then dig into evidence if hooked. Secondary: developers/DeFi users
who clone the repo and verify the run themselves.

## Product Purpose

KEEL is verifiable-secrecy liquidation protection built as a Chainlink CRE confidential
workflow. A controller defends a leveraged lending position from inside a TEE. It (1) hides
the health-factor policy, (2) makes the policy non-invertible from observed actions via
salted upward-only jitter, and (3) proves post-hoc that one sealed policy produced every
action — commit before start, EIP-712 receipt per action, reveal after.

Success: judges believe the mechanism is real (live Sepolia evidence), understand why it
beats "put the threshold in a TEE", and can verify everything independently.

## Positioning

The one-line claim competitors cannot truthfully copy: "the starter hides the number; Keel
hides the number, hides what it will do next, and proves it never changed." Secrecy alone
is table stakes; *verifiable* secrecy (commit → receipts → reveal, all on-chain) is the
differentiator.

## Evidence (durable, real — never invent more)

- Staging run on Sepolia: commit block 11,682,878 (before ChallengeStarted), 2 defends,
  2 EIP-712 receipts, reveal; undefended position liquidates at HF 0.99/0.95/0.93, Keel
  survives ≥ 1.10. Tx hashes in docs/deployment/addresses.md and on the landing page.
- Independent verifier: `bun run verify` → ALL ROUNDS CONSISTENT (reconstructs pre-action
  HF from chain logs; does not trust receipts).
- CRE simulation runs the confidential `handlerInTee` (AWS Nitro us-west-2 banner);
  DON deployment gated on CRE Early Access (requested).
- 71 unit tests + 14 Solidity tests green; byte-for-byte faithful ChallengeLending copy.
- Contracts: PolicyCommit 0xE0e3C43Cc464e08b35Eb28Ff235c437166AFAc71, Receipts
  0xf8A66135642a0DeA582e874531Ef45FB2Dd01ee6 (Sepolia).

## Constraints & assets

- Landing page lives in `site/` — static, no build step, GSAP 3.13 vendored, must keep
  working over plain static serving (and degrade gracefully offline; Google-Fonts webfont).
- Binding visual constraint (user-pinned): the painterly sunset-sky artwork
  (`site/assets/sky.jpg`) and the nautical identity (ship glyph) stay. User rejected
  slideshow/PPT feel; wants a proper landing page with normal scrolling.
- PD glyph assets from SVG Repo: ship (480911), compass rose (399350), anchor (535132),
  wave (514289). Fraunces is the display face.
- Product app (Next.js dashboard: /verify /hunter /replay) is separate in `app/`; the
  landing page links out to it and to GitHub + Etherscan.

## Terminology

HF = health factor (integer ×100 on-chain; bp = basis points ×10000). "Defend" = repay or
deposit tx. "Commit" = keccak256(policyHash ‖ salt) posted pre-start. "Receipt" = EIP-712
signed action record. "Reveal" = publishing (policyBytes, salt) post-scenario.

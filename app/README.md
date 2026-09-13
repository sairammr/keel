# KEEL app

Next.js 15 dashboard. Pages: `/` product, `/pitch` judge deck (arrow-key slides), `/replay` split-screen Keel-vs-starter, `/hunter` Bayesian adversary + attack sim, `/verify` live Sepolia commit/receipt/reveal verification, `/docs` in-app guide.

All engine logic is imported from the workspace packages (`packages/controller`, `scenario`, `hunter`, `verifier`) — the app computes nothing on its own.

```bash
bun install
bun run dev     # :3000
bun run build
```

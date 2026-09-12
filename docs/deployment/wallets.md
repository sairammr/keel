# Deployment wallets

Public addresses only. **Private keys are never recorded here** — they live in `.env.deploy`
(gitignored, `chmod 600`) on the deploying machine.

| Role | Address | Purpose | Funding |
|---|---|---|---|
| `keel-demo` | `0x519d7c93C8A32185a8E6b39995f96fAb651e5EeC` | Deploys + admins the STAGING copy (own `ChallengeLending` + `PolicyCommit` + `Receipts`) and acts as its participant | needs ≥ 0.3 SepETH |
| `keel-prod` | `0x481ab1C25907dC363d3e6Ee03aE5e651387e9Fe3` | Joins + defends on the OFFICIAL contract `0x88574e7Cc0027afd04951daa09B64d4441931ba1` | needs ≥ 0.3 SepETH |

## Fund them

```bash
cast balance 0x519d7c93C8A32185a8E6b39995f96fAb651e5EeC --rpc-url https://ethereum-sepolia-rpc.publicnode.com
cast balance 0x481ab1C25907dC363d3e6Ee03aE5e651387e9Fe3 --rpc-url https://ethereum-sepolia-rpc.publicnode.com
```

Sepolia faucets: Google Cloud (`cloud.google.com/application/web3/faucet/ethereum/sepolia`),
Alchemy, or a PoW faucet. ~0.3–0.5 SepETH each is plenty for deploy + a scenario.

## Tx record

**Staging (clean stack, faithful copy)** — see `addresses.md` for the full deploy + scenario tx list.
Deploy + a full scenario (commit-before-start → 2 defends + receipts → stop → reveal) ran from
`keel-demo`-equivalent deployer `0x9673afB9…`. `bun run verify` → ALL ROUNDS CONSISTENT.

**Production (official contract `0x8857…`)** — executed 2026-09-13 from `keel-prod` (funded 0.35 SepETH from deployer, tx `0xc65a3711d80a8630386b99df2517a692356ab7f765f30310433b972136630730`):

| Step | Tx |
|---|---|
| `join()` on `0x88574e7C…` (participant #8, 500 vETH / 700k vUSD, HF 1.11) | `0x6a918f1241d0a33275100818e530a456b74b495f5d67b6063b1ac7ddeb7d3297` |
| `commit(hash, signer)` on PolicyCommit `0xACbf2d36…` (block 11691103, before start; commit `0xc6d21b2d…`, signer `0x818fa25e…`) | `0x1a97b6fb0cd73fdffbaf24006a01713e6b30cec79e1cae7f64b334872fa3d7a2` |
| `vETH.approve(lending, max)` | `0xbb1a1863c3261ecb941d7219ebc40173a43d97436e04a4ad39551e671fe13267` |
| `vUSD.approve(lending, max)` | `0xfa32b5486bb7ae24cfe654622a782ea2a8079ba8dd160d2762dfc39f535b6f84` |

Production salt + policy live in `.env.deploy` (`KEEL_PROD_SALT` / `KEEL_PROD_POLICY`, policy = DEFAULT + `tjitter_bp:300`) and `.env` (workflow env names) — never committed. Commit executed via `scripts/commit-prod.ts`; handler-side commitment re-derivation matches on-chain (`0xc6d21b2d…`). `controllerCodeHash` at commit: `0xd0897455e159f8208dcacdb8cc8435ebb8345f6768e9aa54f5c6b3b7465315cd`.

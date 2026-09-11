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

**Production (official contract `0x8857…`)** — `keel-prod` `join()` + commit-before-start NOT yet
executed (irreversible; deferred until the DON deploy path is ready). Recorded here when done.

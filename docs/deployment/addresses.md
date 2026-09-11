# Deployment record

## Staging (own faithful copy) — Sepolia, live

Deployer / admin / participant: `0x9673afB923d556979E4dfe6854d8C6e2D9994Eb4`
RPC: `https://ethereum-sepolia-rpc.publicnode.com` · event scan `fromBlock` 11682850

| Contract | Address |
|---|---|
| `ChallengeLending` (faithful copy) | `0xbc655f2febC8C9642C69BB746568050f53AAAc18` |
| `TokenvETH` | `0xd72f799E1af27E0d95aB4B9658A277A7811Fbcd0` |
| `TokenvUSD` | `0x974727EA649Ee0EfBB6A1b1A584614838B832cB3` |
| `PolicyCommit` | `0xE0e3C43Cc464e08b35Eb28Ff235c437166AFAc71` |
| `Receipts` | `0xf8A66135642a0DeA582e874531Ef45FB2Dd01ee6` |

`PolicyCommit` + `Receipts` are protocol-blind and reused by the production target.
The app (`app/lib/deployment.ts`) and `packages/verifier` point at this stack.

### Live scenario (real on-chain, `scripts/run-scenario-live.ts`, README crash path)

Commit posted **before** `start()` (commit block 11682878). Undefended position would have liquidated
at rounds 3–5 (`hf100=99/95/93 ≤ 100`); Keel defended and survived (debt unchanged, hf ≥ 111 every round).
Verified independently: `bun run verify … --from 11682850` → **ALL ROUNDS CONSISTENT**.

| Step | Tx |
|---|---|
| `commit` (block 11682878, before start) | [`0xa63f24f2…`](https://sepolia.etherscan.io/tx/0xa63f24f20941a30f7a8010a544249eb12479f1e958a20f4964e4ece486856205) |
| `start` | [`0x04dd5107…`](https://sepolia.etherscan.io/tx/0x04dd51072cbdcff4f2963cacd880d58dd33b9ad16a53501e253bd11482c617ab) |
| round 1 `deposit 51` | [`0x12358069…`](https://sepolia.etherscan.io/tx/0x12358069c613d4c36ff89e17ce1c79743f239ea263ded96bd424be216549bc04) |
| round 1 receipt | [`0x486ccffd…`](https://sepolia.etherscan.io/tx/0x486ccffdc2c2f8b0eddf7473d4c4b9a6b396729a5b3dea784c4d5f397d9034f2) |
| round 3 `deposit 46` (undefended would liquidate) | [`0xdd78fa34…`](https://sepolia.etherscan.io/tx/0xdd78fa342c61860e643e24f59f6ad1f8e28f49455ce4458de5599d017baf6613) |
| round 3 receipt | [`0x8ba5a8f0…`](https://sepolia.etherscan.io/tx/0x8ba5a8f0e97c56635a6362cc39574e297848d9ec78f1cfed0ebe6e2d8205cffc) |
| `stop` | [`0xf76114ea…`](https://sepolia.etherscan.io/tx/0xf76114ea2d73dda64da132254fd8e3d1a673a0ea55c561dc50fed98f59a6bae2) |
| `reveal(policyBytes, salt)` | [`0xd874ee6b…`](https://sepolia.etherscan.io/tx/0xd874ee6b2c95c28e43b5d3aa9ffbc3431a763987087d5a5cd55a1eac100e8d96) |

Participant `join()` is auto-registered by the faithful contract on deploy (position `(500, 700000, 111)`).
2 defends, 2 receipts (`Receipts.count == 2`). Salt `0x5a…5a` is a staging salt (revealed above); the production salt stays sealed.

> Prior staging stacks (`0x0DCC…`, and before it `0x486d…`) are abandoned; this is the clean stack the app + verifier read.

## Production (official contract) — Sepolia

Target `ChallengeLending`: `0x88574e7Cc0027afd04951daa09B64d4441931ba1` (`startBlock` 11661556).
Tokens: vETH `0x5dED1a40c3D56dA42E7f932f781c0432556c9814`, vUSD `0x6Fe92Ead5299040f50F095860b5A0A7A2D4041A2`.
Reuses the staging `PolicyCommit`/`Receipts`. Join + commit-before-start recorded here when executed (P3.5).

> Note: a first staging stack (PolicyCommit `0xc1D1…`, Lending `0x486d…`) was `start()`ed before a
> commit landed (a driver decode bug) and abandoned; this record is the clean re-deploy.

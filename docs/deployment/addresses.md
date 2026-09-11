# Deployment record

## Staging (own faithful copy) — Sepolia, live

Deployer / admin / participant: `0x9673afB923d556979E4dfe6854d8C6e2D9994Eb4`
Deployed block: 11682586 · RPC: `https://ethereum-sepolia-rpc.publicnode.com`

| Contract | Address |
|---|---|
| `ChallengeLending` (faithful copy) | `0x0DCC9ca6262b658E8cbD29bdCe18b5ca370e3949` |
| `TokenvETH` | `0xE08232A16e7109d276edac850D88ABBFaC6e2F7A` |
| `TokenvUSD` | `0x236263155D275448fa95BC6295fAb579f099fe76` |
| `PolicyCommit` | `0xACbf2d364817AB8c42C6573C748702BE0f7aAA6b` |
| `Receipts` | `0x726717FBe26e1502c5575647d1D46E618e912Aee` |

`PolicyCommit` + `Receipts` are protocol-blind and reused by the production target.

### Live scenario (real on-chain, `scripts/run-scenario-live.ts`, README crash path)

Commit posted **before** `start()` (commit block 11682596). Undefended position would have liquidated
at round 3 (`hf100=99 ≤ 100`); Keel defended and survived (hf 118). Debt unchanged all rounds.

| Step | Tx |
|---|---|
| `commit` (block 11682596, before start) | [`0x0e24266f…`](https://sepolia.etherscan.io/tx/0x0e24266fca22ea9f03c9201a7f6fe59073947dac8ebed2aea886a9ea96b78427) |
| `start` | [`0x22bee71f…`](https://sepolia.etherscan.io/tx/0x22bee71fb220fd2cea07cb9a6cbc4857813b451126d809dad94d6e032707e1ec) |
| round 1 `deposit 51` | [`0x1fb31af0…`](https://sepolia.etherscan.io/tx/0x1fb31af0f3e5e5921326f3cc78e3596ca40889218a2f4043d928d5007d157af9) |
| round 1 receipt | [`0xa5f3adba…`](https://sepolia.etherscan.io/tx/0xa5f3adbaa40c6d68db4cab8c97a3a22046a6a5e19c97d63c58dc14f57ea1eaae) |
| round 3 `deposit 46` (undefended would liquidate) | [`0xddbcd43d…`](https://sepolia.etherscan.io/tx/0xddbcd43df9c04f4bb3a9d311f5cf52ce998673ce54c93207c963bc4a508af54b) |
| round 3 receipt | [`0x825a5b9b…`](https://sepolia.etherscan.io/tx/0x825a5b9b032765e1e6b944b3cf788647cf739de80d8f448ef05e6d5fb542c591) |
| `stop` | [`0xcdd23dc0…`](https://sepolia.etherscan.io/tx/0xcdd23dc00de2d0aa6184a13c10b2b6d9e1e49a6eee0712c273daf40eee32fc74) |
| `reveal(policyBytes, salt)` | [`0x914eae20…`](https://sepolia.etherscan.io/tx/0x914eae20cd1c811ffce457e292b055e590ae0df8833749cfae8a4e20ec963234) |

`join()` (participant, before this run): [`0x5a663b9a…`](https://sepolia.etherscan.io/tx/0x5a663b9a587f004f70382e00920343a3fc99a596a0db83a4cec78d6dc73b7168).
2 defends, 2 receipts (`Receipts.count == 2`). Salt `0x5a…5a` is a staging salt (revealed above); the production salt stays sealed.

## Production (official contract) — Sepolia

Target `ChallengeLending`: `0x88574e7Cc0027afd04951daa09B64d4441931ba1` (`startBlock` 11661556).
Tokens: vETH `0x5dED1a40c3D56dA42E7f932f781c0432556c9814`, vUSD `0x6Fe92Ead5299040f50F095860b5A0A7A2D4041A2`.
Reuses the staging `PolicyCommit`/`Receipts`. Join + commit-before-start recorded here when executed (P3.5).

> Note: a first staging stack (PolicyCommit `0xc1D1…`, Lending `0x486d…`) was `start()`ed before a
> commit landed (a driver decode bug) and abandoned; this record is the clean re-deploy.

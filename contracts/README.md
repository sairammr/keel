# KEEL contracts (Foundry)

- `src/PolicyCommit.sol` — commit `keccak256(policyHash ‖ salt)` + receipt-signer address before the scenario starts; reveal after.
- `src/Receipts.sol` — EIP-712 action receipts (`KeelReceipts` domain), digest verified on-chain.
- `src/official/` — **byte-for-byte faithful** copy of the deployed `ChallengeLending` + tokens (Solidity 0.8.36), used for local E2E and the staging deployment.

```bash
forge test                      # 13 tests
bun run script/fidelity.ts      # proves local ChallengeLending == deployed official (metadata-stripped bytecode MATCH)
```

Deploy scripts in `script/`. Deployed addresses: [`../docs/deployment/addresses.md`](../docs/deployment/addresses.md).

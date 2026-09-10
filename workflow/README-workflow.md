# KEEL workflow — confidential CRE handler

A Chainlink CRE `handlerInTee` cron handler (60s) that runs inside a Nitro enclave, reconstructs
the lending position from **public chain data only**, decides via the shared controller
(`packages/controller`, the same code the app's scenario engine runs), and posts a policy
commitment plus EIP-712 action receipts. It never logs a policy value, salt, or threshold — the
handler returns only a one-word status: `COMMITTED` / `IDLE` / `SAFE` / `DEFENDED`.

Spec: KEEL build plan §3 (architecture), §4.2 (state reconstruction), §4.8 (handler pseudocode),
§5 (contracts / commitment scheme).

## Files
- `src/main.ts` — the handler + workflow registration (`handlerInTee`, or plain `handler` fallback).
- `src/chain.ts` — `ChainReader`: all chain I/O as raw JSON-RPC over the enclave HTTP capability.
- `src/policy.ts` — `parsePolicy(secrets)`: builds the `Policy` + salt + key from Vault secrets.
- `src/plan.ts` — pure helpers (block→round, leg ordering, nonce adjacency). Unit-tested.
- `src/config.ts` + `config.{local,staging,production}.json` — PUBLIC config only (no policy params).
- `src/codehash.ts` — `bun run codehash` prints keccak256 of the controller bundle.

## Setup
```bash
bun install
cp .env.example .env            # fill in real values locally (never commit)
cp secrets.example.yaml secrets.yaml
```

## Verify
```bash
bun run typecheck   # tsc --noEmit  → clean
bun test            # pure-logic tests (parsePolicy, decode, mapping, nonce adjacency)
```

## The controller code hash
The committed policy binds the algorithm via `controllerCodeHash`. Recompute whenever the
controller changes and paste it into `config.*.json`:
```bash
bun run codehash    # → 0x… ; set config.controllerCodeHash to this
```

## Simulate (no approval needed; cron fires immediately)
```bash
# dry run
cre workflow simulate workflow --target staging-settings --non-interactive --trigger-index 0

# broadcast real txs (commit/approvals on first tick, then actions)
cre workflow simulate workflow --target staging-settings --non-interactive --trigger-index 0 --broadcast
```
Secrets are mapped from `.env` via `secrets.yaml`. Confidential handlers run under the same
`simulate` command locally in WASM (no real enclave) — simulator evidence is acceptable for the
T1 Best Confidential Workflow prize.

## Deploy
```bash
# push secrets to the Vault DON
cre secrets create secrets.yaml --target staging-settings --secrets-auth=browser
# deploy
cre workflow deploy workflow --target production-settings
cre workflow list --registry private
```
`config.production.json` uses the official lending address `0x88574e7Cc0027afd04951daa09B64d4441931ba1`.
Set the real `policyCommit` / `receipts` addresses after the Foundry deploy.

## R1 fallback runner loop
If the deployed cron is unreliable, drive ticks from a laptop (still non-custodial — the key is a
Vault secret only in the deployed/TEE case; for the loop you simulate with `.env`):
```bash
while true; do
  cre workflow simulate workflow --target staging-settings --non-interactive --trigger-index 0 --broadcast
  sleep 45
done
```

## R2 fallback: non-TEE deploy
If confidential (`nitro`) execution access is not granted in time, build with `KEEL_TEE=0`. The
same handler registers via the plain `handler` entry (no TEE constraint, no attestation, secrets
exposed to the DON) so the pipeline still deploys and runs. Default is `KEEL_TEE=1` (confidential).

## Notes
- `handlerInTee(trigger, fn, {})` — the 3rd arg is the TEE constraint (`{}` = any region);
  4th arg (hooks) omitted. Verified against `@chainlink/cre-sdk` 1.18.0 `dist/**/*.d.ts`.
- `getUserPosition` is decoded positionally for `collateral`/`debt`; **HF is recomputed** from
  `C·P·θ` and never trusted from the decoded tail (the tail fields are unreliable per the plan).
- Two-leg solutions (deposit-to-cap + repay-rest, or the reverse) send one tx per non-zero leg;
  the finishing leg is sent last, the receipt records it, and the receipt tx nonce is exactly
  `actionNonce + 1` (visible adjacency on Etherscan).

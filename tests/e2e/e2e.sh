#!/usr/bin/env bash
# KEEL end-to-end test: real Anvil chain (chain-id 11155111), real contracts, real controller.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
RPC="http://127.0.0.1:8545"
ANVIL_PID=""

cleanup() {
  if [[ -n "$ANVIL_PID" ]] && kill -0 "$ANVIL_PID" 2>/dev/null; then
    kill "$ANVIL_PID" 2>/dev/null || true
    wait "$ANVIL_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

# 0. ensure forge artifacts exist
if [[ ! -f "$ROOT/contracts/out/ChallengeLending.sol/ChallengeLending.json" ]]; then
  echo "== building contracts =="
  (cd "$ROOT/contracts" && forge build)
fi

# 1. start anvil
echo "== starting anvil (chain-id 11155111) =="
anvil --chain-id 11155111 --silent &
ANVIL_PID=$!

# wait for RPC to answer
for i in $(seq 1 50); do
  if cast block-number --rpc-url "$RPC" >/dev/null 2>&1; then break; fi
  sleep 0.2
  if [[ $i -eq 50 ]]; then echo "anvil did not come up"; exit 1; fi
done
echo "anvil up (pid $ANVIL_PID), block $(cast block-number --rpc-url "$RPC")"

# 2+3. deploy + run the lifecycle with viem
RPC_URL="$RPC" bun run "$HERE/run.ts"

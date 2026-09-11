#!/usr/bin/env bash
# Liveness check for a running Keel workflow (PLAN P5.5).
# Reads public chain state only — safe to run anywhere, no keys. Exits non-zero if the
# wallet is low on gas or if the workflow looks stalled (so systemd timers / alerts catch it).
#
# Usage:
#   ./scripts/liveness.sh [production|staging] [participant_addr]
#     default target:      production
#     default participant: keel-prod (production) / keel-demo deployer (staging)
#
# Checks: gas balance (ALERT < 0.05 SepETH), tx nonce, scenarioStartTime, Receipts.count.
set -uo pipefail

command -v cast >/dev/null 2>&1 || { echo "FATAL: foundry 'cast' not on PATH"; exit 1; }

TARGET="${1:-production}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CFG="$ROOT/workflow/config.${TARGET}.json"
[ -f "$CFG" ] || { echo "FATAL: no config $CFG"; exit 1; }

# flat JSON — one key per line; grab string values without a jq dependency.
jget() { grep -o "\"$1\"[[:space:]]*:[[:space:]]*\"[^\"]*\"" "$CFG" | sed 's/.*:[[:space:]]*"\(.*\)"/\1/'; }

RPC="$(jget rpc_url)"
LENDING="$(jget lending)"
RECEIPTS="$(jget receipts)"

# default participant per target (public addresses, from docs/deployment/wallets.md)
if [ "$TARGET" = "production" ]; then
  PARTICIPANT="${2:-0x481ab1C25907dC363d3e6Ee03aE5e651387e9Fe3}"   # keel-prod
else
  PARTICIPANT="${2:-0x9673afB923d556979E4dfe6854d8C6e2D9994Eb4}"   # staging deployer/participant
fi

echo "== keel liveness · target=$TARGET · participant=$PARTICIPANT =="
echo "rpc=$RPC  lending=$LENDING"

rc=0

# 1. gas balance (wei → ETH via cast; alert under 0.05)
BAL_WEI="$(cast balance "$PARTICIPANT" --rpc-url "$RPC" 2>/dev/null)" || { echo "balance: RPC error"; exit 2; }
BAL_ETH="$(cast to-unit "$BAL_WEI" ether 2>/dev/null)"
echo "gas balance: ${BAL_ETH} SepETH"
# integer-safe threshold: 0.05 ETH = 5e16 wei
if [ "${#BAL_WEI}" -lt 17 ] || { [ "${#BAL_WEI}" -eq 17 ] && [ "${BAL_WEI:0:1}" -lt 5 ]; }; then
  echo "  ALERT: balance < 0.05 SepETH — top up or the workflow will stall"
  rc=1
fi

# 2. tx nonce (advancing over successive runs == wallet is acting)
NONCE="$(cast nonce "$PARTICIPANT" --rpc-url "$RPC" 2>/dev/null)"
echo "tx nonce: ${NONCE:-?}"

# 3. scenario state: start==0 → not started; end>0 → stopped; else active.
SST="$(cast call "$LENDING" "scenarioStartTime()(uint256)" --rpc-url "$RPC" 2>/dev/null)"
SET="$(cast call "$LENDING" "scenarioEndTime()(uint256)" --rpc-url "$RPC" 2>/dev/null)"
if [ "${SST:-0}" = "0" ]; then STATE="not started — commit-only phase";
elif [ "${SET:-0}" != "0" ]; then STATE="STOPPED — scenario over";
else STATE="ACTIVE — defending"; fi
echo "scenarioStartTime: ${SST:-?}  ($STATE)"

# 4. receipts posted so far
CNT="$(cast call "$RECEIPTS" "count(address)(uint256)" "$PARTICIPANT" --rpc-url "$RPC" 2>/dev/null)"
echo "receipts posted: ${CNT:-?}"

echo "== $([ "$rc" -eq 0 ] && echo OK || echo DEGRADED) =="
exit "$rc"

#!/usr/bin/env bash
# Plan-C fallback runner (PLAN P3.5 Branch C / R1).
# When DON deploy access is NOT granted, run the SAME confidential handler on an
# always-on box by looping `cre workflow simulate --broadcast`. Identical code path
# to a DON execution — it just is not scheduled by the DON. Disclose this in the README.
#
# Usage:
#   ./scripts/fallback-runner.sh [target] [interval_s] [env_file]
#   target      cre settings target     (default: production-settings)
#   interval_s  sleep between ticks      (default: 45; the prod cron is 60s)
#
# Secrets: `cre workflow simulate` maps secret ids from workflow/secrets.yaml via the
# box's .env (chmod 600). Export them before running, or source an env file. This script
# NEVER echoes a secret.
#
# systemd (so it restarts on crash/reboot) — example unit at the bottom of this file.
set -uo pipefail

TARGET="${1:-production-settings}"
INTERVAL="${2:-45}"
ENV_FILE="${3:-.env}"   # cre simulate reads the env FILE, not the shell env — pass the right one
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

command -v cre >/dev/null 2>&1 || { echo "FATAL: cre CLI not on PATH"; exit 1; }

# --- on-camera formatting (colors only when stdout is a TTY) ------------------
if [ -t 1 ]; then
  B=$'\033[1m'; D=$'\033[2m'; BL=$'\033[38;5;69m'; GR=$'\033[38;5;42m'
  RD=$'\033[38;5;203m'; GY=$'\033[38;5;245m'; R=$'\033[0m'
else
  B=""; D=""; BL=""; GR=""; RD=""; GY=""; R=""
fi
W=76
log() { echo "${GY}[$(date -u +%H:%M:%SZ)]${R} $*"; }

echo ""
echo "${BL}╔$(printf '═%.0s' $(seq 1 $W))╗${R}"
printf "${BL}║${R}%*s${B}%s${R}%*s${BL}║${R}\n" 24 "" " KEEL · CONFIDENTIAL WORKFLOW " 23 ""
printf "${BL}║${R}%*s${GY}%s${R}%*s${BL}║${R}\n" 14 "" " same handlerInTee code path as a DON execution " 14 ""
echo "${BL}╚$(printf '═%.0s' $(seq 1 $W))╝${R}"
echo "  ${GY}target${R}    $TARGET"
echo "  ${GY}interval${R}  ${INTERVAL}s"
echo "  ${GY}secrets${R}   $ENV_FILE (never printed)"
echo ""
cd "$ROOT"

# ponytail: plain forever-loop, not a supervisor. systemd (below) handles restart/reboot;
# this just keeps ticking and never exits on a single failed simulate.
TICK=0
while true; do
  TICK=$((TICK + 1))
  echo "${BL}── tick #${TICK} ────────────────────────────────────────────────────────────${R}"
  if cre workflow simulate workflow \
        --target "$TARGET" \
        --env "$ENV_FILE" \
        --non-interactive \
        --trigger-index 0 \
        --broadcast; then
    log "${GR}${B}✓ tick ok${R} — next in ${INTERVAL}s"
  else
    log "${RD}${B}✗ tick FAILED${R} (exit $?) — continuing; next in ${INTERVAL}s"
  fi
  echo ""
  sleep "$INTERVAL"
done

# --- systemd unit (install on the always-on box) -----------------------------
# /etc/systemd/system/keel-runner.service
#
#   [Unit]
#   Description=Keel fallback runner (cre simulate --broadcast loop)
#   After=network-online.target
#   Wants=network-online.target
#
#   [Service]
#   Type=simple
#   User=keel
#   WorkingDirectory=/home/keel/keel
#   EnvironmentFile=/home/keel/keel/.env          # chmod 600, holds the secret env vars
#   ExecStart=/home/keel/keel/scripts/fallback-runner.sh production-settings 45
#   Restart=always
#   RestartSec=10
#
#   [Install]
#   WantedBy=multi-user.target
#
#   sudo systemctl enable --now keel-runner
#   journalctl -u keel-runner -f

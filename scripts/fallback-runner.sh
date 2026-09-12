#!/usr/bin/env bash
# Plan-C fallback runner (PLAN P3.5 Branch C / R1).
# When DON deploy access is NOT granted, run the SAME confidential handler on an
# always-on box by looping `cre workflow simulate --broadcast`. Identical code path
# to a DON execution — it just is not scheduled by the DON. Disclose this in the README.
#
# Usage:
#   ./scripts/fallback-runner.sh [target] [interval_s]
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

log() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*"; }

log "fallback-runner start · target=$TARGET · interval=${INTERVAL}s · cwd=$ROOT"
cd "$ROOT"

# ponytail: plain forever-loop, not a supervisor. systemd (below) handles restart/reboot;
# this just keeps ticking and never exits on a single failed simulate.
while true; do
  if cre workflow simulate workflow \
        --target "$TARGET" \
        --env "$ENV_FILE" \
        --non-interactive \
        --trigger-index 0 \
        --broadcast; then
    log "tick ok"
  else
    log "tick FAILED (exit $?) — continuing; next tick in ${INTERVAL}s"
  fi
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

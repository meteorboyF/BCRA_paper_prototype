#!/usr/bin/env bash
# Phase A — background ledger growth with ZERO document activity.
#
# Experiment 12 modelled ledger growth as linear in document count alone
# (~7 KB/doc/peer). The TimeAnchor added for reviewer M2 breaks that model: it
# is a *submit*, fired on a fixed schedule by TimeAnchorHeartbeat
# (fabric.time-anchor.interval-ms, default 60000), so the ledger now grows on a
# clock as well as on documents. Growth is a*docs + b*time, and Experiment 12
# never measured b because b did not exist.
#
# This phase measures b directly: sample the ledger while nothing registers a
# document, so every new block is a heartbeat.
#
#   idle.sh <out-dir> <duration-minutes> [sample-interval-seconds]
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT="${1:?usage: idle.sh <out-dir> <minutes> [interval-s]}"
MINUTES="${2:-15}"
INTERVAL="${3:-60}"
mkdir -p "$OUT"
CSV="$OUT/ledger_size.csv"

echo "=== Phase A: idle background growth, ${MINUTES} min @ ${INTERVAL}s ==="
echo "NOTE: nothing may register a document for the duration, or this measures the wrong thing."

# Record the heartbeat configuration actually in force, rather than assuming the default.
PID=$(ss -lntpH 'sport = :8080' | grep -oP 'pid=\K[0-9]+' | head -1 || true)
{
  echo "phase_a_start=$(date -Iseconds)"
  echo "duration_minutes=$MINUTES"
  echo "sample_interval_s=$INTERVAL"
  if [[ -n "${PID:-}" ]]; then
    echo "backend_pid=$PID"
    tr '\0' '\n' < "/proc/$PID/environ" \
      | grep -E '^(FABRIC_TIME_ANCHOR|FABRIC_ENABLED|DOCUMENT_MATERIAL)' || true
  fi
  echo "time_anchor_defaults_from_application_yml: enabled=true interval-ms=60000 initial-delay-ms=15000"
} > "$OUT/phase_a_env.txt"

END=$(( $(date +%s) + MINUTES * 60 ))
bash "$HERE/snapshot.sh" "$CSV" idle
while [[ $(date +%s) -lt $END ]]; do
  sleep "$INTERVAL"
  bash "$HERE/snapshot.sh" "$CSV" idle
done
echo "=== Phase A done -> $CSV ==="

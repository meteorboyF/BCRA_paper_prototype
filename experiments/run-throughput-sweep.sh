#!/usr/bin/env bash
# Generalized throughput sweep (fixed-count exp1-round.js). Env-parametrized so it can
# serve Fabric-mode and PostgreSQL-only phases. Backend mode (fabric.enabled) must already
# be set by the caller (relaunch backend before invoking). Appends to results/exp1_throughput.csv.
#
# Env:
#   MODE     (fabric|postgres)        default fabric
#   METHOD   (gateway|db_only|cli_proxy) default gateway
#   BT_MS    batch timeout label (ms) default 2000
#   TOOL     label                    default fixedcount_x10
#   CONCS    space list               default "50 100 150 200 300 400 500 600"
#   TRIALS   default 5
set -uo pipefail
REPO=/home/angkon/Pangochain_AOOP
CSV=$REPO/results/exp1_throughput.csv
ROUND=$REPO/experiments/exp1-round.js
PLATFORM=linux_x86_64
MODE=${MODE:-fabric}; METHOD=${METHOD:-gateway}; BT=${BT_MS:-2000}
TOOL=${TOOL:-fixedcount_x10}; TRIALS=${TRIALS:-5}
read -r -a CONCS <<< "${CONCS:-50 100 150 200 300 400 500 600}"

cd "$REPO"; mkdir -p results
[ -f "$CSV" ] || echo "experiment,mode,batch_timeout_ms,tool,concurrency,trial,tps,p50_ms,p95_ms,errors,success,elapsed_s,cpu_pct,ram_mb,method,platform" > "$CSV"
log(){ echo "[sweep $(date +%H:%M:%S)] $*"; }
refresh_jwt(){ local OUT; OUT=$(python3 experiments/setup-bench-data.py 2>/tmp/sweep_setup.err) || { cat /tmp/sweep_setup.err; return 1; }; eval "$OUT"; export PANGOCHAIN_JWT_TOKEN PANGOCHAIN_TEST_CASE_ID PANGOCHAIN_TEST_DOC_ID; [ -n "${PANGOCHAIN_JWT_TOKEN:-}" ]; }
emit(){ local conc=$1 trial=$2 line=$3 tps p50 p95 err succ el cpu ram
  tps=$(grep -oP 'TPS=\K[0-9.]+' <<<"$line"); p50=$(grep -oP 'P50=\K[0-9]+' <<<"$line"); p95=$(grep -oP 'P95=\K[0-9]+' <<<"$line")
  err=$(grep -oP 'errors=\K[0-9]+' <<<"$line"); succ=$(grep -oP 'success=\K[0-9]+' <<<"$line"); el=$(grep -oP 'elapsed=\K[0-9.]+' <<<"$line")
  cpu=$(grep -oP 'cpu=\K[0-9.]+' <<<"$line"); ram=$(grep -oP 'ram=\K[0-9]+' <<<"$line")
  echo "exp1,$MODE,$BT,$TOOL,$conc,$trial,${tps:-0},${p50:-NA},${p95:-NA},${err:-NA},${succ:-NA},${el:-NA},${cpu:-NA},${ram:-NA},$METHOD,$PLATFORM" >> "$CSV"; }

log "=== sweep MODE=$MODE METHOD=$METHOD BT=${BT}ms concs=${CONCS[*]} ==="
refresh_jwt || { log "JWT failed"; exit 1; }
log "JWT ok CASE=$PANGOCHAIN_TEST_CASE_ID DOC=$PANGOCHAIN_TEST_DOC_ID"
log "warm-up conc=50 (trial=0, discarded)"
WLINE=$(PANGOCHAIN_CONCURRENCY=50 node "$ROUND" 2>&1); log "  $WLINE"; emit 50 0 "$WLINE"; sleep 5
for c in "${CONCS[@]}"; do
  log "--- concurrency=$c ---"
  for t in $(seq 1 "$TRIALS"); do
    LINE=$(PANGOCHAIN_CONCURRENCY=$c node "$ROUND" 2>&1); log "  trial $t: $LINE"; emit "$c" "$t" "$LINE"; sleep 8
  done
done
log "=== sweep done MODE=$MODE BT=${BT}ms ==="

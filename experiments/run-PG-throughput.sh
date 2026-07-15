#!/usr/bin/env bash
# TASK PG — PostgreSQL-only throughput baseline with the CANONICAL duration60s tool.
# Backend MUST already be running in db-only mode (fabric.enabled=false) — caller relaunches it.
# Concurrency sweep {50,100,150,200,300,400,500,600}, 5 reps + 1 discarded warm-up.
# Appends mode=postgres rows to results/exp1_throughput.csv.
set -uo pipefail
REPO=/home/angkon/Pangochain_AOOP
CSV=$REPO/results/exp1_throughput.csv
TOOL=$REPO/experiments/caliper/pangochain-loadtest-configurable.js
DUR=${DUR:-60}; TRIALS=${TRIALS:-5}
read -r -a CONCS <<< "${CONCS:-50 100 150 200 300 400 500 600}"
cd "$REPO"; mkdir -p results
log(){ echo "[PG $(date +%H:%M:%S)] $*"; }
[ -f "$CSV" ] || echo "experiment,mode,batch_timeout_ms,tool,concurrency,trial,tps,p50_ms,p95_ms,errors,success,elapsed_s,cpu_pct,ram_mb,method,platform" > "$CSV"
refresh_jwt(){ local OUT; OUT=$(python3 experiments/setup-bench-data.py 2>/tmp/pg_setup.err) || { cat /tmp/pg_setup.err; return 1; }; eval "$OUT"; export PANGOCHAIN_JWT_TOKEN PANGOCHAIN_TEST_CASE_ID PANGOCHAIN_TEST_DOC_ID; [ -n "${PANGOCHAIN_JWT_TOKEN:-}" ]; }
emit(){ # emit <conc> <trial> <line>
  local conc=$1 trial=$2 line=$3 tps p50 p95 err el
  tps=$(grep -oP 'TPS=\K[0-9.]+' <<<"$line"); p50=$(grep -oP 'P50=\K[0-9]+' <<<"$line")
  p95=$(grep -oP 'P95=\K[0-9]+' <<<"$line"); err=$(grep -oP 'errors=\K[0-9]+' <<<"$line"); el=$(grep -oP 'elapsed=\K[0-9.]+' <<<"$line")
  echo "exp1,postgres,NA,duration60s,$conc,$trial,${tps:-0},${p50:-NA},${p95:-NA},${err:-NA},NA,${el:-$DUR},NA,NA,db_only,linux_x86_64" >> "$CSV"
}

log "=== PG-only throughput  tool=duration60s dur=${DUR}s concs=${CONCS[*]} ==="
refresh_jwt || { log "JWT failed"; exit 1; }
log "JWT ok CASE=$PANGOCHAIN_TEST_CASE_ID DOC=$PANGOCHAIN_TEST_DOC_ID"
log "warm-up conc=50 (trial=0, discarded)"
WLINE=$(PANGOCHAIN_CONCURRENCY=50 PANGOCHAIN_DURATION_SEC=$DUR node "$TOOL" 2>&1); log "  $WLINE"; emit 50 0 "$WLINE"; sleep 5
for c in "${CONCS[@]}"; do
  log "--- concurrency=$c ---"
  for t in $(seq 1 "$TRIALS"); do
    LINE=$(PANGOCHAIN_CONCURRENCY=$c PANGOCHAIN_DURATION_SEC=$DUR node "$TOOL" 2>&1); log "  trial $t: $LINE"; emit "$c" "$t" "$LINE"; sleep 5
  done
done
log "=== TASK PG done -> $CSV ==="

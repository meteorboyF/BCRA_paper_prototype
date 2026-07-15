#!/usr/bin/env bash
# V1 / Exp1 Phase A — Fabric-mode throughput sweep (gateway write path, BatchTimeout=2s).
# Fixed-count methodology (exp1-round.js: clients x10 tx, closed-loop) — matches the
# canonical Exp1 tool. 1 discarded warm-up (conc=50, trial=0) + 5 measured trials/point.
# Appends raw per-trial rows to results/exp1_throughput.csv.
set -uo pipefail

REPO=/home/angkon/Pangochain_AOOP
CSV=$REPO/results/exp1_throughput.csv
ROUND=$REPO/experiments/exp1-round.js
PLATFORM=linux_x86_64
METHOD=gateway
MODE=fabric
BT=2000
TOOL=fixedcount_x10
CONCS=(50 100 150 200 300 400 500 600)
TRIALS=5

cd "$REPO"
mkdir -p results
# header (only if file absent)
if [ ! -f "$CSV" ]; then
  echo "experiment,mode,batch_timeout_ms,tool,concurrency,trial,tps,p50_ms,p95_ms,errors,success,elapsed_s,cpu_pct,ram_mb,method,platform" > "$CSV"
fi

log(){ echo "[exp1-A $(date +%H:%M:%S)] $*"; }

refresh_jwt(){
  local OUT
  OUT=$(python3 experiments/setup-bench-data.py 2>/tmp/exp1_setup.err) || { log "setup-bench-data failed"; cat /tmp/exp1_setup.err; return 1; }
  eval "$OUT"
  export PANGOCHAIN_JWT_TOKEN PANGOCHAIN_TEST_CASE_ID PANGOCHAIN_TEST_DOC_ID
  [ -n "${PANGOCHAIN_JWT_TOKEN:-}" ] || { log "no JWT"; return 1; }
}

emit(){  # emit <conc> <trial> <line>
  local conc=$1 trial=$2 line=$3
  local tps p50 p95 err succ el cpu ram
  tps=$(grep -oP 'TPS=\K[0-9.]+'      <<<"$line"); p50=$(grep -oP 'P50=\K[0-9]+' <<<"$line")
  p95=$(grep -oP 'P95=\K[0-9]+'       <<<"$line"); err=$(grep -oP 'errors=\K[0-9]+' <<<"$line")
  succ=$(grep -oP 'success=\K[0-9]+'  <<<"$line"); el=$(grep -oP 'elapsed=\K[0-9.]+' <<<"$line")
  cpu=$(grep -oP 'cpu=\K[0-9.]+'      <<<"$line"); ram=$(grep -oP 'ram=\K[0-9]+' <<<"$line")
  echo "exp1,$MODE,$BT,$TOOL,$conc,$trial,${tps:-0},${p50:-NA},${p95:-NA},${err:-NA},${succ:-NA},${el:-NA},${cpu:-NA},${ram:-NA},$METHOD,$PLATFORM" >> "$CSV"
}

log "=== Exp1 Phase A (Fabric, BT=2s, gateway) ==="
log "configtx BatchTimeout: $(grep BatchTimeout pangochain-fabric/configtx.yaml | tr -d ' ')"
refresh_jwt || exit 1
log "JWT ok CASE=$PANGOCHAIN_TEST_CASE_ID DOC=$PANGOCHAIN_TEST_DOC_ID"

# Warm-up (discarded): conc=50, logged as trial=0
log "warm-up conc=50 (trial=0, discarded)"
WLINE=$(PANGOCHAIN_CONCURRENCY=50 node "$ROUND" 2>&1); log "  $WLINE"; emit 50 0 "$WLINE"
sleep 5

for c in "${CONCS[@]}"; do
  log "--- concurrency=$c ---"
  for t in $(seq 1 $TRIALS); do
    LINE=$(PANGOCHAIN_CONCURRENCY=$c node "$ROUND" 2>&1)
    log "  trial $t: $LINE"
    emit "$c" "$t" "$LINE"
    sleep 8
  done
done

log "=== Phase A complete -> $CSV ==="

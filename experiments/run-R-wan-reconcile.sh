#!/usr/bin/env bash
# TASK R — reconcile the Exp5 WAN 0 ms baseline (Inconsistency #13).
# Measures 200-client throughput at 0 ms RTT for BOTH netem configs back-to-back:
#   (a) config=bridge      : netem delay on the Docker bridge interface only
#   (b) config=bridge_veth : netem delay on the bridge AND each orderer container veth
# 5 runs each. If SWEEP=1, runs full RTT sweep {0,50,100,150} for the config in CONFIGS.
# Writes results/exp5_wan.csv (new canonical). Uses the REST gateway write path.
set -uo pipefail
REPO=/home/angkon/Pangochain_AOOP
CSV=$REPO/results/exp5_wan.csv
WANTOOL=$REPO/experiments/caliper/pangochain-loadtest-wan.js
REPS=${REPS:-5}
SWEEP=${SWEEP:-0}
read -r -a RTTS <<< "${RTTS:-0}"
read -r -a CONFIGS <<< "${CONFIGS:-bridge bridge_veth}"
cd "$REPO"; mkdir -p results
log(){ echo "[R $(date +%H:%M:%S)] $*"; }

# Auto-detect the fabric_test bridge interface (br-<id>)
BRID=$(docker network inspect fabric_test -f '{{.Id}}' 2>/dev/null | cut -c1-12)
BRIDGE="br-${BRID}"
ip link show "$BRIDGE" >/dev/null 2>&1 || { log "FATAL: bridge $BRIDGE not found"; exit 1; }
log "fabric bridge = $BRIDGE"

orderer_veths(){
  local c iflink f n
  for c in orderer1.pangochain.com orderer2.pangochain.com orderer3.pangochain.com; do
    iflink=$(docker exec "$c" cat /sys/class/net/eth0/iflink 2>/dev/null | tr -d '\r')
    for f in /sys/class/net/*/ifindex; do n=$(cat "$f"); [ "$n" = "$iflink" ] && basename "$(dirname "$f")"; done
  done
}
VETHS=($(orderer_veths)); log "orderer veths: ${VETHS[*]}"

clear_netem(){
  sudo -n tc qdisc del dev "$BRIDGE" root 2>/dev/null || true
  for v in "${VETHS[@]}"; do sudo -n tc qdisc del dev "$v" root 2>/dev/null || true; done
}
apply_netem(){  # apply_netem <config> <rtt_ms>
  local cfg=$1 rtt=$2
  clear_netem
  sudo -n tc qdisc add dev "$BRIDGE" root netem delay "${rtt}ms"
  if [ "$cfg" = "bridge_veth" ]; then
    for v in "${VETHS[@]}"; do sudo -n tc qdisc add dev "$v" root netem delay "${rtt}ms"; done
  fi
  sleep 2
}
refresh_jwt(){ local OUT; OUT=$(python3 experiments/setup-bench-data.py 2>/tmp/r_setup.err) || { cat /tmp/r_setup.err; return 1; }; eval "$OUT"; export PANGOCHAIN_JWT_TOKEN PANGOCHAIN_TEST_CASE_ID PANGOCHAIN_TEST_DOC_ID; [ -n "${PANGOCHAIN_JWT_TOKEN:-}" ]; }

trap clear_netem EXIT
[ -f "$CSV" ] || echo "rtt_ms,config,trial,tps,p50_ms,p95_ms,errors,method,platform" > "$CSV"

log "=== TASK R: configs=(${CONFIGS[*]}) rtts=(${RTTS[*]}) reps=$REPS SWEEP=$SWEEP ==="
for cfg in "${CONFIGS[@]}"; do
  for rtt in "${RTTS[@]}"; do
    log "--- config=$cfg rtt=${rtt}ms ---"
    apply_netem "$cfg" "$rtt"
    SHOW=$(sudo -n tc qdisc show dev "$BRIDGE" | tr -d '\n'); log "  bridge qdisc: $SHOW"
    refresh_jwt || { log "JWT failed"; continue; }
    for r in $(seq 1 "$REPS"); do
      OUT=$(node "$WANTOOL" 2>&1) || true
      TPS=$(grep -oP 'TPS=\K[0-9.]+' <<<"$OUT"|head -1); P50=$(grep -oP 'P50=\K[0-9]+' <<<"$OUT"|head -1)
      P95=$(grep -oP 'P95=\K[0-9]+' <<<"$OUT"|head -1); ERR=$(grep -oP 'errors=\K[0-9]+' <<<"$OUT"|head -1)
      echo "${rtt},${cfg},${r},${TPS:-0},${P50:-NA},${P95:-NA},${ERR:-NA},gateway,linux_x86_64" >> "$CSV"
      log "  run $r: TPS=${TPS:-NA} P50=${P50:-NA} P95=${P95:-NA} err=${ERR:-NA}"
    done
  done
done
clear_netem
log "=== TASK R done -> $CSV ==="
# quick 0ms gap summary
python3 - "$CSV" <<'PY'
import csv,sys,statistics
rows=[r for r in csv.DictReader(open(sys.argv[1])) if r['rtt_ms']=='0']
by={}
for r in rows: by.setdefault(r['config'],[]).append(float(r['tps']))
for c,v in by.items(): print(f"0ms {c}: mean_tps={statistics.mean(v):.2f} n={len(v)} raw={v}")
PY

#!/usr/bin/env bash
# TASK W — Full WAN RTT sweep with the CANONICAL duration60s tool (pangochain-loadtest-configurable.js).
# Both netem configs (bridge, bridge_veth) at RTT {0,50,100,150} ms, 200 clients, 5 reps each,
# ONE session back-to-back. OVERWRITES results/exp5_wan.csv with the full 8-point sweep.
set -uo pipefail
REPO=/home/angkon/Pangochain_AOOP
CSV=$REPO/results/exp5_wan.csv
TOOL=$REPO/experiments/caliper/pangochain-loadtest-configurable.js
CONC=${CONC:-200}; DUR=${DUR:-60}; REPS=${REPS:-5}
read -r -a RTTS <<< "${RTTS:-0 50 100 150}"
read -r -a CONFIGS <<< "${CONFIGS:-bridge bridge_veth}"
cd "$REPO"; mkdir -p results
log(){ echo "[W $(date +%H:%M:%S)] $*"; }

BRID=$(docker network inspect fabric_test -f '{{.Id}}' 2>/dev/null | cut -c1-12)
BRIDGE="br-${BRID}"
ip link show "$BRIDGE" >/dev/null 2>&1 || { log "FATAL: bridge $BRIDGE not found"; exit 1; }
log "fabric bridge = $BRIDGE  tool=duration60s conc=$CONC dur=${DUR}s reps=$REPS"

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
refresh_jwt(){ local OUT; OUT=$(python3 experiments/setup-bench-data.py 2>/tmp/w_setup.err) || { cat /tmp/w_setup.err; return 1; }; eval "$OUT"; export PANGOCHAIN_JWT_TOKEN PANGOCHAIN_TEST_CASE_ID PANGOCHAIN_TEST_DOC_ID; [ -n "${PANGOCHAIN_JWT_TOKEN:-}" ]; }

trap clear_netem EXIT
# OVERWRITE with the full sweep
echo "rtt_ms,config,tool,trial,tps,p50_ms,p95_ms,errors,method,platform" > "$CSV"

log "=== TASK W: configs=(${CONFIGS[*]}) rtts=(${RTTS[*]}) reps=$REPS ==="
for cfg in "${CONFIGS[@]}"; do
  for rtt in "${RTTS[@]}"; do
    log "--- config=$cfg rtt=${rtt}ms ---"
    apply_netem "$cfg" "$rtt"
    SHOW=$(sudo -n tc qdisc show dev "$BRIDGE" | tr -d '\n'); log "  bridge qdisc: $SHOW"
    refresh_jwt || { log "JWT failed"; continue; }
    for r in $(seq 1 "$REPS"); do
      OUT=$(PANGOCHAIN_CONCURRENCY=$CONC PANGOCHAIN_DURATION_SEC=$DUR node "$TOOL" 2>&1) || true
      TPS=$(grep -oP 'TPS=\K[0-9.]+' <<<"$OUT"|head -1); P50=$(grep -oP 'P50=\K[0-9]+' <<<"$OUT"|head -1)
      P95=$(grep -oP 'P95=\K[0-9]+' <<<"$OUT"|head -1); ERR=$(grep -oP 'errors=\K[0-9]+' <<<"$OUT"|head -1)
      echo "${rtt},${cfg},duration60s,${r},${TPS:-0},${P50:-NA},${P95:-NA},${ERR:-NA},gateway,linux_x86_64" >> "$CSV"
      log "  run $r: TPS=${TPS:-NA} P50=${P50:-NA} P95=${P95:-NA} err=${ERR:-NA}"
    done
  done
done
clear_netem
log "=== TASK W done -> $CSV ==="
python3 - "$CSV" <<'PY'
import csv,sys,statistics
rows=list(csv.DictReader(open(sys.argv[1])))
by={}
for r in rows: by.setdefault((r['config'],r['rtt_ms']),[]).append(float(r['tps']))
for k in sorted(by): print(f"  {k[0]} rtt={k[1]}ms: mean_tps={statistics.mean(by[k]):.2f} n={len(by[k])}")
err=sum(int(r['errors']) for r in rows if r['errors'] not in ('NA',''))
print(f"  TOTAL errors across sweep: {err}")
PY

#!/usr/bin/env bash
# Experiment 10 — IPFS storage/retrieval cost (IMPROVEMENTS.md item 3.4).
# Brings up a 3-node Kubo topology, wires direct swarm connections, runs
# bench.py, and renders fig10_ipfs_cost.{png,pdf}.
#
#   bash experiments/ipfs_cost/run.sh                 # full run
#   bash experiments/ipfs_cost/run.sh --teardown      # restore node config, stop ipfs3
#
# Overrides: PANGOCHAIN_IPFS_SIZES=1,10,25,50 PANGOCHAIN_IPFS_CONC=1,8,24
#            PANGOCHAIN_IPFS_REPS=24 PANGOCHAIN_IPFS_PHASES=retrieval,... etc.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
EXP_DIR="$ROOT_DIR/experiments/ipfs_cost"
STAMP="$(date -u +%Y%m%d_%H%M%S)"
OUT_DIR="${PANGOCHAIN_IPFS_OUTPUT_DIR:-$EXP_DIR/results/$STAMP}"
NODES=(pangochain-ipfs pangochain-ipfs2 pangochain-ipfs3)
APIS=(http://localhost:5001 http://localhost:5002 http://localhost:5003)
PYTHON="${PANGOCHAIN_PYTHON:-$([[ -x "$ROOT_DIR/experiments/.venv/bin/python" ]] && echo "$ROOT_DIR/experiments/.venv/bin/python" || echo python3)}"

log(){ printf '[ipfs-cost %s] %s\n' "$(date -u +%H:%M:%S)" "$*"; }
compose(){
  if docker compose version >/dev/null 2>&1; then docker compose "$@";
  elif command -v docker-compose >/dev/null 2>&1; then docker-compose "$@";
  else echo "Docker Compose not found" >&2; exit 1; fi
}
pango_net(){ docker network ls --format '{{.Name}}' | grep pangochain-net | head -1; }

restore_filters(){
  for n in "${NODES[@]}"; do
    local snap="$EXP_DIR/.addrfilters-$n.json"
    if [[ -f "$snap" ]] && docker ps --format '{{.Names}}' | grep -qx "$n"; then
      log "restoring Swarm.AddrFilters on $n"
      docker exec -i "$n" ipfs config --json Swarm.AddrFilters "$(cat "$snap")"
      docker exec "$n" ipfs config --json Discovery.MDNS.Enabled false
    fi
  done
  docker restart pangochain-ipfs pangochain-ipfs2 >/dev/null 2>&1 || true
}

if [[ "${1:-}" == "--teardown" ]]; then
  restore_filters
  log "stopping third bench node (data volume kept; add -v to remove)"
  PANGO_NET="$(pango_net)" compose -f "$EXP_DIR/docker-compose.ipfs3.yml" down
  exit 0
fi

mkdir -p "$OUT_DIR"
LOG="$OUT_DIR/run.log"
exec > >(tee -a "$LOG") 2>&1

log "output directory: $OUT_DIR"
log "starting IPFS nodes 1+2 (app compose) and node 3 (bench overlay)"
(cd "$ROOT_DIR" && compose up ipfs ipfs2 -d)
PANGO_NET="$(pango_net)" compose -f "$EXP_DIR/docker-compose.ipfs3.yml" up -d

for n in "${NODES[@]}"; do
  for _ in $(seq 1 30); do
    docker ps --format '{{.Names}}\t{{.Status}}' | grep "$n" | grep -q healthy && break
    sleep 2
  done
done

# The kubo 'server' profile filters private address ranges, which blocks
# direct dialing across the docker bridge (nodes would fall back to public
# relays and corrupt latency numbers). Snapshot the original filters once,
# then clear them for the benchmark. `run.sh --teardown` restores them.
NEED_RESTART=0
for n in "${NODES[@]}"; do
  snap="$EXP_DIR/.addrfilters-$n.json"
  cur="$(docker exec "$n" ipfs config Swarm.AddrFilters)"
  if [[ "$cur" != "[]" && "$cur" != "null" ]]; then
    [[ -f "$snap" ]] || printf '%s' "$cur" > "$snap"
    log "clearing Swarm.AddrFilters on $n (snapshot: $snap)"
    docker exec "$n" ipfs config --json Swarm.AddrFilters '[]'
    docker exec "$n" ipfs config --json Discovery.MDNS.Enabled true
    NEED_RESTART=1
  fi
done
if [[ "$NEED_RESTART" == "1" ]]; then
  docker restart "${NODES[@]}" >/dev/null
  for _ in $(seq 1 30); do
    [[ "$(docker ps --format '{{.Names}}\t{{.Status}}' | grep -c 'pangochain-ipfs.*healthy')" == "3" ]] && break
    sleep 2
  done
fi

log "wiring direct swarm connections"
for target in pangochain-ipfs pangochain-ipfs2; do
  ID="$(docker exec "$target" ipfs id -f '<id>')"
  IP="$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "$target")"
  for api in "${APIS[@]:1}"; do
    curl -sf -X POST "$api/api/v0/swarm/connect?arg=/ip4/$IP/tcp/4001/p2p/$ID" >/dev/null || true
  done
done
ID3="$(docker exec pangochain-ipfs3 ipfs id -f '<id>')"
IP3="$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' pangochain-ipfs3)"
curl -sf -X POST "${APIS[0]}/api/v0/swarm/connect?arg=/ip4/$IP3/tcp/4001/p2p/$ID3" >/dev/null || true

log "running benchmark"
"$PYTHON" "$EXP_DIR/bench.py" \
  --out "$OUT_DIR" \
  --phases "${PANGOCHAIN_IPFS_PHASES:-retrieval,replication,storage,nodedown}" \
  --sizes "${PANGOCHAIN_IPFS_SIZES:-1,10,25,50}" \
  --concurrency "${PANGOCHAIN_IPFS_CONC:-1,8,24}" \
  --reps "${PANGOCHAIN_IPFS_REPS:-24}" \
  --repl-reps "${PANGOCHAIN_IPFS_REPL_REPS:-5}" \
  --nodedown-size "${PANGOCHAIN_IPFS_NODEDOWN_SIZE:-10}" \
  --nodedown-reps "${PANGOCHAIN_IPFS_NODEDOWN_REPS:-10}"

log "rendering figure"
"$PYTHON" "$EXP_DIR/plot.py" "$OUT_DIR" || log "plot generation skipped/failed"

log "done: $OUT_DIR"

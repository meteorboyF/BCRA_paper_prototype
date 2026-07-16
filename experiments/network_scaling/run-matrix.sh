#!/usr/bin/env bash
# Experiment 13 — network-size scaling matrix (IMPROVEMENTS.md item 3.2).
#
#   bash experiments/network_scaling/run-matrix.sh                # default 9-point matrix
#   PANGOCHAIN_NS_POINTS="2x1:majority 3x1:single" bash ...       # custom points
#
# Point syntax: <orgs>x<peers>:<policy>  (policy = majority | single)
# Each point: teardown -> generate -> up -> deploy cc -> bench -> teardown.
# WARNING: tears down ANY running Fabric network (including pangochain-fabric's).
set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
EXP_DIR="$ROOT_DIR/experiments/network_scaling"
STAMP="$(date -u +%Y%m%d_%H%M%S)"
OUT_DIR="${PANGOCHAIN_NS_OUTPUT_DIR:-$EXP_DIR/results/$STAMP}"
POINTS="${PANGOCHAIN_NS_POINTS:-2x1:single 2x1:majority 3x1:single 3x1:majority 3x2:majority 5x1:single 5x1:majority 7x1:single 7x1:majority}"
WRITE_CONC="${PANGOCHAIN_NS_WRITE_CONC:-100}"
WRITE_TX="${PANGOCHAIN_NS_WRITE_TX:-2000}"
PYTHON="${PANGOCHAIN_PYTHON:-$([[ -x "$ROOT_DIR/experiments/.venv/bin/python" ]] && echo "$ROOT_DIR/experiments/.venv/bin/python" || echo python3)}"

mkdir -p "$OUT_DIR"
LOG="$OUT_DIR/run.log"
exec > >(tee -a "$LOG") 2>&1
log(){ printf '[netscale %s] %s\n' "$(date -u +%H:%M:%S)" "$*"; }

teardown_all(){
  # any generated point network
  for d in "$EXP_DIR"/generated/*/; do
    [[ -f "$d/docker-compose.yml" ]] && bash "$EXP_DIR/net.sh" down "$d" >/dev/null 2>&1 || true
  done
  # the original 3-org app network, if present
  if docker ps -a --format '{{.Names}}' | grep -q 'peer0.firma.pangochain.com'; then
    log "tearing down pangochain-fabric app network"
    (cd "$ROOT_DIR/pangochain-fabric" && docker compose -f docker-compose.fabric.yml down -v --remove-orphans) >/dev/null 2>&1 || true
  fi
  docker rm -f legalcc fabric-cli 2>/dev/null || true
  docker network rm fabric_test 2>/dev/null || true
}

if [[ ! -d "$EXP_DIR/node_modules/@hyperledger/fabric-gateway" ]]; then
  log "installing fabric-gateway SDK"
  (cd "$EXP_DIR" && npm install)
fi

docker image inspect pangochain/legalcc:latest >/dev/null 2>&1 || {
  log "building legalcc image once"
  docker build -t pangochain/legalcc:latest "$ROOT_DIR/pangochain-chaincode/legalcc"
}

log "matrix points: $POINTS"
log "output: $OUT_DIR"

for POINT in $POINTS; do
  ORGS="${POINT%%x*}"; REST="${POINT#*x}"
  PEERS="${REST%%:*}"; POLICY="${REST#*:}"
  LABEL="o${ORGS}p${PEERS}-${POLICY}"
  TOPO_DIR="$EXP_DIR/generated/o${ORGS}p${PEERS}"
  log "=== point $LABEL (orgs=$ORGS peers=$PEERS policy=$POLICY) ==="
  free -m | awk 'NR==2{printf "[netscale] mem available: %d MiB\n", $7}'

  teardown_all
  "$PYTHON" "$EXP_DIR/gen-topology.py" --orgs "$ORGS" --peers "$PEERS" || { log "SKIP $LABEL: generation failed"; continue; }

  if ! bash "$EXP_DIR/net.sh" up "$TOPO_DIR"; then
    log "SKIP $LABEL: network up failed (likely RAM); recording skip"
    echo "$LABEL,$ORGS,$PEERS,$POLICY,skipped_network_up" >> "$OUT_DIR/skipped.csv"
    teardown_all
    continue
  fi
  if ! bash "$EXP_DIR/net.sh" cc "$TOPO_DIR" "$POLICY"; then
    log "SKIP $LABEL: chaincode deploy failed"
    echo "$LABEL,$ORGS,$PEERS,$POLICY,skipped_cc_deploy" >> "$OUT_DIR/skipped.csv"
    teardown_all
    continue
  fi

  log "syncing org1 admin identity for gateway client"
  mkdir -p "$EXP_DIR/crypto"
  CLI_CRYPTO="/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/org1.pangochain.com"
  docker exec fabric-cli cat "$CLI_CRYPTO/users/Admin@org1.pangochain.com/msp/signcerts/Admin@org1.pangochain.com-cert.pem" > "$EXP_DIR/crypto/admin-cert.pem"
  docker exec fabric-cli cat "$CLI_CRYPTO/users/Admin@org1.pangochain.com/msp/keystore/priv_sk" > "$EXP_DIR/crypto/admin-key.pem"
  docker exec fabric-cli cat "$CLI_CRYPTO/tlsca/tlsca.org1.pangochain.com-cert.pem" > "$EXP_DIR/crypto/tlsca-cert.pem"
  chmod 600 "$EXP_DIR/crypto/admin-key.pem"

  # resource snapshot while network is up
  docker stats --no-stream --format '{{.Name}},{{.MemUsage}},{{.CPUPerc}}' \
    | grep -E 'peer|orderer|couchdb|legalcc' > "$OUT_DIR/stats_$LABEL.csv" || true

  log "benchmarking $LABEL"
  if ! node "$EXP_DIR/bench.js" --label "$LABEL" --orgs "$ORGS" --peers "$PEERS" \
      --policy "$POLICY" --out "$OUT_DIR" --write-conc "$WRITE_CONC" --write-tx "$WRITE_TX"; then
    log "SKIP $LABEL: bench failed"
    echo "$LABEL,$ORGS,$PEERS,$POLICY,skipped_bench" >> "$OUT_DIR/skipped.csv"
  fi
  teardown_all
done

log "rendering figure"
"$PYTHON" "$EXP_DIR/plot.py" "$OUT_DIR" || log "plot skipped/failed"

{
  echo "{"
  echo "  \"os\": \"$(uname -a | sed 's/"/\\"/g')\","
  echo "  \"node_version\": \"$(node --version)\","
  echo "  \"docker_version\": \"$(docker --version | sed 's/"/\\"/g')\","
  echo "  \"git_commit\": \"$(cd "$ROOT_DIR" && git rev-parse HEAD)\","
  echo "  \"branch\": \"$(cd "$ROOT_DIR" && git rev-parse --abbrev-ref HEAD)\","
  echo "  \"write_conc\": $WRITE_CONC, \"write_tx\": $WRITE_TX,"
  echo "  \"points\": \"$POINTS\","
  echo "  \"notes\": \"3 Raft orderers + CouchDB per peer in every topology; no CAs; gateway client on peer0.org1\""
  echo "}"
} > "$OUT_DIR/environment.json"

log "done: $OUT_DIR"

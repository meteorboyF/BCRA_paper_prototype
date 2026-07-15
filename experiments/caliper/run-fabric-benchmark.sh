#!/usr/bin/env bash
# Experiment 11 — Hyperledger Caliper benchmark, direct Fabric SUT
# (IMPROVEMENTS.md item 3.1).
#
#   bash experiments/caliper/run-fabric-benchmark.sh
#
# Requires the 3-org Fabric network + legalcc (starts them if absent).
# Note: run-experiments.sh (REST-mode Caliper) is the older approach kept
# for reference; this script benchmarks the chaincode directly through the
# peer-gateway API for comparability with other papers' Caliper numbers.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
EXP_DIR="$ROOT_DIR/experiments/caliper"
STAMP="$(date -u +%Y%m%d_%H%M%S)"
OUT_DIR="${PANGOCHAIN_CALIPER_OUTPUT_DIR:-$EXP_DIR/results/$STAMP}"
# Caliper resolves the report path against its workspace — keep OUT_DIR absolute.
[[ "$OUT_DIR" = /* ]] || OUT_DIR="$(pwd)/$OUT_DIR"
BENCH_CONFIG="${PANGOCHAIN_CALIPER_BENCHCONFIG:-fabric-direct-benchmark.yaml}"
PYTHON="${PANGOCHAIN_PYTHON:-$([[ -x "$ROOT_DIR/experiments/.venv/bin/python" ]] && echo "$ROOT_DIR/experiments/.venv/bin/python" || echo python3)}"

log(){ printf '[caliper %s] %s\n' "$(date -u +%H:%M:%S)" "$*"; }

if ! docker ps --format '{{.Names}}' | grep -qx 'fabric-cli'; then
  log "Fabric network not detected; starting it"
  (cd "$ROOT_DIR/pangochain-fabric" && make up && make chaincode)
fi

mkdir -p "$OUT_DIR"
LOG="$OUT_DIR/run.log"
exec > >(tee -a "$LOG") 2>&1

# crypto-config on disk is root-owned (generated inside a root container), so
# copy the identity material out through the fabric-cli container — same
# pattern as fail_closed_outage/run.sh.
FABRIC_CLI_CRYPTO="/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/firma.pangochain.com"
mkdir -p "$EXP_DIR/crypto"
log "syncing FirmA admin identity + TLS CA from fabric-cli container"
docker exec fabric-cli cat "$FABRIC_CLI_CRYPTO/users/Admin@firma.pangochain.com/msp/signcerts/Admin@firma.pangochain.com-cert.pem" \
  > "$EXP_DIR/crypto/admin-cert.pem"
docker exec fabric-cli cat "$FABRIC_CLI_CRYPTO/users/Admin@firma.pangochain.com/msp/keystore/priv_sk" \
  > "$EXP_DIR/crypto/admin-key.pem"
docker exec fabric-cli cat "$FABRIC_CLI_CRYPTO/tlsca/tlsca.firma.pangochain.com-cert.pem" \
  > "$EXP_DIR/crypto/tlsca-cert.pem"
chmod 600 "$EXP_DIR/crypto/admin-key.pem"

cd "$EXP_DIR"
if [[ ! -d node_modules/@hyperledger/caliper-cli ]]; then
  log "installing caliper-cli"
  npm install
fi
if [[ ! -d node_modules/@hyperledger/caliper-fabric ]]; then
  log "binding fabric-gateway SUT"
  npx caliper bind --caliper-bind-sut fabric:fabric-gateway
fi

log "launching Caliper manager (config: $BENCH_CONFIG)"
npx caliper launch manager \
  --caliper-workspace . \
  --caliper-networkconfig networks/fabric-gateway.yaml \
  --caliper-benchconfig "$BENCH_CONFIG" \
  --caliper-report-path "$OUT_DIR/report.html" \
  --caliper-flow-only-test

log "parsing results"
"$PYTHON" "$EXP_DIR/parse-report.py" "$LOG" "$OUT_DIR/caliper_rounds.csv"

log "rendering figure"
"$PYTHON" "$EXP_DIR/plot-caliper.py" "$OUT_DIR" || log "plot skipped/failed"

{
  echo "{"
  echo "  \"os\": \"$(uname -a | sed 's/"/\\"/g')\","
  echo "  \"node_version\": \"$(node --version)\","
  echo "  \"caliper\": \"$(npx caliper --version 2>/dev/null | tail -1)\","
  echo "  \"docker_version\": \"$(docker --version | sed 's/"/\\"/g')\","
  echo "  \"git_commit\": \"$(cd "$ROOT_DIR" && git rev-parse HEAD)\","
  echo "  \"branch\": \"$(cd "$ROOT_DIR" && git rev-parse --abbrev-ref HEAD)\","
  echo "  \"topology\": \"3 orgs x 1 peer, 3 Raft orderers, CouchDB, majority endorsement\","
  echo "  \"sut\": \"legalcc via peer-gateway (grpcs://localhost:7051)\""
  echo "}"
} > "$OUT_DIR/environment.json"

log "done: $OUT_DIR"

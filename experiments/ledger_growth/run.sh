#!/usr/bin/env bash
# Experiment 12 — document-volume / ledger-growth scaling
# (IMPROVEMENTS.md item 3.3).
#
#   bash experiments/ledger_growth/run.sh --fresh              # reset ledger, checkpoints 10^4,10^5
#   bash experiments/ledger_growth/run.sh --checkpoint 1000000 # continue to 10^6 (overnight)
#
# Each checkpoint: preload RegisterDocument to the cumulative count, then
# measure CheckAccess + GetDocumentHistory latency (n=100 each) and capture
# peer block-store / CouchDB disk usage. All checkpoints of one campaign
# append to the same CSVs (results dir is stable per campaign, tracked in
# .state.json), so the 10^6 continuation lands in the same files.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
EXP_DIR="$ROOT_DIR/experiments/ledger_growth"
PYTHON="${PANGOCHAIN_PYTHON:-$([[ -x "$ROOT_DIR/experiments/.venv/bin/python" ]] && echo "$ROOT_DIR/experiments/.venv/bin/python" || echo python3)}"
PEER_CONTAINER="peer0.firma.pangochain.com"
COUCH_CONTAINER="couchdb.firma"
SAMPLES="${PANGOCHAIN_LG_SAMPLES:-100}"
CONCURRENCY="${PANGOCHAIN_LG_CONCURRENCY:-200}"

FRESH=0
CHECKPOINTS="10000,100000"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --fresh) FRESH=1; shift ;;
    --checkpoint|--checkpoints) CHECKPOINTS="$2"; shift 2 ;;
    *) echo "unknown flag: $1" >&2; exit 1 ;;
  esac
done

log(){ printf '[ledger-growth %s] %s\n' "$(date -u +%H:%M:%S)" "$*"; }

if [[ "$FRESH" == "1" ]]; then
  log "FRESH RUN: resetting Fabric network (wipes ledger + previous state)"
  rm -f "$EXP_DIR/.state.json"
  (cd "$ROOT_DIR/pangochain-fabric" && make up && make chaincode)
elif ! docker ps --format '{{.Names}}' | grep -qx 'fabric-cli'; then
  log "Fabric network not detected; starting it"
  (cd "$ROOT_DIR/pangochain-fabric" && make up && make chaincode)
fi

# Stable output dir per campaign so later checkpoints append to the same CSVs.
if [[ -f "$EXP_DIR/.state.json" ]] && grep -q '"out"' "$EXP_DIR/.state.json"; then
  OUT_DIR="$(grep -o '"out": *"[^"]*"' "$EXP_DIR/.state.json" | sed 's/.*"out": *"\([^"]*\)".*/\1/')"
else
  OUT_DIR="$EXP_DIR/results/$(date -u +%Y%m%d_%H%M%S)"
fi
mkdir -p "$OUT_DIR"
LOG="$OUT_DIR/run.log"
exec > >(tee -a "$LOG") 2>&1
log "campaign output directory: $OUT_DIR"

if [[ ! -d "$EXP_DIR/node_modules/@hyperledger/fabric-gateway" ]]; then
  log "installing fabric-gateway SDK"
  (cd "$EXP_DIR" && npm install)
fi

FABRIC_CLI_CRYPTO="/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/firma.pangochain.com"
mkdir -p "$EXP_DIR/crypto"
log "syncing FirmA admin identity + TLS CA from fabric-cli container"
docker exec fabric-cli cat "$FABRIC_CLI_CRYPTO/users/Admin@firma.pangochain.com/msp/signcerts/Admin@firma.pangochain.com-cert.pem" > "$EXP_DIR/crypto/admin-cert.pem"
docker exec fabric-cli cat "$FABRIC_CLI_CRYPTO/users/Admin@firma.pangochain.com/msp/keystore/priv_sk" > "$EXP_DIR/crypto/admin-key.pem"
docker exec fabric-cli cat "$FABRIC_CLI_CRYPTO/tlsca/tlsca.firma.pangochain.com-cert.pem" > "$EXP_DIR/crypto/tlsca-cert.pem"
chmod 600 "$EXP_DIR/crypto/admin-key.pem"

disk_row(){  # $1 = checkpoint count
  local prod chains couch height
  prod="$(docker exec "$PEER_CONTAINER" du -sb /var/hyperledger/production | cut -f1)"
  chains="$(docker exec "$PEER_CONTAINER" du -sb /var/hyperledger/production/ledgersData/chains | cut -f1)"
  couch="$(docker exec "$COUCH_CONTAINER" du -sb /opt/couchdb/data | cut -f1)"
  height="$(docker exec fabric-cli peer channel getinfo -c legal-channel 2>/dev/null \
    | grep -o '"height":[0-9]*' | cut -d: -f2 || echo '')"
  if [[ ! -f "$OUT_DIR/disk.csv" ]]; then
    echo "checkpoint,block_height,peer_production_bytes,blockstore_bytes,couchdb_bytes" > "$OUT_DIR/disk.csv"
  fi
  echo "$1,$height,$prod,$chains,$couch" >> "$OUT_DIR/disk.csv"
  log "disk @ $1 docs: height=$height production=$prod blockstore=$chains couchdb=$couch"
}

log "baseline disk measurement (before preload)"
CURRENT="$(grep -o '"next": *[0-9]*' "$EXP_DIR/.state.json" 2>/dev/null | grep -o '[0-9]*' || echo 0)"
[[ "$CURRENT" == "0" ]] && disk_row 0

IFS=',' read -ra CPS <<< "$CHECKPOINTS"
for CP in "${CPS[@]}"; do
  log "=== checkpoint $CP: preloading ==="
  node "$EXP_DIR/preload.js" --target "$CP" --concurrency "$CONCURRENCY"
  # record campaign output dir in state so continuations append here
  "$PYTHON" - "$EXP_DIR/.state.json" "$OUT_DIR" <<'PYEOF'
import json, sys
p, out = sys.argv[1], sys.argv[2]
s = json.load(open(p)); s["out"] = out
json.dump(s, open(p, "w"))
PYEOF
  log "=== checkpoint $CP: measuring latency (n=$SAMPLES per function) ==="
  node "$EXP_DIR/measure.js" --checkpoint "$CP" --out "$OUT_DIR" --samples "$SAMPLES"
  disk_row "$CP"
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
  echo "  \"topology\": \"3 orgs x 1 peer, 3 Raft orderers, CouchDB, majority endorsement\","
  echo "  \"samples_per_function\": $SAMPLES,"
  echo "  \"preload_concurrency\": $CONCURRENCY"
  echo "}"
} > "$OUT_DIR/environment.json"

log "done: $OUT_DIR"

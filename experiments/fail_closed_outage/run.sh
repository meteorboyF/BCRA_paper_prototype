#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
EXP_DIR="$ROOT_DIR/experiments/fail_closed_outage"
STAMP="$(date -u +%Y%m%d_%H%M%S)"
OUT_DIR="${PANGOCHAIN_FAILCLOSED_OUTPUT_DIR:-$EXP_DIR/results/$STAMP}"
PRE="${PANGOCHAIN_PRE_OUTAGE_SECONDS:-30}"
OUTAGE="${PANGOCHAIN_OUTAGE_SECONDS:-45}"
POST="${PANGOCHAIN_POST_RECOVERY_SECONDS:-60}"
CONC="${PANGOCHAIN_CONCURRENCY:-50}"
BACKEND_PORT="${PANGOCHAIN_BACKEND_PORT:-8080}"
FORCE_BACKEND_RESTART="${PANGOCHAIN_FORCE_BACKEND_RESTART:-0}"
PG_CONTAINER="${PANGOCHAIN_POSTGRES_CONTAINER:-pangochain-postgres}"
PEERS=(${PANGOCHAIN_FABRIC_PEERS:-peer0.firma.pangochain.com peer0.firmb.pangochain.com peer0.regulator.pangochain.com})
BACKEND_PID_FILE="$ROOT_DIR/.pango-dev/backend.pid"
BACKEND_CRYPTO_DIR="$ROOT_DIR/pangochain-backend/config/fabric/crypto"
FABRIC_CLI_CRYPTO="/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/firma.pangochain.com"

mkdir -p "$OUT_DIR"
LOG="$OUT_DIR/run.log"
exec > >(tee -a "$LOG") 2>&1

log(){ printf '[fail-closed %s] %s\n' "$(date -u +%H:%M:%S)" "$*"; }
has_cmd(){ command -v "$1" >/dev/null 2>&1; }
compose(){
  if docker compose version >/dev/null 2>&1; then docker compose "$@";
  elif has_cmd docker-compose; then docker-compose "$@";
  else echo "Docker Compose not found" >&2; exit 1; fi
}
pg(){
  docker exec "$PG_CONTAINER" psql -U pangochain -d pangochain -tA -c "$1" 2>/dev/null | tr -d '[:space:]'
}
count_event(){ pg "SELECT count(*) FROM audit_log WHERE event_type='$1';"; }
health_ok(){ curl -fsS "http://localhost:$BACKEND_PORT/actuator/health" >/dev/null 2>&1; }
pid_alive(){ [[ -n "${1:-}" ]] && kill -0 "$1" 2>/dev/null; }
read_pid(){ [[ -f "$BACKEND_PID_FILE" ]] && tr -dc '0-9' < "$BACKEND_PID_FILE" || true; }
stop_backend_if_forced(){
  [[ "$FORCE_BACKEND_RESTART" == "1" ]] || return 0
  local pid
  pid="$(read_pid)"
  if [[ -z "$pid" ]]; then
    pid="$(find "$EXP_DIR/results" -name backend.pid -type f -printf '%T@ %p\n' 2>/dev/null \
      | sort -nr | awk 'NR==1 {print $2}' | xargs -r cat 2>/dev/null | tr -dc '0-9' || true)"
  fi
  if [[ -z "$pid" ]]; then
    pid="$(pgrep -f '[c]om.pangochain.backend.PangochainApplication' | head -1 || true)"
  fi
  if pid_alive "$pid"; then
    log "stopping existing backend PID $pid so experiment uses current code"
    kill "-$pid" 2>/dev/null || kill "$pid" 2>/dev/null || true
    sleep 3
    pid_alive "$pid" && kill -9 "-$pid" 2>/dev/null || true
    pid_alive "$pid" && kill -9 "$pid" 2>/dev/null || true
  fi
  local app_pids
  app_pids="$(pgrep -f '[c]om.pangochain.backend.PangochainApplication|[s]pring-boot:run' || true)"
  if [[ -n "$app_pids" ]]; then
    log "stopping backend process tree: $(echo "$app_pids" | tr '\n' ' ')"
    while read -r p; do [[ -n "$p" ]] && kill "$p" 2>/dev/null || true; done <<< "$app_pids"
    sleep 3
    while read -r p; do [[ -n "$p" ]] && kill -9 "$p" 2>/dev/null || true; done <<< "$app_pids"
  elif health_ok; then
    log "backend is healthy but not owned by .pango-dev/backend.pid; refusing forced restart"
    log "stop the process on :$BACKEND_PORT manually, or run without PANGOCHAIN_FORCE_BACKEND_RESTART"
    exit 4
  fi
  rm -f "$BACKEND_PID_FILE"
}
sync_backend_fabric_crypto(){
  log "syncing backend Fabric crypto from live fabric-cli container"
  mkdir -p "$BACKEND_CRYPTO_DIR"
  docker exec fabric-cli cat "$FABRIC_CLI_CRYPTO/peers/peer0.firma.pangochain.com/tls/ca.crt" \
    > "$BACKEND_CRYPTO_DIR/tls-ca-cert.pem"
  docker exec fabric-cli cat "$FABRIC_CLI_CRYPTO/users/Admin@firma.pangochain.com/msp/signcerts/Admin@firma.pangochain.com-cert.pem" \
    > "$BACKEND_CRYPTO_DIR/admin-cert.pem"
  docker exec fabric-cli cat "$FABRIC_CLI_CRYPTO/users/Admin@firma.pangochain.com/msp/keystore/priv_sk" \
    > "$BACKEND_CRYPTO_DIR/admin-key.pem"
  chmod 600 "$BACKEND_CRYPTO_DIR/admin-key.pem"
}

log "output directory: $OUT_DIR"
log "starting PostgreSQL and IPFS"
(cd "$ROOT_DIR" && compose up postgres ipfs ipfs2 -d)

if ! docker ps --format '{{.Names}}' | grep -qx 'fabric-cli'; then
  log "Fabric containers not detected; starting Fabric network"
  (cd "$ROOT_DIR/pangochain-fabric" && make up && make chaincode && make smoke)
else
  log "Fabric network appears to be running"
fi

sync_backend_fabric_crypto
stop_backend_if_forced
if ! health_ok; then
  log "backend not healthy on :$BACKEND_PORT; starting backend in background"
  (cd "$ROOT_DIR/pangochain-backend" && FABRIC_ENABLED=true ./mvnw spring-boot:run > "$OUT_DIR/backend.log" 2>&1 & echo $! > "$OUT_DIR/backend.pid")
  for _ in $(seq 1 120); do health_ok && break; sleep 1; done
fi
health_ok || { log "backend did not become healthy"; exit 2; }

if [[ -z "${PANGOCHAIN_JWT_TOKEN:-}" || -z "${PANGOCHAIN_TEST_DOC_ID:-}" ]]; then
  log "creating benchmark user/document via experiments/setup-bench-data.py"
  SETUP_OUT="$(cd "$ROOT_DIR" && python3 experiments/setup-bench-data.py)"
  eval "$SETUP_OUT"
  export PANGOCHAIN_JWT_TOKEN PANGOCHAIN_TEST_DOC_ID
fi
log "doc=$PANGOCHAIN_TEST_DOC_ID concurrency=$CONC"

log "sanity check: normal ciphertext request should succeed before outage"
HTTP_CODE="$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $PANGOCHAIN_JWT_TOKEN" "http://localhost:$BACKEND_PORT/api/documents/$PANGOCHAIN_TEST_DOC_ID/ciphertext")"
if [[ "$HTTP_CODE" != "200" ]]; then
  log "pre-outage sanity check returned HTTP $HTTP_CODE, expected 200"
  exit 3
fi

FB_DENIED_0="$(count_event FABRIC_OUTAGE_ACCESS_DENIED || echo 0)"
FB_FALLBACK_0="$(count_event ACL_FABRIC_FALLBACK || echo 0)"
ACCESS_DENIED_0="$(count_event ACCESS_DENIED || echo 0)"
DOWNLOADED_0="$(count_event DOCUMENT_DOWNLOADED || echo 0)"
VIEWED_0="$(count_event DOC_VIEWED || echo 0)"

log "starting load generator"
PANGOCHAIN_OUTPUT_DIR="$OUT_DIR" \
PANGOCHAIN_PRE_OUTAGE_SECONDS="$PRE" \
PANGOCHAIN_OUTAGE_SECONDS="$OUTAGE" \
PANGOCHAIN_POST_RECOVERY_SECONDS="$POST" \
PANGOCHAIN_CONCURRENCY="$CONC" \
PANGOCHAIN_BACKEND_PORT="$BACKEND_PORT" \
node "$EXP_DIR/fail-closed-load.js" > "$OUT_DIR/load.log" 2>&1 &
LOAD_PID=$!

sleep "$PRE"
log "inducing Fabric outage by stopping peers: ${PEERS[*]}"
docker stop "${PEERS[@]}" >/dev/null

sleep "$OUTAGE"
log "restoring Fabric peers"
docker start "${PEERS[@]}" >/dev/null

wait "$LOAD_PID"

FB_DENIED_1="$(count_event FABRIC_OUTAGE_ACCESS_DENIED || echo 0)"
FB_FALLBACK_1="$(count_event ACL_FABRIC_FALLBACK || echo 0)"
ACCESS_DENIED_1="$(count_event ACCESS_DENIED || echo 0)"
DOWNLOADED_1="$(count_event DOCUMENT_DOWNLOADED || echo 0)"
VIEWED_1="$(count_event DOC_VIEWED || echo 0)"

cat > "$OUT_DIR/audit_counts.json" <<JSON
{
  "FABRIC_OUTAGE_ACCESS_DENIED": $((FB_DENIED_1 - FB_DENIED_0)),
  "ACL_FABRIC_FALLBACK": $((FB_FALLBACK_1 - FB_FALLBACK_0)),
  "ACCESS_DENIED": $((ACCESS_DENIED_1 - ACCESS_DENIED_0)),
  "DOCUMENT_DOWNLOADED": $((DOWNLOADED_1 - DOWNLOADED_0)),
  "DOC_VIEWED": $((VIEWED_1 - VIEWED_0))
}
JSON

{
  echo "{"
  echo "  \"os\": \"$(uname -a | sed 's/"/\\"/g')\","
  echo "  \"cpu\": \"$(lscpu 2>/dev/null | awk -F: '/Model name/ {gsub(/^ +/,"",$2); print $2; exit}' | sed 's/"/\\"/g')\","
  echo "  \"java_version\": \"$(java -version 2>&1 | head -1 | sed 's/"/\\"/g')\","
  echo "  \"node_version\": \"$(node --version 2>/dev/null || true)\","
  echo "  \"docker_version\": \"$(docker --version 2>/dev/null | sed 's/"/\\"/g')\","
  echo "  \"git_commit\": \"$(cd "$ROOT_DIR" && git rev-parse HEAD)\","
  echo "  \"branch\": \"$(cd "$ROOT_DIR" && git rev-parse --abbrev-ref HEAD)\","
  echo "  \"backend_port\": \"$BACKEND_PORT\","
  echo "  \"fabric_enabled\": true,"
  echo "  \"fabric_outage_method\": \"docker stop peers: ${PEERS[*]}\""
  echo "}"
} > "$OUT_DIR/environment.json"

python3 "$EXP_DIR/summarize.py" \
  --out "$OUT_DIR" \
  --pre "$PRE" \
  --outage "$OUTAGE" \
  --post "$POST" \
  --concurrency "$CONC" \
  --method "docker stop peers: ${PEERS[*]}"

python3 "$EXP_DIR/plot.py" "$OUT_DIR" || log "plot generation skipped/failed"

cat > "$OUT_DIR/README.md" <<EOF
# Fail-Closed Fabric Outage Run

Generated: $(date -u +%Y-%m-%dT%H:%M:%SZ)

This run measures document ciphertext requests while Fabric peers are stopped.
Expected outage behavior is HTTP 503 denial, zero protected bytes, and
FABRIC_OUTAGE_ACCESS_DENIED audit rows with zero ACL_FABRIC_FALLBACK rows.

Files:
- summary.json
- per_second.csv
- requests.csv
- audit_counts.json
- environment.json
- fig_failclosed_outage.pdf/png, if plotting dependencies are available
EOF

log "done: $OUT_DIR"

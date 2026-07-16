#!/usr/bin/env bash
# Experiment 14 — Fabric-as-passive-audit-log baseline (IMPROVEMENTS.md 3.5a).
# Runs the SAME gateway workload against the backend in two modes:
#   onpath   — default profile: ledger CheckAccess on the release path
#   auditlog — Spring profile "audit-log-only": PostgreSQL ACL decision,
#              async LogAuditEvent anchoring (the design we argue against)
#
#   bash experiments/baseline_auditlog/run.sh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
EXP_DIR="$ROOT_DIR/experiments/baseline_auditlog"
STAMP="$(date -u +%Y%m%d_%H%M%S)"
OUT_DIR="${PANGOCHAIN_BL_OUTPUT_DIR:-$EXP_DIR/results/$STAMP}"
CONCS="${PANGOCHAIN_BL_CONC:-10,50,100,200}"
REQUESTS="${PANGOCHAIN_BL_REQUESTS:-2000}"
PG="pangochain-postgres"
PYTHON="${PANGOCHAIN_PYTHON:-$([[ -x "$ROOT_DIR/experiments/.venv/bin/python" ]] && echo "$ROOT_DIR/experiments/.venv/bin/python" || echo python3)}"
BACKEND_PID=""

mkdir -p "$OUT_DIR"
LOG="$OUT_DIR/run.log"
exec > >(tee -a "$LOG") 2>&1
log(){ printf '[baseline %s] %s\n' "$(date -u +%H:%M:%S)" "$*"; }
health_ok(){ curl -fsS "http://localhost:8080/actuator/health" >/dev/null 2>&1; }
pg_count(){ docker exec "$PG" psql -U pangochain -d pangochain -tA \
  -c "SELECT count(*) FROM audit_log WHERE event_type='$1';" 2>/dev/null | tr -d '[:space:]'; }

stop_backend(){
  # NB: every conditional ends with `|| true` — a bare `[[ ]] &&` as the last
  # statement returns 1 when the test is false, and set -e would silently
  # kill the whole script (this exact bug stalled runs 1 and 2).
  local pids
  pids="$(pgrep -f '[P]angochainApplication|[s]pring-boot:run' || true)"
  if [[ -n "$pids" ]]; then echo "$pids" | xargs -r kill 2>/dev/null || true; sleep 4; fi
  pids="$(pgrep -f '[P]angochainApplication|[s]pring-boot:run' || true)"
  if [[ -n "$pids" ]]; then echo "$pids" | xargs -r kill -9 2>/dev/null || true; sleep 1; fi
  return 0
}
trap stop_backend EXIT

start_backend(){  # $1 = spring profile ("" for default)
  stop_backend
  log "starting backend (profile: ${1:-default})"
  # Source the root .env (DB_PASSWORD etc.) — compose loads it for postgres,
  # but a bare mvnw run would otherwise fall back to application.yml defaults
  # and fail DB auth.
  (cd "$ROOT_DIR/pangochain-backend" && \
    set -a && [[ -f "$ROOT_DIR/.env" ]] && source "$ROOT_DIR/.env"; set +a; \
    FABRIC_ENABLED=true SPRING_PROFILES_ACTIVE="$1" ./mvnw -q spring-boot:run \
    > "$OUT_DIR/backend_${1:-default}.log" 2>&1 &)
  for _ in $(seq 1 180); do health_ok && return 0; sleep 1; done
  log "backend did not become healthy (see backend_${1:-default}.log)"; exit 2
}

# ─── infrastructure ────────────────────────────────────────────────────────────
log "output: $OUT_DIR"
(cd "$ROOT_DIR" && docker compose up postgres ipfs ipfs2 -d)
if ! docker ps --format '{{.Names}}' | grep -qx 'fabric-cli'; then
  log "starting Fabric network + chaincode"
  (cd "$ROOT_DIR/pangochain-fabric" && make up && make chaincode)
fi

log "syncing backend Fabric crypto from fabric-cli"
CRYPTO_DIR="$ROOT_DIR/pangochain-backend/config/fabric/crypto"
CLI_CRYPTO="/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/peerOrganizations/firma.pangochain.com"
mkdir -p "$CRYPTO_DIR"
docker exec fabric-cli cat "$CLI_CRYPTO/peers/peer0.firma.pangochain.com/tls/ca.crt" > "$CRYPTO_DIR/tls-ca-cert.pem"
docker exec fabric-cli cat "$CLI_CRYPTO/users/Admin@firma.pangochain.com/msp/signcerts/Admin@firma.pangochain.com-cert.pem" > "$CRYPTO_DIR/admin-cert.pem"
docker exec fabric-cli cat "$CLI_CRYPTO/users/Admin@firma.pangochain.com/msp/keystore/priv_sk" > "$CRYPTO_DIR/admin-key.pem"
chmod 600 "$CRYPTO_DIR/admin-key.pem"

# ─── mode A: on-path enforcement (default profile) ─────────────────────────────
start_backend ""
log "creating bench user/case/document"
# Firm UUIDs are database-specific seeds; resolve FirmAMSP's actual id.
PANGOCHAIN_FIRM_ID="$(docker exec "$PG" psql -U pangochain -d pangochain -tA \
  -c "SELECT id FROM firms WHERE msp_id='FirmAMSP' LIMIT 1;" | tr -d '[:space:]')"
export PANGOCHAIN_FIRM_ID
log "using firm id $PANGOCHAIN_FIRM_ID (FirmAMSP)"
eval "$(cd "$ROOT_DIR" && python3 experiments/setup-bench-data.py)"
export PANGOCHAIN_JWT_TOKEN PANGOCHAIN_TEST_DOC_ID
HTTP="$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $PANGOCHAIN_JWT_TOKEN" "http://localhost:8080/api/documents/$PANGOCHAIN_TEST_DOC_ID/ciphertext")"
[[ "$HTTP" == "200" ]] || { log "sanity check (onpath) got HTTP $HTTP"; exit 3; }

AUDIT0="$(pg_count ACL_AUDIT_LOG_ONLY || echo 0)"
log "=== mode A: onpath (conc: $CONCS, $REQUESTS req/level) ==="
node "$EXP_DIR/loadgen.js" --mode onpath --out "$OUT_DIR" --conc "$CONCS" --requests "$REQUESTS"
AUDIT_A="$(pg_count ACL_AUDIT_LOG_ONLY || echo 0)"
[[ "$((AUDIT_A - AUDIT0))" == "0" ]] || log "WARN: audit-log-only events fired in onpath mode!"

# ─── mode B: audit-log-only baseline profile ───────────────────────────────────
start_backend "audit-log-only"
HTTP="$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $PANGOCHAIN_JWT_TOKEN" "http://localhost:8080/api/documents/$PANGOCHAIN_TEST_DOC_ID/ciphertext")"
[[ "$HTTP" == "200" ]] || { log "sanity check (auditlog) got HTTP $HTTP"; exit 3; }

log "=== mode B: audit-log-only baseline ==="
node "$EXP_DIR/loadgen.js" --mode auditlog --out "$OUT_DIR" --conc "$CONCS" --requests "$REQUESTS"
sleep 10  # let async audit writers drain
AUDIT_B="$(pg_count ACL_AUDIT_LOG_ONLY || echo 0)"
ANCHORED="$(docker exec "$PG" psql -U pangochain -d pangochain -tA \
  -c "SELECT count(*) FROM audit_log WHERE event_type='ACL_AUDIT_LOG_ONLY' AND fabric_tx_id IS NOT NULL;" | tr -d '[:space:]')"
log "audit-log-only decisions recorded: $((AUDIT_B - AUDIT_A)) (fabric-anchored: $ANCHORED)"

stop_backend

cat > "$OUT_DIR/summary.json" <<JSON
{
  "requests_per_level": $REQUESTS,
  "concurrency_levels": "$CONCS",
  "acl_audit_log_only_rows": $((AUDIT_B - AUDIT_A)),
  "acl_audit_log_only_fabric_anchored": $ANCHORED,
  "onpath_mode_leaked_baseline_events": $((AUDIT_A - AUDIT0))
}
JSON

log "rendering figure"
"$PYTHON" "$EXP_DIR/plot.py" "$OUT_DIR" || log "plot skipped/failed"

{
  echo "{"
  echo "  \"os\": \"$(uname -a | sed 's/"/\\"/g')\","
  echo "  \"java\": \"$(java -version 2>&1 | head -1 | sed 's/"/\\"/g')\","
  echo "  \"node_version\": \"$(node --version)\","
  echo "  \"git_commit\": \"$(cd "$ROOT_DIR" && git rev-parse HEAD)\","
  echo "  \"branch\": \"$(cd "$ROOT_DIR" && git rev-parse --abbrev-ref HEAD)\","
  echo "  \"topology\": \"3 orgs x 1 peer, CouchDB, majority endorsement (reference network)\","
  echo "  \"modes\": \"onpath (default profile) vs auditlog (SPRING_PROFILES_ACTIVE=audit-log-only)\""
  echo "}"
} > "$OUT_DIR/environment.json"

log "done: $OUT_DIR"

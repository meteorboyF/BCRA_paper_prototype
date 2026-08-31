#!/usr/bin/env bash
# Experiment 18 — GRANT-path outage divergence with the durable outbox.
#
# Experiment 16/16b established the revocation half of the write-path asymmetry:
# a revoke issued during an orderer-only outage silently diverged (pre-fix) and is
# now bounded by the pending_anchor outbox (post-fix). grant() retained the original
# fire-and-forget defect — a grant issued during an outage updated the operational
# ACL and was never anchored, so the release path (ledger-gated) kept DENYING the
# legitimate grantee forever. This is the mirror image of the revocation exposure:
# revocation divergence is a CONFIDENTIALITY exposure (revoked user still served),
# grant divergence is an AVAILABILITY exposure (authorized user still refused).
#
# This run measures the grant path after extending the outbox to GrantAccess
# (changeset 029): the grant response is 202/pending during the outage, and once
# ordering recovers the anchor drains unattended, after which the grantee is served.
#
# MODE=grant (default) — sequence per run:
#   0. fixture: fresh doc, NO grant (setup_grant.mjs); grantee download -> expect 403
#   1. stop the three orderers (peers stay up)
#   2. owner GRANTS during outage (submit -> orderer)   -> expect 202, ledgerSyncStatus=pending
#   3. grantee download mid-outage                      -> expect 403 (ledger has no grant)
#   4. grantee wrapped-key mid-outage                   -> expect 403 (same gate)
#   5. ledger CheckAccess + DB row + pending_anchor     -> false / active row / PENDING
#   6. restart orderers; POLL (no manual action) until CheckAccess -> true
#      and pending_anchor -> COMMITTED; record the divergence window from the
#      outbox row's own timestamps (created_at -> committed_at)
#   7. grantee download after reconciliation            -> expect 200
#
# MODE=fifo — intent-order preservation under a mixed queue:
#   grant during outage (202/pending), then revoke during outage (202/pending),
#   restart orderers, verify the worker drains grant BEFORE revoke (creation order),
#   final CheckAccess=false and download 403, and both anchors COMMITTED with
#   grant.committed_at <= revoke.committed_at.
#
# All raw output saved under results/<stamp>/.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
EXP_DIR="$ROOT_DIR/experiments/grant_outage_reconciliation_18"
STAMP="$(date -u +%Y%m%d_%H%M%S)"
MODE="${MODE:-grant}"
OUT_DIR="${PANGOCHAIN_EXP18_OUTPUT_DIR:-$EXP_DIR/results/${MODE}_$STAMP}"

BASE="${API_URL:-http://localhost:8080/api}"
PW="${DEMO_PASSWORD:-Demo2026#Secure}"
PG_CONTAINER="${PANGOCHAIN_POSTGRES_CONTAINER:-pangochain-postgres}"
CLI="${PANGOCHAIN_FABRIC_CLI:-fabric-cli}"
CHANNEL="${PANGOCHAIN_CHANNEL:-legal-channel}"
CC="${PANGOCHAIN_CHAINCODE:-legalcc}"
ORDERERS=(orderer1.pangochain.com orderer2.pangochain.com orderer3.pangochain.com)
POLL_INTERVAL="${PANGOCHAIN_POLL_INTERVAL:-2}"
POLL_TIMEOUT="${PANGOCHAIN_POLL_TIMEOUT:-120}"
SEED_STATE="${PANGOCHAIN_SEED_STATE:-$ROOT_DIR/ui_retake_seed/seed_state.json}"

mkdir -p "$OUT_DIR"
LOG="$OUT_DIR/run.log"
SEQ="$OUT_DIR/sequence.csv"
exec > >(tee -a "$LOG") 2>&1

log(){ printf '[exp18 %s] %s\n' "$(date -u +%H:%M:%S)" "$*"; }
token(){ curl -s -X POST "$BASE/auth/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$1\",\"password\":\"$PW\"}" | python3 -c "import json,sys;print(json.load(sys.stdin)['accessToken'])"; }
http_code(){ curl -s -o /dev/null -w '%{http_code}' "$@"; }
http_body_and_code(){ curl -s -w '\n%{http_code}' "$@"; }
ledger_query(){ docker exec "$CLI" peer chaincode query -C "$CHANNEL" -n "$CC" -c "$1" 2>&1; }
pg(){ docker exec "$PG_CONTAINER" psql -U pangochain -d pangochain -tA -c "$1" 2>/dev/null; }
step(){ printf '%s,"%s","%s"\n' "$1" "$2" "${3//\"/\"\"}" >> "$SEQ"; }

echo "step,description,result" > "$SEQ"
log "mode=$MODE output dir: $OUT_DIR"

# ── environment record ────────────────────────────────────────────────────
{
  echo "{"
  echo "  \"experiment\": \"18 - grant-path outage divergence, durable outbox (mode=$MODE)\","
  echo "  \"timestamp_utc\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\","
  echo "  \"host\": \"$(uname -srm)\","
  echo "  \"docker\": \"$(docker --version 2>/dev/null | sed 's/\"//g')\","
  echo "  \"git_commit\": \"$(git -C "$ROOT_DIR" rev-parse HEAD 2>/dev/null)\","
  echo "  \"channel\": \"$CHANNEL\", \"chaincode\": \"$CC\","
  echo "  \"orderers\": \"${ORDERERS[*]}\","
  echo "  \"poll_interval_s\": $POLL_INTERVAL, \"poll_timeout_s\": $POLL_TIMEOUT,"
  echo "  \"mem_available_kb\": $(awk '/MemAvailable/{print $2}' /proc/meminfo),"
  echo "  \"load_avg\": \"$(cut -d' ' -f1-3 /proc/loadavg)\","
  echo "  \"reference_runs\": \"exp16 (pre-fix revoke), exp16b (post-fix revoke)\""
  echo "}"
} > "$OUT_DIR/environment.json"

# ── fixture: fresh doc, NO grant ──────────────────────────────────────────
log "creating fixture (fresh doc, no grant) via setup_grant.mjs"
FIXTURE_JSON="$(node "$EXP_DIR/setup_grant.mjs" "$SEED_STATE")"
echo "$FIXTURE_JSON" > "$OUT_DIR/fixture.json"
jqf(){ python3 -c "import json;print(json.load(open('$OUT_DIR/fixture.json'))['$1'])"; }
DOC=$(jqf docId); GRANTEE=$(jqf granteeId); GRANTEE_MSP=$(jqf granteeMsp)
GRANTEE_EMAIL=$(jqf granteeEmail); OWNER_EMAIL=$(jqf granterEmail)
WRAPPED=$(jqf wrappedKeyToken)
log "fixture doc=$DOC grantee=$GRANTEE ($GRANTEE_MSP)"

CHECK_ARGS="{\"function\":\"CheckAccess\",\"Args\":[\"$DOC\",\"$GRANTEE\",\"$GRANTEE_MSP\"]}"
TOK_G="$(token "$GRANTEE_EMAIL")"
TOK_O="$(token "$OWNER_EMAIL")"

# ── step 0: baseline — no grant, healthy: download must be 403 ─────────────
C=$(http_code "$BASE/documents/$DOC/ciphertext" -H "Authorization: Bearer $TOK_G")
log "[0] baseline grantee download (healthy, NO grant): HTTP $C"
step 0 "baseline download, no grant (healthy)" "HTTP $C"

# ── step 1: orderer-only outage ────────────────────────────────────────────
log "[1] stopping orderers (peers stay up): ${ORDERERS[*]}"
docker stop "${ORDERERS[@]}" >/dev/null
step 1 "stop orderers (peers up)" "stopped ${ORDERERS[*]}"

# ── step 2: GRANT during outage (submit -> orderer) — durable outbox ───────
GRANT_ISSUED_AT="$(date -u +%s)"
RESP=$(http_body_and_code -X POST "$BASE/access/grant" \
  -H "Authorization: Bearer $TOK_O" -H 'Content-Type: application/json' \
  -d "{\"docId\":\"$DOC\",\"granteeId\":\"$GRANTEE\",\"capability\":\"read\",\"wrappedKeyToken\":\"$WRAPPED\"}")
GBODY=$(echo "$RESP" | head -n -1)
GCODE=$(echo "$RESP" | tail -1)
GSYNC=$(echo "$GBODY" | python3 -c "import json,sys;print(json.load(sys.stdin).get('ledgerSyncStatus'))" 2>/dev/null || echo parse-error)
log "[2] owner grant during outage: HTTP $GCODE ledgerSyncStatus=$GSYNC"
step 2 "grant during outage (durable outbox)" "HTTP $GCODE sync=$GSYNC"
if [[ "$GCODE" != "202" ]]; then
  log "[2] WARNING: expected 202 Accepted (pending) during an orderer outage, got $GCODE"
fi

if [[ "$MODE" == "fifo" ]]; then
  # ── fifo step 2b: REVOKE the same (doc,user) while still mid-outage ──────
  sleep 2
  RESP=$(http_body_and_code -X DELETE "$BASE/access/$DOC/user/$GRANTEE" -H "Authorization: Bearer $TOK_O")
  RCODE=$(echo "$RESP" | tail -1)
  log "[2b] owner revoke during outage (queued behind grant): HTTP $RCODE"
  step 2b "revoke during outage (behind pending grant)" "HTTP $RCODE"
fi

# ── step 3+4: release path mid-outage — availability exposure ──────────────
C=$(http_code "$BASE/documents/$DOC/ciphertext" -H "Authorization: Bearer $TOK_G")
W=$(http_code "$BASE/documents/$DOC/wrapped-key" -H "Authorization: Bearer $TOK_G")
log "[3] grantee download mid-outage (ledger has no grant): HTTP $C"
log "[4] grantee wrapped-key mid-outage: HTTP $W"
step 3 "download mid-outage after grant issued" "HTTP $C"
step 4 "wrapped-key mid-outage after grant issued" "HTTP $W"

# ── step 5: tri-state capture mid-outage ───────────────────────────────────
LQ=$(ledger_query "$CHECK_ARGS" || true)
DBROW=$(pg "SELECT capability, revoked_at IS NULL FROM document_access WHERE doc_id='$DOC' AND user_id='$GRANTEE' ORDER BY granted_at DESC LIMIT 1")
ANCHORS=$(pg "SELECT chaincode_function || ':' || status FROM pending_anchor WHERE doc_id='$DOC' AND target_user_id='$GRANTEE' ORDER BY created_at")
log "[5] mid-outage: ledger CheckAccess='$LQ' dbRow='$DBROW' anchors='$ANCHORS'"
step 5 "tri-state mid-outage (ledger/db/outbox)" "ledger=$LQ db=$DBROW anchors=$ANCHORS"

# ── step 6: restart orderers, NO operator action, poll to convergence ──────
log "[6] restarting orderers; polling with NO operator action"
RESTART_AT="$(date -u +%s)"
docker start "${ORDERERS[@]}" >/dev/null
DEADLINE=$(( $(date -u +%s) + POLL_TIMEOUT ))
CONVERGED=0
if [[ "$MODE" == "fifo" ]]; then TARGET="false"; else TARGET="true"; fi
while (( $(date -u +%s) < DEADLINE )); do
  LQ=$(ledger_query "$CHECK_ARGS" || true)
  PENDING=$(pg "SELECT count(*) FROM pending_anchor WHERE doc_id='$DOC' AND target_user_id='$GRANTEE' AND status='PENDING'")
  if [[ "$LQ" == *"$TARGET"* && "$PENDING" == "0" ]]; then CONVERGED=1; break; fi
  sleep "$POLL_INTERVAL"
done
CONVERGED_AT="$(date -u +%s)"
log "[6] converged=$CONVERGED (ledger CheckAccess=$LQ, pending=$PENDING) after $((CONVERGED_AT-RESTART_AT))s of polling"
step 6 "orderers restarted, unattended convergence" "converged=$CONVERGED ledger=$LQ poll_s=$((CONVERGED_AT-RESTART_AT))"

# ── step 7: release path after reconciliation ──────────────────────────────
C=$(http_code "$BASE/documents/$DOC/ciphertext" -H "Authorization: Bearer $TOK_G")
log "[7] grantee download after reconciliation: HTTP $C"
step 7 "download after reconciliation" "HTTP $C"

# ── divergence window from the outbox row's own timestamps ─────────────────
pg "SELECT id, chaincode_function, status, attempts, created_at, committed_at,
           EXTRACT(EPOCH FROM (committed_at - created_at)) AS divergence_s
    FROM pending_anchor WHERE doc_id='$DOC' AND target_user_id='$GRANTEE'
    ORDER BY created_at" > "$OUT_DIR/anchors_final.txt" || true
DIVERGENCE=$(pg "SELECT EXTRACT(EPOCH FROM (committed_at - created_at))
    FROM pending_anchor WHERE doc_id='$DOC' AND target_user_id='$GRANTEE'
      AND chaincode_function='GrantAccess' LIMIT 1")
log "grant anchor divergence window: ${DIVERGENCE:-n/a} s (created_at -> committed_at, no poll jitter)"
step 8 "grant divergence window (outbox timestamps)" "${DIVERGENCE:-n/a} s"

if [[ "$MODE" == "fifo" ]]; then
  ORDER_OK=$(pg "SELECT (MIN(committed_at) FILTER (WHERE chaincode_function='GrantAccess'))
                     <= (MIN(committed_at) FILTER (WHERE chaincode_function='RevokeAccess'))
                 FROM pending_anchor WHERE doc_id='$DOC' AND target_user_id='$GRANTEE'")
  log "fifo: grant committed before revoke: $ORDER_OK"
  step 9 "fifo intent-order preserved (grant before revoke)" "$ORDER_OK"
fi

# ── audit rows for the record ──────────────────────────────────────────────
pg "SELECT event_type, timestamp FROM audit_log
    WHERE resource_id='$DOC' ORDER BY timestamp" > "$OUT_DIR/audit_trail.txt" || true

log "done — results in $OUT_DIR"

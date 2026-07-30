#!/usr/bin/env bash
# Experiment 16b — Orderer-only outage: bounded, auto-reconciling divergence (post-fix).
#
# This is the re-run of Experiment 16 (../orderer_outage_divergence/) after the M1 fix
# (bcra_peer_review.md, Tier 1 item 1): AccessControlService#revoke now writes a
# `pending_anchor` outbox row in the same DB transaction as the operational revoke, and
# AnchorReconciliationWorker drains it with backoff. Experiment 16 showed the divergence
# was PERMANENT (no reconciliation after the orderers recovered, required a manual CLI
# re-revoke). This run's hypothesis is that it is now BOUNDED and AUTOMATIC: the revoke
# response changes from 204 to 202 during the outage, and once the orderers recover the
# outbox drains without any manual action, closing the divergence within one worker poll
# interval (fixedDelay=5s) of orderer recovery.
#
# Sequence:
#   0. baseline download (everything healthy)              -> expect 200
#   1. stop the three orderers (peers stay up)
#   2. grantee download during outage (evaluate -> peer)   -> expect 200
#   3. owner revoke during outage (submit -> orderer)      -> expect 202 Accepted, ledgerSyncStatus=pending
#   4. grantee download AFTER the revoke, still outage     -> expect 200 (ciphertext only; same as Exp 16)
#   5. grantee wrapped-key AFTER the revoke                -> expect 403 (DB-gated; unchanged)
#   6. ledger CheckAccess + ACL + DB row + pending_anchor   -> ledger ACTIVE, DB revoked, anchor PENDING
#   7. restart orderers; POLL (no manual action) until:
#        - ledger CheckAccess flips to false, and
#        - pending_anchor.status flips to COMMITTED
#      Record the wall-clock divergence window.
#   8. re-download after reconciliation                    -> expect 403 (fixed; was permanently 200 in Exp 16)
#
# All raw output is saved under results/<stamp>/.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
EXP_DIR="$ROOT_DIR/experiments/orderer_outage_reconciliation_16b"
LEGACY_EXP_DIR="$ROOT_DIR/experiments/orderer_outage_divergence"
STAMP="$(date -u +%Y%m%d_%H%M%S)"
OUT_DIR="${PANGOCHAIN_EXP16B_OUTPUT_DIR:-$EXP_DIR/results/$STAMP}"

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

log(){ printf '[exp16b %s] %s\n' "$(date -u +%H:%M:%S)" "$*"; }
token(){ curl -s -X POST "$BASE/auth/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$1\",\"password\":\"$PW\"}" | python3 -c "import json,sys;print(json.load(sys.stdin)['accessToken'])"; }
http_code(){ curl -s -o /dev/null -w '%{http_code}' "$@"; }
http_body_and_code(){ curl -s -w '\n%{http_code}' "$@"; }
ledger_query(){ docker exec "$CLI" peer chaincode query -C "$CHANNEL" -n "$CC" -c "$1" 2>&1; }
pg(){ docker exec "$PG_CONTAINER" psql -U pangochain -d pangochain -tA -c "$1" 2>/dev/null; }
# id,description,result — fields are quoted because results embed JSON containing commas.
step(){ printf '%s,"%s","%s"\n' "$1" "$2" "${3//\"/\"\"}" >> "$SEQ"; }

echo "step,description,result" > "$SEQ"
log "output dir: $OUT_DIR"

# ── environment record ────────────────────────────────────────────────────
{
  echo "{"
  echo "  \"experiment\": \"16b - orderer-only outage, post-fix reconciliation\","
  echo "  \"timestamp_utc\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\","
  echo "  \"host\": \"$(uname -srm)\","
  echo "  \"docker\": \"$(docker --version 2>/dev/null | sed 's/\"//g')\","
  echo "  \"channel\": \"$CHANNEL\", \"chaincode\": \"$CC\","
  echo "  \"orderers\": \"${ORDERERS[*]}\","
  echo "  \"poll_interval_s\": $POLL_INTERVAL, \"poll_timeout_s\": $POLL_TIMEOUT,"
  echo "  \"reference_run\": \"experiments/orderer_outage_divergence (pre-fix, permanent divergence)\""
  echo "}"
} > "$OUT_DIR/environment.json"

# ── fixture: fresh case + document + active cross-firm grant (shared with Exp 16) ─
log "creating fixture (fresh doc + cross-firm grant) via ../orderer_outage_divergence/setup.mjs"
FIXTURE_JSON="$(node "$LEGACY_EXP_DIR/setup.mjs" "$SEED_STATE")"
echo "$FIXTURE_JSON" > "$OUT_DIR/fixture.json"
DOC=$(python3 -c "import json;print(json.load(open('$OUT_DIR/fixture.json'))['docId'])")
GRANTEE=$(python3 -c "import json;print(json.load(open('$OUT_DIR/fixture.json'))['granteeId'])")
GRANTEE_MSP=$(python3 -c "import json;print(json.load(open('$OUT_DIR/fixture.json'))['granteeMsp'])")
GRANTEE_EMAIL=$(python3 -c "import json;print(json.load(open('$OUT_DIR/fixture.json'))['granteeEmail'])")
OWNER_EMAIL=$(python3 -c "import json;print(json.load(open('$OUT_DIR/fixture.json'))['granterEmail'])")
log "fixture doc=$DOC grantee=$GRANTEE ($GRANTEE_MSP)"

CHECK_ARGS="{\"function\":\"CheckAccess\",\"Args\":[\"$DOC\",\"$GRANTEE\",\"$GRANTEE_MSP\"]}"

TOK_G="$(token "$GRANTEE_EMAIL")"
TOK_O="$(token "$OWNER_EMAIL")"

# ── step 0: baseline (healthy) ─────────────────────────────────────────────
C=$(http_code "$BASE/documents/$DOC/ciphertext" -H "Authorization: Bearer $TOK_G")
log "[0] baseline grantee download (healthy): HTTP $C"; step 0 "baseline download (healthy)" "HTTP $C"

# ── step 1: orderer-only outage ────────────────────────────────────────────
log "[1] stopping orderers (peers stay up): ${ORDERERS[*]}"
docker stop "${ORDERERS[@]}" >/dev/null
step 1 "stop orderers (peers up)" "stopped ${ORDERERS[*]}"

# ── step 2: download during outage (evaluate -> peer) ──────────────────────
C=$(http_code "$BASE/documents/$DOC/ciphertext" -H "Authorization: Bearer $TOK_G")
log "[2] grantee download during outage: HTTP $C"; step 2 "download during outage (evaluate->peer)" "HTTP $C"

# ── step 3: revoke during outage (submit -> orderer) — now durable ─────────
REVOKE_ISSUED_AT="$(date -u +%s)"
RESP=$(http_body_and_code -X DELETE "$BASE/access/$DOC/user/$GRANTEE" -H "Authorization: Bearer $TOK_O")
RBODY=$(echo "$RESP" | head -n -1)
RCODE=$(echo "$RESP" | tail -1)
log "[3] owner revoke during outage (submit->orderer): HTTP $RCODE body=$RBODY"
step 3 "revoke during outage (durable outbox)" "HTTP $RCODE $RBODY"
if [[ "$RCODE" != "202" ]]; then
  log "[3] WARNING: expected 202 Accepted (pending) during an orderer outage, got $RCODE"
fi

# ── step 4: download AFTER the revoke, still mid-outage ────────────────────
C=$(http_code "$BASE/documents/$DOC/ciphertext" -H "Authorization: Bearer $TOK_G")
log "[4] grantee download AFTER revoke (still outage): HTTP $C (expect 200 — same bounded exposure as Exp 16)"
step 4 "download after revoke (still outage)" "HTTP $C"

# ── step 5: wrapped-key AFTER the revoke ───────────────────────────────────
C=$(http_code "$BASE/documents/$DOC/wrapped-key" -H "Authorization: Bearer $TOK_G")
log "[5] grantee wrapped-key AFTER revoke: HTTP $C (DB-gated; unchanged by this fix)"
step 5 "wrapped-key after revoke (DB-gated)" "HTTP $C"

# ── step 6: ledger vs DB vs outbox during outage ────────────────────────────
LEDGER_CHECK=$(ledger_query "$CHECK_ARGS" | tail -1)
DB_REVOKED=$(pg "SELECT revoked_at IS NOT NULL FROM document_access WHERE doc_id='$DOC' AND user_id='$GRANTEE';")
ANCHOR_STATUS=$(pg "SELECT status FROM pending_anchor WHERE doc_id='$DOC' AND target_user_id='$GRANTEE' ORDER BY created_at DESC LIMIT 1;")
log "[6] ledger CheckAccess=$LEDGER_CHECK | DB revoked=$DB_REVOKED | pending_anchor.status=$ANCHOR_STATUS"
step 6 "ledger/DB/outbox during outage" "ledger=$LEDGER_CHECK db_revoked=$DB_REVOKED anchor=$ANCHOR_STATUS"
if [[ "$ANCHOR_STATUS" != "PENDING" ]]; then
  log "[6] WARNING: expected pending_anchor.status=PENDING during the outage, got '$ANCHOR_STATUS'"
fi

# ── step 7: restart orderers; POLL for automatic reconciliation ────────────
log "[7] restarting orderers; polling every ${POLL_INTERVAL}s (timeout ${POLL_TIMEOUT}s) for automatic reconciliation — no manual action"
docker start "${ORDERERS[@]}" >/dev/null

ELAPSED=0
RECONCILED=false
while [[ "$ELAPSED" -lt "$POLL_TIMEOUT" ]]; do
  LEDGER_NOW=$(ledger_query "$CHECK_ARGS" | tail -1)
  ANCHOR_NOW=$(pg "SELECT status FROM pending_anchor WHERE doc_id='$DOC' AND target_user_id='$GRANTEE' ORDER BY created_at DESC LIMIT 1;")
  if [[ "$LEDGER_NOW" == "false" && "$ANCHOR_NOW" == "COMMITTED" ]]; then
    RECONCILED=true
    break
  fi
  sleep "$POLL_INTERVAL"
  ELAPSED=$((ELAPSED + POLL_INTERVAL))
done

RECONCILED_AT="$(date -u +%s)"
DIVERGENCE_WINDOW_S=$((RECONCILED_AT - REVOKE_ISSUED_AT))

if [[ "$RECONCILED" == "true" ]]; then
  log "[7] RECONCILED automatically after ${DIVERGENCE_WINDOW_S}s (wall clock from revoke request to ledger=false + anchor=COMMITTED). No manual action taken."
else
  log "[7] NOT reconciled within ${POLL_TIMEOUT}s timeout — ledger=$LEDGER_NOW anchor=$ANCHOR_NOW. This is a regression vs. the expected fix."
fi
step 7 "auto-reconciliation after orderer recovery" "reconciled=$RECONCILED divergence_window_s=$DIVERGENCE_WINDOW_S"

# Pull the DB's own timestamps for a precise (non-polling-jitter) divergence figure.
ANCHOR_ROW=$(pg "SELECT attempts, EXTRACT(EPOCH FROM (committed_at - created_at)) FROM pending_anchor WHERE doc_id='$DOC' AND target_user_id='$GRANTEE' ORDER BY created_at DESC LIMIT 1;")
log "[7] pending_anchor (attempts, precise_divergence_seconds) = $ANCHOR_ROW"
echo "$ANCHOR_ROW" > "$OUT_DIR/pending_anchor_row.txt"

# ── step 8: download after reconciliation — should now correctly deny ──────
C=$(http_code "$BASE/documents/$DOC/ciphertext" -H "Authorization: Bearer $TOK_G")
log "[8] grantee download after reconciliation: HTTP $C (expect 403 — fixed; Exp 16 pre-fix was permanently 200)"
step 8 "download after reconciliation" "HTTP $C"

log "done. summary:"; column -t -s, "$SEQ" | sed 's/^/    /'
log "raw evidence in $OUT_DIR"

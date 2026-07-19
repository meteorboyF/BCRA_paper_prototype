#!/usr/bin/env bash
# Experiment 16 — Orderer-only outage divergence on the revoke/release paths.
#
# Motivation: Experiment 9 stops all PEERS, so reads AND writes fail and the
# download path correctly denies (fail-closed). The asymmetric case it cannot
# reach is an ORDERER-ONLY outage: peers stay up, so CheckAccess (an evaluate
# query to a peer) keeps succeeding against last-committed state, while
# RevokeAccess (a submit through the orderer) cannot commit. The prototype's
# write paths are availability-first (they catch the Fabric failure and
# complete the operational write), so a revoke issued during the outage
# updates PostgreSQL but never reaches the ledger — and the release path keeps
# authorizing the "revoked" user from the stale on-chain grant.
#
# This run reproduces, with raw evidence, the exact sequence:
#   0. baseline download (everything healthy)              -> expect 200
#   1. stop the three orderers (peers stay up)
#   2. grantee download during outage (evaluate -> peer)   -> expect 200
#   3. owner revoke during outage (submit -> orderer)      -> expect 2xx "success"
#   4. grantee download AFTER the revoke                   -> expect 200 (stale grant served)
#   5. grantee wrapped-key AFTER the revoke                -> expect 403 (DB-gated; DB revoke landed)
#   6. ledger CheckAccess + ACL + DB row                   -> ledger ACTIVE vs DB revoked (divergence)
#   7. restart orderers, wait, re-check ledger CheckAccess -> STILL true (divergence is PERMANENT)
#   8. manual re-revoke via CLI while Fabric reachable     -> ledger now false (the only thing that fixes it)
#
# All raw output is saved under results/<stamp>/. Nothing here is a load test;
# it is a deterministic behavioural sequence, so no warm-up or repetition.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
EXP_DIR="$ROOT_DIR/experiments/orderer_outage_divergence"
STAMP="$(date -u +%Y%m%d_%H%M%S)"
OUT_DIR="${PANGOCHAIN_EXP16_OUTPUT_DIR:-$EXP_DIR/results/$STAMP}"

BASE="${API_URL:-http://localhost:8080/api}"
PW="${DEMO_PASSWORD:-Demo2026#Secure}"
PG_CONTAINER="${PANGOCHAIN_POSTGRES_CONTAINER:-pangochain-postgres}"
CLI="${PANGOCHAIN_FABRIC_CLI:-fabric-cli}"
CHANNEL="${PANGOCHAIN_CHANNEL:-legal-channel}"
CC="${PANGOCHAIN_CHAINCODE:-legalcc}"
ORDERERS=(orderer1.pangochain.com orderer2.pangochain.com orderer3.pangochain.com)
RECOVERY_WAIT="${PANGOCHAIN_RECOVERY_WAIT:-25}"
SEED_STATE="${PANGOCHAIN_SEED_STATE:-$ROOT_DIR/ui_retake_seed/seed_state.json}"

# CLI-internal crypto paths (Fabric peer container layout)
CRYPTO=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto
ORD_CA="$CRYPTO/ordererOrganizations/pangochain.com/orderers/orderer1.pangochain.com/msp/tlscacerts/tlsca.pangochain.com-cert.pem"
PA_FIRMA="peer0.firma.pangochain.com:7051"
PA_FIRMB="peer0.firmb.pangochain.com:8051"
PA_REG="peer0.regulator.pangochain.com:9051"
CA_FIRMA="$CRYPTO/peerOrganizations/firma.pangochain.com/peers/peer0.firma.pangochain.com/tls/ca.crt"
CA_FIRMB="$CRYPTO/peerOrganizations/firmb.pangochain.com/peers/peer0.firmb.pangochain.com/tls/ca.crt"
CA_REG="$CRYPTO/peerOrganizations/regulator.pangochain.com/peers/peer0.regulator.pangochain.com/tls/ca.crt"

mkdir -p "$OUT_DIR"
LOG="$OUT_DIR/run.log"
SEQ="$OUT_DIR/sequence.csv"
exec > >(tee -a "$LOG") 2>&1

log(){ printf '[exp16 %s] %s\n' "$(date -u +%H:%M:%S)" "$*"; }
token(){ curl -s -X POST "$BASE/auth/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$1\",\"password\":\"$PW\"}" | python3 -c "import json,sys;print(json.load(sys.stdin)['accessToken'])"; }
http_code(){ curl -s -o /dev/null -w '%{http_code}' "$@"; }
ledger_query(){ docker exec "$CLI" peer chaincode query -C "$CHANNEL" -n "$CC" -c "$1" 2>&1; }
pg(){ docker exec "$PG_CONTAINER" psql -U pangochain -d pangochain -tA -c "$1" 2>/dev/null; }
step(){ printf '%s,%s,%s\n' "$1" "$2" "$3" >> "$SEQ"; }  # id,description,result

echo "step,description,result" > "$SEQ"
log "output dir: $OUT_DIR"

# ── environment record ────────────────────────────────────────────────────
{
  echo "{"
  echo "  \"experiment\": \"16 - orderer-only outage divergence\","
  echo "  \"timestamp_utc\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\","
  echo "  \"host\": \"$(uname -srm)\","
  echo "  \"docker\": \"$(docker --version 2>/dev/null | sed 's/\"//g')\","
  echo "  \"channel\": \"$CHANNEL\", \"chaincode\": \"$CC\","
  echo "  \"orderers\": \"${ORDERERS[*]}\","
  echo "  \"recovery_wait_s\": $RECOVERY_WAIT"
  echo "}"
} > "$OUT_DIR/environment.json"

# ── fixture: fresh case + document + active cross-firm grant ───────────────
log "creating fixture (fresh doc + cross-firm grant) via setup.mjs"
FIXTURE_JSON="$(node "$EXP_DIR/setup.mjs" "$SEED_STATE")"
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

# ── step 3: revoke during outage (submit -> orderer) ───────────────────────
C=$(http_code -X DELETE "$BASE/access/$DOC/user/$GRANTEE" -H "Authorization: Bearer $TOK_O")
log "[3] owner revoke during outage (submit->orderer): HTTP $C"; step 3 "revoke during outage (submit->orderer)" "HTTP $C"

# ── step 4: download AFTER the revoke ──────────────────────────────────────
BYTES=$(curl -s "$BASE/documents/$DOC/ciphertext" -H "Authorization: Bearer $TOK_G" | wc -c)
C=$(http_code "$BASE/documents/$DOC/ciphertext" -H "Authorization: Bearer $TOK_G")
log "[4] grantee download AFTER revoke: HTTP $C ($BYTES bytes served to revoked user)"
step 4 "download after revoke (stale grant)" "HTTP $C, $BYTES bytes"

# ── step 5: wrapped-key AFTER the revoke ───────────────────────────────────
C=$(http_code "$BASE/documents/$DOC/wrapped-key" -H "Authorization: Bearer $TOK_G")
log "[5] grantee wrapped-key AFTER revoke: HTTP $C (DB-gated; DB revoke landed)"
step 5 "wrapped-key after revoke (DB-gated)" "HTTP $C"

# ── step 6: ledger vs DB divergence during outage ──────────────────────────
LEDGER_CHECK=$(ledger_query "$CHECK_ARGS" | tail -1)
DB_REVOKED=$(pg "SELECT revoked_at IS NOT NULL FROM document_access WHERE doc_id='$DOC' AND user_id='$GRANTEE';")
log "[6] ledger CheckAccess=$LEDGER_CHECK  |  DB revoked=$DB_REVOKED  -> DIVERGENCE"
ledger_query "{\"function\":\"GetAccessList\",\"Args\":[\"$DOC\"]}" > "$OUT_DIR/ledger_acl_during_outage.json" 2>&1 || true
step 6 "ledger vs DB during outage" "ledger=$LEDGER_CHECK db_revoked=$DB_REVOKED"

# ── step 7: restart orderers, re-check (permanence) ────────────────────────
log "[7] restarting orderers; waiting ${RECOVERY_WAIT}s for Raft + gateway recovery"
docker start "${ORDERERS[@]}" >/dev/null
sleep "$RECOVERY_WAIT"
LEDGER_AFTER=$(ledger_query "$CHECK_ARGS" | tail -1)
log "[7] ledger CheckAccess after recovery (no manual action): $LEDGER_AFTER (expect still true = PERMANENT)"
step 7 "ledger after orderer recovery" "ledger=$LEDGER_AFTER"

# ── step 8: manual re-revoke via CLI (the only fix) ────────────────────────
log "[8] manual re-revoke via CLI (majority endorsement) while Fabric reachable"
docker exec "$CLI" peer chaincode invoke -o orderer1.pangochain.com:7050 --tls --cafile "$ORD_CA" \
  -C "$CHANNEL" -n "$CC" --waitForEvent \
  --peerAddresses "$PA_FIRMA" --tlsRootCertFiles "$CA_FIRMA" \
  --peerAddresses "$PA_FIRMB" --tlsRootCertFiles "$CA_FIRMB" \
  --peerAddresses "$PA_REG"   --tlsRootCertFiles "$CA_REG" \
  -c "{\"function\":\"RevokeAccess\",\"Args\":[\"$DOC\",\"$GRANTEE\",\"$(python3 -c "import json;print(json.load(open('$OUT_DIR/fixture.json'))['granterId'])")\"]}" \
  2>&1 | tail -2 || log "[8] re-revoke invoke returned nonzero"
sleep 4
LEDGER_FIXED=$(ledger_query "$CHECK_ARGS" | tail -1)
log "[8] ledger CheckAccess after manual re-revoke: $LEDGER_FIXED (expect false = reconciled)"
step 8 "ledger after manual re-revoke" "ledger=$LEDGER_FIXED"

log "done. summary:"; column -t -s, "$SEQ" | sed 's/^/    /'
log "raw evidence in $OUT_DIR"

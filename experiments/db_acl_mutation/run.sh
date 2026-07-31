#!/usr/bin/env bash
# Experiment 18 - adversarial database ACL mutation.
#
# The paper's headline security claim is that a malicious database administrator cannot
# subvert authorization, because the release path evaluates committed ledger state rather
# than the PostgreSQL ACL. That claim is argued throughout the manuscript and never
# measured (reviewer finding M10). This experiment measures it by actually mutating the
# database as a privileged attacker would and observing what the release path does.
#
# Three cases, each with the mutation applied directly via psql (no application code path):
#
#   1. FORGED GRANT, cross-organization. Insert a document_access row granting a user who
#      holds no ledger grant. Expect denial: the ledger, not the database, decides.
#   2. DELETED GRANT. Remove the row of a user who does hold a ledger grant. Shows which
#      store each endpoint actually consults - the ciphertext path and the wrapped-key path
#      do not agree, and that asymmetry is the finding.
#   3. FORGED GRANT, same organization. Identical to case 1 but the attacker shares the
#      owner's org. Expected to SUCCEED, because CheckAccess falls through to
#      `doc.OwnerOrg == userOrg`. This is reviewer finding M5 reproduced as a measurement
#      rather than a code reading, and it bounds how far case 1's result generalises.
#
# Every mutation is reverted before the next case. Raw output under results/<stamp>/.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
EXP_DIR="$ROOT_DIR/experiments/db_acl_mutation"
STAMP="$(date -u +%Y%m%d_%H%M%S)"
OUT_DIR="${PANGOCHAIN_EXP18_OUT:-$EXP_DIR/results/$STAMP}"

BASE="${API_URL:-http://localhost:8080/api}"
PW="${DEMO_PASSWORD:-Demo2026#Secure}"
PG="${PANGOCHAIN_POSTGRES_CONTAINER:-pangochain-postgres}"
CLI="${PANGOCHAIN_FABRIC_CLI:-fabric-cli}"
CHANNEL="${PANGOCHAIN_CHANNEL:-legal-channel}"
CC="${PANGOCHAIN_CHAINCODE:-legalcc}"
SEED_STATE="${PANGOCHAIN_SEED_STATE:-$ROOT_DIR/ui_retake_seed/seed_state.json}"
CROSS_ORG_ATTACKER="${CROSS_ORG_ATTACKER:-m.karim@regulator.example}"

mkdir -p "$OUT_DIR"
LOG="$OUT_DIR/run.log"; SEQ="$OUT_DIR/sequence.csv"
exec > >(tee -a "$LOG") 2>&1
log(){ printf '[exp18 %s] %s\n' "$(date -u +%H:%M:%S)" "$*"; }
step(){ printf '%s,"%s","%s"\n' "$1" "$2" "${3//\"/\"\"}" >> "$SEQ"; }
token(){ curl -s -X POST "$BASE/auth/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$1\",\"password\":\"$PW\"}" | python3 -c "import json,sys;print(json.load(sys.stdin)['accessToken'])"; }
code(){ curl -s -o /dev/null -w '%{http_code}' "$@"; }
pg(){ docker exec "$PG" psql -U pangochain -d pangochain -tA -c "$1" 2>&1; }
ledger(){ docker exec "$CLI" peer chaincode query -C "$CHANNEL" -n "$CC" -c "$1" 2>&1 | tail -1; }

echo 'step,description,result' > "$SEQ"
log "output dir: $OUT_DIR"

{
  echo "{"
  echo "  \"experiment\": \"18 - adversarial database ACL mutation\","
  echo "  \"timestamp_utc\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\","
  echo "  \"host\": \"$(uname -srm)\","
  echo "  \"channel\": \"$CHANNEL\", \"chaincode\": \"$CC\","
  echo "  \"note\": \"backend must run with DOCUMENT_MATERIAL_DB_FALLBACK=false (shipped default)\""
  echo "}"
} > "$OUT_DIR/environment.json"

# ── fixture: document owned by LawFirmA, genuine cross-firm grant to LawFirmB ──
log "building fixture"
node "$ROOT_DIR/experiments/orderer_outage_divergence/setup.mjs" "$SEED_STATE" > "$OUT_DIR/fixture.json"
DOC=$(python3 -c "import json;print(json.load(open('$OUT_DIR/fixture.json'))['docId'])")
GRANTEE=$(python3 -c "import json;print(json.load(open('$OUT_DIR/fixture.json'))['granteeId'])")
GRANTEE_EMAIL=$(python3 -c "import json;print(json.load(open('$OUT_DIR/fixture.json'))['granteeEmail'])")
node "$EXP_DIR/setup-attacker.mjs" > "$OUT_DIR/attacker.json"
INSIDER=$(python3 -c "import json;print(json.load(open('$OUT_DIR/attacker.json'))['id'])")
INSIDER_EMAIL=$(python3 -c "import json;print(json.load(open('$OUT_DIR/attacker.json'))['email'])")
# Fixture setup, not part of any attack: self-registration lands in PENDING_APPROVAL, and an
# unapproved account is refused at the security filter before any document ACL is consulted.
# Case 3 is only meaningful for a legitimately approved firm member, so approve them here.
pg "UPDATE users SET status='ACTIVE' WHERE id='$INSIDER';" > /dev/null
INSIDER_STATUS=$(pg "SELECT status FROM users WHERE id='$INSIDER';")
log "insider account status: $INSIDER_STATUS (must be ACTIVE or case 3 is vacuous)"
log "doc=$DOC grantee=$GRANTEE insider=$INSIDER"

TOK_X="$(token "$CROSS_ORG_ATTACKER")"
TOK_G="$(token "$GRANTEE_EMAIL")"
TOK_I="$(token "$INSIDER_EMAIL")"
XID=$(pg "SELECT id FROM users WHERE email='$CROSS_ORG_ATTACKER';")

# ══ CASE 1: forged grant, cross-organization ══════════════════════════════════
log "── case 1: forged database grant, cross-organization (RegulatorMSP) ──"
C=$(code "$BASE/documents/$DOC/ciphertext" -H "Authorization: Bearer $TOK_X")
log "  [1.0] baseline download before mutation: HTTP $C"
step 1.0 "cross-org attacker baseline (no grant anywhere)" "HTTP $C"

log "  [1.1] injecting document_access row via psql (attacker has DB write)"
pg "INSERT INTO document_access (id, doc_id, user_id, capability, granted_by, granted_at, wrapped_key_token, token_obsolete)
    VALUES (gen_random_uuid(), '$DOC', '$XID', 'read', '$XID', NOW(), 'FORGED-BY-DB-ADMIN', false);" > /dev/null
DBROW=$(pg "SELECT capability FROM document_access WHERE doc_id='$DOC' AND user_id='$XID' AND revoked_at IS NULL;")
LED=$(ledger "{\"function\":\"CheckAccess\",\"Args\":[\"$DOC\",\"$XID\",\"RegulatorMSP\"]}")
log "  [1.1] database now says: '$DBROW'   ledger says: '$LED'"
step 1.1 "forged row inserted (db vs ledger)" "db=$DBROW ledger=$LED"

C=$(code "$BASE/documents/$DOC/ciphertext" -H "Authorization: Bearer $TOK_X")
K=$(code "$BASE/documents/$DOC/wrapped-key" -H "Authorization: Bearer $TOK_X")
log "  [1.2] download WITH forged database grant: ciphertext HTTP $C, wrapped-key HTTP $K"
log "        (expect denial - the release path evaluates ledger state, not this row)"
step 1.2 "download with forged db grant" "ciphertext=$C wrapped_key=$K"

sleep 2
AUD=$(pg "SELECT count(*) FROM audit_log WHERE resource_id='$DOC' AND event_type LIKE '%DENIED%';")
log "  [1.3] audit entries recording a denial for this document: $AUD"
step 1.3 "denial audited" "denial_events=$AUD"

pg "DELETE FROM document_access WHERE doc_id='$DOC' AND user_id='$XID' AND wrapped_key_token='FORGED-BY-DB-ADMIN';" > /dev/null
log "  [1.4] forged row reverted"

# ══ CASE 2: deleted legitimate grant ══════════════════════════════════════════
log "── case 2: deleting a legitimate grant row ──"
C=$(code "$BASE/documents/$DOC/ciphertext" -H "Authorization: Bearer $TOK_G")
K=$(code "$BASE/documents/$DOC/wrapped-key" -H "Authorization: Bearer $TOK_G")
log "  [2.0] genuine grantee before mutation: ciphertext HTTP $C, wrapped-key HTTP $K"
step 2.0 "genuine grantee baseline" "ciphertext=$C wrapped_key=$K"

pg "CREATE TEMP TABLE IF NOT EXISTS _bak AS SELECT 1;" > /dev/null 2>&1 || true
ROWBAK=$(pg "SELECT wrapped_key_token FROM document_access WHERE doc_id='$DOC' AND user_id='$GRANTEE' AND revoked_at IS NULL LIMIT 1;")
CAPBAK=$(pg "SELECT capability FROM document_access WHERE doc_id='$DOC' AND user_id='$GRANTEE' AND revoked_at IS NULL LIMIT 1;")
pg "DELETE FROM document_access WHERE doc_id='$DOC' AND user_id='$GRANTEE';" > /dev/null
LED=$(ledger "{\"function\":\"CheckAccess\",\"Args\":[\"$DOC\",\"$GRANTEE\",\"FirmBMSP\"]}")
C=$(code "$BASE/documents/$DOC/ciphertext" -H "Authorization: Bearer $TOK_G")
K=$(code "$BASE/documents/$DOC/wrapped-key" -H "Authorization: Bearer $TOK_G")
log "  [2.1] grant row deleted. ledger still says: '$LED'"
log "        ciphertext HTTP $C, wrapped-key HTTP $K"
step 2.1 "after deleting legitimate db row" "ledger=$LED ciphertext=$C wrapped_key=$K"

pg "INSERT INTO document_access (id, doc_id, user_id, capability, granted_by, granted_at, wrapped_key_token, token_obsolete)
    VALUES (gen_random_uuid(), '$DOC', '$GRANTEE', '${CAPBAK:-read}', '$GRANTEE', NOW(), '$ROWBAK', false);" > /dev/null
log "  [2.2] legitimate row restored"

# ══ CASE 3: forged grant, same organization (reviewer M5) ═════════════════════
log "── case 3: same-organization insider, no grant in either store ──"
LED=$(ledger "{\"function\":\"CheckAccess\",\"Args\":[\"$DOC\",\"$INSIDER\",\"FirmAMSP\"]}")
DBROW=$(pg "SELECT count(*) FROM document_access WHERE doc_id='$DOC' AND user_id='$INSIDER' AND revoked_at IS NULL;")
C=$(code "$BASE/documents/$DOC/ciphertext" -H "Authorization: Bearer $TOK_I")
K=$(code "$BASE/documents/$DOC/wrapped-key" -H "Authorization: Bearer $TOK_I")
log "  [3.0] insider has $DBROW database rows; ledger CheckAccess says '$LED'"
log "        ciphertext HTTP $C, wrapped-key HTTP $K"
log "        (a 200 here is the OwnerOrg fallback, i.e. reviewer finding M5)"
step 3.0 "same-org insider, no grant" "db_rows=$DBROW ledger=$LED ciphertext=$C wrapped_key=$K"

log "done. summary:"; column -t -s, "$SEQ" | sed 's/^/    /'
log "raw evidence in $OUT_DIR"

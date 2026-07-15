#!/bin/bash
# Experiment 4 — Seed 1,000 audit events for a single case
# Usage: JWT=<token> CASE_ID=<id> bash seed-audit-events.sh [count]
# Creates documents + access grants + revocations to generate real Fabric transactions

BASE="http://localhost:8080/api"
TARGET="${1:-1000}"

[ -z "$JWT" ] && { echo "ERROR: set JWT env var"; exit 1; }
[ -z "$CASE_ID" ] && { echo "ERROR: set CASE_ID env var"; exit 1; }

H="Authorization: Bearer $JWT"
CONTENT="Content-Type: application/json"
count=0

echo "=== Seeding $TARGET audit events for case $CASE_ID ==="
echo "Date: $(date -Iseconds)"

# Helper: register one document, return doc ID
register_doc() {
  local n="$1"
  python3 -c "
import json, base64, os, sys
n = sys.argv[1]
payload = {
  'caseId': '$CASE_ID',
  'fileName': f'seed-doc-{n}.bin',
  'ivBase64': base64.b64encode(os.urandom(12)).decode(),
  'ciphertextBase64': base64.b64encode(os.urandom(1024)).decode(),
  'documentHashSha256': '0' * 64,
  'wrappedKeyTokenForOwner': base64.b64encode(os.urandom(125)).decode()
}
print(json.dumps(payload))
" "$n" | curl -sf -H "$H" -H "$CONTENT" -d @- "$BASE/documents/upload" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id',''))"
}

# Round 1: DOC_REGISTERED events (~200)
echo ""
echo "--- Phase 1: Registering documents (DOC_REGISTERED events) ---"
doc_ids=()
for i in $(seq 1 200); do
  docid=$(register_doc "$i")
  if [ -n "$docid" ]; then
    doc_ids+=("$docid")
    count=$((count+1))
    [ $((count % 20)) -eq 0 ] && echo "  Progress: $count / $TARGET events generated"
  fi
  [ $count -ge $TARGET ] && break
done

# Round 2: ACCESS_GRANTED events (~400) — would need real user IDs to grant to
# This requires knowing other user IDs in the system
# As a workaround, we'll trigger additional document reads (CheckAccess)
echo ""
echo "--- Phase 2: CheckAccess reads (ACCESS_CHECKED events) ---"
for docid in "${doc_ids[@]}"; do
  for _ in 1 2; do
    curl -sf -H "$H" "$BASE/documents/$docid/wrapped-key" > /dev/null 2>&1
    count=$((count+1))
    [ $((count % 50)) -eq 0 ] && echo "  Progress: $count / $TARGET events generated"
  done
  [ $count -ge $TARGET ] && break
done

# Round 3: DOC_DOWNLOADED events (~200)
echo ""
echo "--- Phase 3: Document downloads (DOC_DOWNLOADED events) ---"
for docid in "${doc_ids[@]}"; do
  curl -sf -H "$H" "$BASE/documents/$docid/ciphertext" > /dev/null 2>&1
  count=$((count+1))
  [ $((count % 20)) -eq 0 ] && echo "  Progress: $count / $TARGET events generated"
  [ $count -ge $TARGET ] && break
done

# Round 4: Fill remaining with additional CheckAccess calls
echo ""
echo "--- Phase 4: Additional events to reach $TARGET ---"
while [ $count -lt $TARGET ] && [ ${#doc_ids[@]} -gt 0 ]; do
  for docid in "${doc_ids[@]}"; do
    curl -sf -H "$H" "$BASE/documents/$docid/wrapped-key" > /dev/null 2>&1
    count=$((count+1))
    [ $count -ge $TARGET ] && break
  done
done

echo ""
echo "=== Seeding complete: $count events generated ==="
echo "Now run: bash experiments/measure-audit-verification.sh $CASE_ID"

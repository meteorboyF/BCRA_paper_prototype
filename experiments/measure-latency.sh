#!/bin/bash
# Experiment 2 — Function-level latency measurement
# Usage: JWT=<token> DOC_ID=<id> CASE_ID=<id> bash measure-latency.sh

BASE="http://localhost:8080/api"
REPS=100

[ -z "$JWT" ] && { echo "ERROR: set JWT env var"; exit 1; }
[ -z "$DOC_ID" ] && { echo "ERROR: set DOC_ID env var"; exit 1; }
[ -z "$CASE_ID" ] && { echo "ERROR: set CASE_ID env var"; exit 1; }

H="Authorization: Bearer $JWT"

measure() {
  local label="$1"; local cmd="$2"; local reps="${3:-$REPS}"
  local total=0; local count=0
  declare -a times
  for i in $(seq 1 $reps); do
    t=$( { time eval "$cmd" > /dev/null 2>&1; } 2>&1 | grep real | awk '{print $2}' | sed 's/[ms]/ /g' | awk '{print $1*60000 + $2*1000}' )
    times+=("$t")
    total=$(echo "$total + $t" | bc)
    count=$((count+1))
  done
  local mean=$(echo "scale=1; $total / $count" | bc)
  # Sort for percentiles
  IFS=$'\n' sorted=($(sort -n <<<"${times[*]}")); unset IFS
  local p50="${sorted[$((count/2))]}"
  local p95="${sorted[$((count*95/100))]}"
  local p99="${sorted[$((count*99/100))]}"
  echo "  $label: mean=${mean}ms  P50=${p50}ms  P95=${p95}ms  P99=${p99}ms"
}

echo "=== Experiment 2 — Function-Level Latency ==="
echo "Date: $(date -Iseconds)"
echo ""

echo "--- CheckAccess (read, Fabric mode) ---"
measure "CheckAccess" "curl -sf -H '$H' '$BASE/documents/$DOC_ID/wrapped-key'"

echo ""
echo "--- GetDocumentHistory (read, Fabric) ---"
measure "GetDocumentHistory" "curl -sf -H '$H' '$BASE/documents/$DOC_ID/ciphertext' -o /dev/null" 50

echo ""
echo "--- RegisterDocument 1MB (write) ---"
# Create a 1MB test payload
python3 -c "
import json, base64, os
payload = {
  'caseId': '$CASE_ID',
  'fileName': 'bench-1mb.bin',
  'ivBase64': base64.b64encode(os.urandom(12)).decode(),
  'ciphertextBase64': base64.b64encode(os.urandom(1024*1024)).decode(),
  'documentHashSha256': '0'*64,
  'wrappedKeyTokenForOwner': base64.b64encode(os.urandom(125)).decode()
}
print(json.dumps(payload))
" > /tmp/bench-1mb.json
measure "RegisterDocument 1MB" "curl -sf -H '$H' -H 'Content-Type: application/json' -d @/tmp/bench-1mb.json '$BASE/documents/upload'" 20

echo ""
echo "=== Done. Copy output to experiment_results.md ==="

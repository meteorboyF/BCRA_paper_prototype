#!/bin/bash
# Experiment 3 — File Size Impact on Latency (REST path, with secondary IPFS pin)
# Sends JSON with base64-encoded ciphertext of each target size.
# Matches 2026-05-15 methodology: REST API path via IpfsService (primary + secondary pin).
# Usage: JWT=<token> CASE_ID=<id> bash experiments/measure-filesize-rest.sh

REPS=10
BASE_URL="http://localhost:8080/api"

[ -z "$JWT" ] && { echo "ERROR: set JWT env var"; exit 1; }
[ -z "$CASE_ID" ] && { echo "ERROR: set CASE_ID env var"; exit 1; }

echo "=== Experiment 3 — File Size Impact on Latency (REST path) ==="
echo "Date: $(date -Iseconds)"
echo "Method: POST /api/documents/upload (JSON, AES-GCM ciphertext base64)"
echo "Samples per size: $REPS"
echo ""

for SIZE_MB in 1 5 10 20 30 50; do
  # Calculate base64 encoded size for SIZE_MB bytes
  # base64 length = ceil(SIZE_MB * 1024 * 1024 * 4 / 3), rounded to multiple of 4
  B64_LEN=$(python3 -c "import math; n=$SIZE_MB*1024*1024; b64=math.ceil(n/3)*4; print(b64)")
  ACTUAL_BYTES=$(python3 -c "import math; n=$SIZE_MB*1024*1024; b64=math.ceil(n/3)*4; print(b64*3//4)")

  echo "--- ${SIZE_MB}MB (base64 len=$B64_LEN, actual bytes=$ACTUAL_BYTES) ---"

  declare -a times_arr
  for i in $(seq 1 $REPS); do
    START=$(date +%s%3N)
    PAYLOAD=$(python3 -c "
import json, sys
payload = json.dumps({
  'caseId': '$CASE_ID',
  'fileName': 'bench-${SIZE_MB}mb-$i.bin',
  'ivBase64': 'A'*16,
  'ciphertextBase64': 'A'*${B64_LEN},
  'documentHashSha256': '0'*64,
  'wrappedKeyTokenForOwner': 'A'*125,
})
sys.stdout.write(payload)
")
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 60 \
      -H "Authorization: Bearer $JWT" \
      -H "Content-Type: application/json" \
      -d "$PAYLOAD" \
      "$BASE_URL/documents/upload")
    END=$(date +%s%3N)
    ELAPSED=$((END - START))
    times_arr+=($ELAPSED)
    if [ "$STATUS" = "200" ] || [ "$STATUS" = "201" ]; then
      echo "  ${SIZE_MB}MB sample $i: ${ELAPSED}ms  OK"
    else
      echo "  ${SIZE_MB}MB sample $i: ${ELAPSED}ms  FAIL (HTTP $STATUS)"
    fi
  done

  # Compute stats
  python3 - "${SIZE_MB}" "${times_arr[@]}" <<'PYEOF'
import sys
size_mb = int(sys.argv[1])
times = [int(x) for x in sys.argv[2:]]
n = len(times)
if n == 0:
    print(f"  {size_mb}MB: no successful samples")
else:
    s = sorted(times)
    mean = sum(times)/n
    p50 = s[n//2]
    p95 = s[min(int(n*0.95), n-1)]
    print(f"  {size_mb}MB REST: mean={mean:.0f}ms P50={p50}ms P95={p95}ms")
PYEOF

  unset times_arr
  echo ""
done

echo "=== Done ==="
echo "Note: Total time = IPFS primary + secondary pin + Fabric commit (~2132ms constant)"

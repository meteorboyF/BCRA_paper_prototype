#!/bin/bash
# Experiment 2 — RegisterDocument 1MB via REST (JSON, Fabric mode)
# Sends a 1MB ciphertext payload as JSON; measures end-to-end latency.
# Requires Fabric-mode backend. JWT must be fresh (900s expiry).
# Usage: JWT=<token> CASE_ID=<id> bash experiments/measure-regdoc-rest.sh

REPS=20
BASE_URL="http://localhost:8080/api"
SIZE_MB=1
B64_LEN=$(python3 -c "import math; n=${SIZE_MB}*1024*1024; print(math.ceil(n/3)*4)")

[ -z "$JWT" ] && { echo "ERROR: set JWT env var"; exit 1; }
[ -z "$CASE_ID" ] && { echo "ERROR: set CASE_ID env var"; exit 1; }

echo "Exp2 REST: RegisterDocument ${SIZE_MB}MB — ${REPS} samples, Fabric mode"
echo "Method: POST /api/documents/upload (JSON, ciphertextBase64 len=${B64_LEN})"
echo "Date: $(date -Iseconds)"
echo "======================================================"

declare -a times

for i in $(seq 1 $REPS); do
  PAYLOAD=$(python3 -c "
import json, sys
sys.stdout.write(json.dumps({
  'caseId': '$CASE_ID',
  'fileName': 'regdoc-bench-$i.bin',
  'ivBase64': 'A'*16,
  'ciphertextBase64': 'A'*${B64_LEN},
  'documentHashSha256': '0'*64,
  'wrappedKeyTokenForOwner': 'A'*125,
}))
")
  START=$(date +%s%3N)
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 30 \
    -H "Authorization: Bearer $JWT" \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD" \
    "$BASE_URL/documents/upload")
  END=$(date +%s%3N)
  ELAPSED=$((END - START))

  if [ "$STATUS" = "200" ] || [ "$STATUS" = "201" ]; then
    times+=($ELAPSED)
    echo "  [${i}/${REPS}] ${ELAPSED}ms  OK"
  else
    echo "  [${i}/${REPS}] FAIL (HTTP $STATUS)"
  fi
done

echo ""
echo "Results:"
python3 - "${times[@]}" <<'PYEOF'
import sys
times = [int(x) for x in sys.argv[1:]]
if not times:
    print("  No successful samples!"); sys.exit(1)
n = len(times)
s = sorted(times)
mean = sum(times)/n
p50 = s[n//2]
p95 = s[min(int(n*0.95), n-1)]
p99 = s[min(int(n*0.99), n-1)]
print(f"  n={n}  Mean={mean:.1f}ms  P50={p50}ms  P95={p95}ms  P99={p99}ms  Min={min(times)}ms  Max={max(times)}ms")
print(f"  Note: Includes IPFS upload + secondary pin + Fabric commit (~2132ms)")
PYEOF

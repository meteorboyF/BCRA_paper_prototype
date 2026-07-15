#!/bin/bash
# Experiment 3 — File Size Impact on Latency
# Measures IPFS upload vs Fabric commit separately across document sizes
# Usage: JWT=<token> CASE_ID=<id> bash measure-filesize.sh

BASE="http://localhost:8080/api"
REPS=10

[ -z "$JWT" ] && { echo "ERROR: set JWT env var"; exit 1; }
[ -z "$CASE_ID" ] && { echo "ERROR: set CASE_ID env var"; exit 1; }

H="Authorization: Bearer $JWT"

# Generate test files of increasing sizes (random ciphertext)
echo "=== Generating test payloads ==="
for SIZE_MB in 1 5 10 20 30 50; do
  echo "  Creating ${SIZE_MB}MB payload..."
  python3 -c "
import json, base64, os, sys
size_mb = int(sys.argv[1])
size_bytes = size_mb * 1024 * 1024
payload = {
  'caseId': '$CASE_ID',
  'fileName': 'bench-${SIZE_MB}mb.bin',
  'ivBase64': base64.b64encode(os.urandom(12)).decode(),
  'ciphertextBase64': base64.b64encode(os.urandom(size_bytes)).decode(),
  'documentHashSha256': '0' * 64,
  'wrappedKeyTokenForOwner': base64.b64encode(os.urandom(125)).decode()
}
print(json.dumps(payload))
" "$SIZE_MB" > "/tmp/bench-${SIZE_MB}mb.json"
done

echo ""
echo "=== Experiment 3 — File Size Impact on Latency ==="
echo "Date: $(date -Iseconds)"
echo ""
echo "| File Size | Run | Total (ms) | Note |"
echo "|-----------|-----|-----------|------|"

for SIZE_MB in 1 5 10 20 30 50; do
  total=0
  times=()
  for i in $(seq 1 $REPS); do
    t=$( { time curl -sf \
      -H "$H" \
      -H "Content-Type: application/json" \
      -d "@/tmp/bench-${SIZE_MB}mb.json" \
      "$BASE/documents/upload" > /dev/null 2>&1; } 2>&1 \
      | grep real | awk '{print $2}' | sed 's/[ms]/ /g' \
      | awk '{print $1*60000 + $2*1000}' )
    times+=("$t")
    total=$(echo "$total + $t" | bc)
    echo "| ${SIZE_MB}MB | $i | ${t}ms | |"
  done
  count=${#times[@]}
  IFS=$'\n' sorted=($(sort -n <<<"${times[*]}")); unset IFS
  mean=$(echo "scale=1; $total / $count" | bc)
  p50="${sorted[$((count/2))]}"
  p95="${sorted[$((count*95/100))]}"
  echo ""
  echo "  **${SIZE_MB}MB SUMMARY: mean=${mean}ms P50=${p50}ms P95=${p95}ms**"
  echo ""
done

echo ""
echo "=== Done ==="
echo "Copy P50/P95 values into experiment_results.md Experiment 3 table."
echo ""
echo "Note: These are end-to-end times (IPFS upload + Fabric commit)."
echo "The Fabric commit portion should remain ~constant (~2000ms BatchTimeout)."
echo "The IPFS portion grows linearly with file size."
echo "To isolate: total - ~2100ms (Fabric) ≈ IPFS upload time."

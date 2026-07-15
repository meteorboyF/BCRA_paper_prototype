#!/bin/bash
# Exp 5 WAN measurement — run AFTER applying tc netem
# Usage: RTT=50 bash run-wan-measurement.sh
# Env: PANGOCHAIN_JWT_TOKEN, PANGOCHAIN_TEST_CASE_ID, PANGOCHAIN_TEST_DOC_ID

RTT="${RTT:-50}"
BASE="http://localhost:8080/api"
H="Authorization: Bearer $PANGOCHAIN_JWT_TOKEN"

[ -z "$PANGOCHAIN_JWT_TOKEN" ] && { echo "ERROR: set PANGOCHAIN_JWT_TOKEN"; exit 1; }
[ -z "$PANGOCHAIN_TEST_CASE_ID" ] && { echo "ERROR: set PANGOCHAIN_TEST_CASE_ID"; exit 1; }
[ -z "$PANGOCHAIN_TEST_DOC_ID" ] && { echo "ERROR: set PANGOCHAIN_TEST_DOC_ID"; exit 1; }

echo "=== Exp 5 WAN Measurement @ RTT=${RTT}ms ==="
echo "Date: $(date -Iseconds)"
echo ""

# ── Part 1: TPS @ 200 clients (5 runs) ───────────────────────────────────────
echo "--- TPS @ 200 concurrent clients (5 runs) ---"
TPS_SUM=0
for i in 1 2 3 4 5; do
  echo -n "  Run $i: "
  result=$(PANGOCHAIN_JWT_TOKEN="$PANGOCHAIN_JWT_TOKEN" \
           PANGOCHAIN_TEST_CASE_ID="$PANGOCHAIN_TEST_CASE_ID" \
           PANGOCHAIN_TEST_DOC_ID="$PANGOCHAIN_TEST_DOC_ID" \
           PANGOCHAIN_API_URL="$BASE" \
           node "$(dirname "$0")/pangochain-loadtest-wan.js" 2>/dev/null)
  echo "$result"
  tps=$(echo "$result" | grep -oP 'TPS=\K[0-9.]+')
  TPS_SUM=$(echo "$TPS_SUM + ${tps:-0}" | bc)
done
TPS_MEAN=$(echo "scale=1; $TPS_SUM / 5" | bc)
echo "  Mean TPS across 5 runs: $TPS_MEAN"
echo ""

# ── Part 2: RegisterDocument latency (20 samples) ────────────────────────────
echo "--- RegisterDocument 1MB latency (20 samples) ---"
python3 -c "
import json, base64, os
payload = {
  'caseId': '$PANGOCHAIN_TEST_CASE_ID',
  'fileName': 'wan-bench-1mb.bin',
  'ivBase64': base64.b64encode(os.urandom(12)).decode(),
  'ciphertextBase64': base64.b64encode(os.urandom(1024*1024)).decode(),
  'documentHashSha256': '0'*64,
  'wrappedKeyTokenForOwner': base64.b64encode(os.urandom(125)).decode()
}
print(json.dumps(payload))
" > /tmp/wan-bench-1mb.json

times=()
for i in $(seq 1 20); do
  t=$( { time curl -sf -H "$H" -H 'Content-Type: application/json' \
    -d @/tmp/wan-bench-1mb.json "$BASE/documents/upload" > /dev/null 2>&1; } \
    2>&1 | grep real | awk '{print $2}' | sed 's/[ms]/ /g' | \
    awk '{print int($1*60000 + $2*1000)}' )
  times+=("$t")
  echo -n "  [$i] ${t}ms "
  [ $((i % 5)) -eq 0 ] && echo ""
done
echo ""

IFS=$'\n' sorted=($(sort -n <<<"${times[*]}")); unset IFS
count=${#sorted[@]}
p50="${sorted[$((count/2))]}"
p95="${sorted[$((count*95/100))]}"
mean=$(IFS=+; echo "${times[*]}" | bc | awk '{printf "%.0f", $1/'$count'}')

echo "  RegisterDocument: P50=${p50}ms  P95=${p95}ms  Mean=${mean}ms"
echo ""
echo "=== RESULTS TO RECORD ==="
echo "| ${RTT}ms ($([ $RTT -eq 50 ] && echo regional || ([ $RTT -eq 100 ] && echo national || echo international))) | $TPS_MEAN | $p50 | $p95 |"

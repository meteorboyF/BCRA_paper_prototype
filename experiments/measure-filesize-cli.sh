#!/usr/bin/env bash
# Experiment 3 — File Size Impact on Latency (CLI path, no WebClient)
# Measures IPFS upload (direct Kubo API) and Fabric commit (CLI) separately.
# Total P50 = IPFS P50 + Fabric CLI P50 (additive decomposition)
#
# Usage: bash experiments/measure-filesize-cli.sh
# No JWT needed — uses direct IPFS API (port 5001) + fabric-cli container.
set -euo pipefail

ORDERER_TLS="/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/pangochain.com/orderers/orderer1.pangochain.com/tls/ca.crt"
CRYPTO_BASE="/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto"
IPFS_API_PRIMARY="http://localhost:5001"
IPFS_API_SECONDARY="http://localhost:5002"
REPS=10
SIZES_MB=(1 5 10 20 30 50)

echo "=== Experiment 3 — File Size Impact on Latency (CLI path) ==="
echo "Date: $(date -Iseconds)"
echo "Method: IPFS direct Kubo API (port 5001+5002) + Fabric CLI RegisterDocument"
echo "Samples per size: $REPS"
echo ""

# --- Part A: Fabric CLI baseline (10 samples) ---
echo "--- Part A: Fabric CLI RegisterDocument baseline (10 samples) ---"
declare -a fab_times
for i in $(seq 1 10); do
  START=$(date +%s%3N)
  OUT=$(docker exec fabric-cli peer chaincode invoke \
    -C legal-channel -n legalcc \
    -o orderer1.pangochain.com:7050 \
    --tls --cafile "$ORDERER_TLS" \
    --waitForEvent --waitForEventTimeout 15s \
    --peerAddresses peer0.firma.pangochain.com:7051 \
    --tlsRootCertFiles "${CRYPTO_BASE}/peerOrganizations/firma.pangochain.com/peers/peer0.firma.pangochain.com/tls/ca.crt" \
    --peerAddresses peer0.firmb.pangochain.com:8051 \
    --tlsRootCertFiles "${CRYPTO_BASE}/peerOrganizations/firmb.pangochain.com/peers/peer0.firmb.pangochain.com/tls/ca.crt" \
    -c "{\"function\":\"RegisterDocument\",\"Args\":[\"exp3-fab-${i}\",\"case-exp3-001\",\"hash${i}abc\",\"QmExp3${i}\",\"user-exp3\",\"FirmAMSP\",\"2026-05-22T10:00:00Z\"]}" 2>&1)
  END=$(date +%s%3N)
  ELAPSED=$((END - START))
  if echo "$OUT" | grep -q "invoke successful"; then
    fab_times+=($ELAPSED)
    echo "  Fabric sample $i/10: ${ELAPSED}ms  OK"
  else
    echo "  Fabric sample $i/10: FAIL"
  fi
done

FAB_CONSTANT=$(python3 - "${fab_times[@]}" <<'PYEOF'
import sys
times = [int(x) for x in sys.argv[1:]]
if times:
    s = sorted(times)
    n = len(s)
    p50 = s[n//2]
    p95 = s[min(int(n*0.95), n-1)]
    print(p50)
else:
    print(2132)
PYEOF
)

echo ""
python3 - "$FAB_CONSTANT" "${fab_times[@]}" <<'PYEOF'
import sys
fab_p50 = int(sys.argv[1])
times = [int(x) for x in sys.argv[2:]]
s = sorted(times)
n = len(s)
p50 = s[n//2]
p95 = s[min(int(n*0.95), n-1)]
print(f"Fabric CLI constant: n={n} P50={p50}ms P95={p95}ms Mean={sum(times)/n:.0f}ms")
PYEOF
echo ""

# --- Part B: IPFS direct upload per file size ---
echo "--- Part B: IPFS direct upload per file size ---"
echo ""

declare -A ipfs_p50 ipfs_p95 ipfs_mean total_p50 total_p95

for SIZE_MB in "${SIZES_MB[@]}"; do
  TMPFILE="/tmp/exp3-${SIZE_MB}mb.bin"
  echo "--- ${SIZE_MB}MB ---"
  echo -n "  Generating ${SIZE_MB}MB random file... "
  dd if=/dev/urandom of="$TMPFILE" bs=1M count="$SIZE_MB" 2>/dev/null
  echo "done ($(du -sh "$TMPFILE" | cut -f1))"

  declare -a ipfs_times
  for i in $(seq 1 $REPS); do
    START=$(date +%s%3N)
    # Primary upload
    HASH=$(curl -s -X POST "${IPFS_API_PRIMARY}/api/v0/add?pin=true&quieter=true" \
      -F "file=@${TMPFILE}" | python3 -c "import sys,json; print(json.load(sys.stdin).get('Hash',''))" 2>/dev/null)
    # Secondary pin
    if [ -n "$HASH" ]; then
      curl -s -X POST "${IPFS_API_SECONDARY}/api/v0/pin/add?arg=${HASH}" > /dev/null 2>&1 || true
    fi
    END=$(date +%s%3N)
    ELAPSED=$((END - START))
    if [ -n "$HASH" ]; then
      ipfs_times+=($ELAPSED)
      echo "  IPFS ${i}/${REPS}: ${ELAPSED}ms  Hash=${HASH:0:20}..."
    else
      echo "  IPFS ${i}/${REPS}: FAIL (no hash)"
    fi
  done

  STATS=$(python3 - "$SIZE_MB" "$FAB_CONSTANT" "${ipfs_times[@]}" <<'PYEOF'
import sys
size_mb = sys.argv[1]
fab_p50 = int(sys.argv[2])
times = [int(x) for x in sys.argv[3:]]
if times:
    s = sorted(times)
    n = len(s)
    p50 = s[n//2]
    p95 = s[min(int(n*0.95), n-1)]
    mean = sum(times)/n
    total_p50 = p50 + fab_p50
    total_p95 = p95 + fab_p50
    print(f"IPFS_P50={p50} IPFS_P95={p95} IPFS_MEAN={mean:.0f} TOTAL_P50={total_p50} TOTAL_P95={total_p95} n={n}")
else:
    print("FAIL")
PYEOF
)
  echo "  ${SIZE_MB}MB result: $STATS"
  echo ""

  rm -f "$TMPFILE"
  unset ipfs_times
done

echo "=== Summary ==="
echo "Fabric CLI constant P50: ${FAB_CONSTANT}ms"
echo ""
echo "| File Size | IPFS P50 (ms) | IPFS P95 (ms) | IPFS Mean (ms) | Total P50 (ms) | Total P95 (ms) |"
echo "|-----------|--------------|--------------|---------------|---------------|---------------|"
echo "(extract from STATS lines above)"
echo ""
echo "=== Experiment 3 Done ==="

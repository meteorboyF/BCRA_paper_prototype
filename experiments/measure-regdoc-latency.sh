#!/bin/bash
# Experiment 2 — RegisterDocument commit latency via peer chaincode invoke --waitForEvent
# Measures true Fabric commit latency: endorse + submit + block commit
# Note: IPFS upload (~30ms for 1MB) is excluded; BatchTimeout dominates (~2000ms)
# Usage: bash experiments/measure-regdoc-latency.sh

ORDERER_TLS="/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/pangochain.com/orderers/orderer1.pangochain.com/tls/ca.crt"
CRYPTO_BASE="/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto"
REPS=20
PREFIX="BENCH-REG-$(date +%s)"

echo "Exp2: RegisterDocument Fabric commit latency — ${REPS} samples"
echo "Method: peer chaincode invoke --waitForEvent (endorse+submit+commit)"
echo "Date: $(date -Iseconds)"
echo "Prefix: $PREFIX"
echo "======================================================"

declare -a times

for i in $(seq 1 $REPS); do
  DOCID="${PREFIX}-${i}"
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
    -c "{\"function\":\"RegisterDocument\",\"Args\":[\"${DOCID}\",\"case-bench-001\",\"benchhash${i}\",\"QmBenchIPFS${i}\",\"user-bench-001\",\"FirmAMSP\",\"2026-05-22T10:00:00Z\"]}" 2>&1)

  END=$(date +%s%3N)
  ELAPSED=$((END - START))

  if echo "$OUT" | grep -q "invoke successful"; then
    times+=($ELAPSED)
    echo "  [${i}/${REPS}] ${ELAPSED}ms  OK"
  else
    echo "  [${i}/${REPS}] FAIL: $(echo "$OUT" | grep -v '^$' | tail -1)"
  fi
done

echo ""
echo "Results:"
python3 - "${times[@]}" <<'PYEOF'
import sys
times = [int(x) for x in sys.argv[1:]]
if not times:
    print("No successful samples!")
    sys.exit(1)
n = len(times)
times_sorted = sorted(times)
mean = sum(times) / n
p50 = times_sorted[n // 2]
p95 = times_sorted[min(int(n * 0.95), n-1)]
p99 = times_sorted[min(int(n * 0.99), n-1)]
print(f"  n={n}  Mean={mean:.1f}ms  P50={p50}ms  P95={p95}ms  P99={p99}ms  Min={min(times)}ms  Max={max(times)}ms")
print(f"  Note: Excludes IPFS upload (~30ms for 1MB). BatchTimeout=2s dominates.")
PYEOF

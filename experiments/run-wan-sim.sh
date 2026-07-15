#!/bin/bash
# Experiment 5 — WAN Latency Simulation (tc netem)
# Requires: sudo access, Fabric-mode backend running, JWT token, doc+case IDs
# Usage: JWT=<token> CASE_ID=<id> DOC_ID=<id> bash experiments/run-wan-sim.sh
# Bridge: br-90e73afca350 (fabric_test Docker network)

BRIDGE="br-90e73afca350"
BASE_DIR="$(dirname "$(realpath "$0")")/.."
FABRIC_CRYPTO="/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto"
ORDERER_TLS="${FABRIC_CRYPTO}/ordererOrganizations/pangochain.com/orderers/orderer1.pangochain.com/tls/ca.crt"

[ -z "$JWT" ]     && { echo "ERROR: set JWT env var"; exit 1; }
[ -z "$CASE_ID" ] && { echo "ERROR: set CASE_ID env var"; exit 1; }
[ -z "$DOC_ID" ]  && { echo "ERROR: set DOC_ID env var"; exit 1; }

echo "=== Experiment 5 — WAN Latency Simulation ==="
echo "Date: $(date -Iseconds)"
echo "Bridge: $BRIDGE"
echo "Baseline (0ms RTT): TPS=22.3 P50=8379ms P95=14627ms @ 200 clients (Exp 1 this session)"
echo "Fabric CLI RegisterDocument baseline (0ms RTT): P50=2139ms P95=2158ms (Exp 2 this session)"
echo ""

run_tps_round() {
  local rtt=$1
  local run=$2
  echo "  TPS run $run @ ${rtt}ms RTT..."
  PANGOCHAIN_JWT_TOKEN="$JWT" PANGOCHAIN_TEST_CASE_ID="$CASE_ID" PANGOCHAIN_TEST_DOC_ID="$DOC_ID" \
    node "${BASE_DIR}/experiments/caliper/pangochain-loadtest-wan.js"
}

run_regdoc_samples() {
  local rtt=$1
  declare -a times
  echo "  RegisterDocument CLI samples @ ${rtt}ms RTT..."
  for i in $(seq 1 20); do
    START=$(date +%s%3N)
    OUT=$(docker exec fabric-cli peer chaincode invoke \
      -C legal-channel -n legalcc \
      -o orderer1.pangochain.com:7050 --tls --cafile "$ORDERER_TLS" \
      --waitForEvent --waitForEventTimeout 15s \
      --peerAddresses peer0.firma.pangochain.com:7051 \
      --tlsRootCertFiles "${FABRIC_CRYPTO}/peerOrganizations/firma.pangochain.com/peers/peer0.firma.pangochain.com/tls/ca.crt" \
      --peerAddresses peer0.firmb.pangochain.com:8051 \
      --tlsRootCertFiles "${FABRIC_CRYPTO}/peerOrganizations/firmb.pangochain.com/peers/peer0.firmb.pangochain.com/tls/ca.crt" \
      -c "{\"function\":\"RegisterDocument\",\"Args\":[\"WAN-${rtt}ms-${i}\",\"case-wan-001\",\"wanhash${i}\",\"QmWanTest${i}\",\"user-wan-001\",\"FirmAMSP\",\"2026-05-22T10:00:00Z\"]}" 2>&1)
    END=$(date +%s%3N)
    ELAPSED=$((END - START))
    if echo "$OUT" | grep -q "invoke successful"; then
      times+=($ELAPSED)
      echo "    sample $i: ${ELAPSED}ms OK"
    else
      echo "    sample $i: FAIL"
    fi
  done
  python3 - "${rtt}" "${times[@]}" <<'PYEOF'
import sys
rtt = sys.argv[1]
times = [int(x) for x in sys.argv[2:]]
if times:
    s = sorted(times)
    n = len(s)
    p50 = s[n//2]
    p95 = s[min(int(n*0.95),n-1)]
    print(f"  {rtt}ms RTT RegDoc: n={n} P50={p50}ms P95={p95}ms Mean={sum(times)/n:.0f}ms")
PYEOF
}

for RTT in 50 100 150; do
  echo "--- ${RTT}ms RTT ---"
  sudo tc qdisc add dev $BRIDGE root netem delay ${RTT}ms
  echo "  netem ${RTT}ms applied to $BRIDGE"

  # 5 TPS runs
  declare -a tps_vals
  for run in 1 2 3 4 5; do
    OUT=$(run_tps_round $RTT $run)
    echo "  $OUT"
    TPS=$(echo "$OUT" | grep -oP 'TPS=\K[0-9.]+' | head -1)
    tps_vals+=($TPS)
  done

  # Mean TPS
  python3 - "${RTT}" "${tps_vals[@]}" <<'PYEOF'
import sys
rtt = sys.argv[1]
vals = [float(x) for x in sys.argv[2:] if x]
if vals:
    print(f"  {rtt}ms RTT mean TPS across 5 runs: {sum(vals)/len(vals):.1f}")
PYEOF

  # 20 RegDoc latency samples
  run_regdoc_samples $RTT

  sudo tc qdisc del dev $BRIDGE root
  echo "  netem removed"
  sleep 5
done

echo ""
echo "=== Exp 5 Done ==="

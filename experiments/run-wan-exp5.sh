#!/usr/bin/env bash
# Experiment 5 — WAN Latency Simulation
# Usage: JWT=<token> CASE_ID=<id> DOC_ID=<id> bash experiments/run-wan-exp5.sh
set -euo pipefail

BRIDGE="br-90e73afca350"
ORDERER_TLS="/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/pangochain.com/orderers/orderer1.pangochain.com/tls/ca.crt"
CRYPTO_BASE="/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto"
REPS_TPS=5
REPS_LATENCY=20

[ -z "${JWT:-}" ]     && { echo "ERROR: set JWT"; exit 1; }
[ -z "${CASE_ID:-}" ] && { echo "ERROR: set CASE_ID"; exit 1; }
[ -z "${DOC_ID:-}" ]  && { echo "ERROR: set DOC_ID"; exit 1; }

export PANGOCHAIN_JWT_TOKEN="$JWT"
export PANGOCHAIN_TEST_CASE_ID="$CASE_ID"
export PANGOCHAIN_TEST_DOC_ID="$DOC_ID"

echo "=== Experiment 5 — WAN Latency Simulation ==="
echo "Date: $(date -Iseconds)"
echo "Bridge: $BRIDGE"
echo "JWT doc: $DOC_ID"
echo ""

cleanup() {
  echo "CLEANUP: removing netem from $BRIDGE..."
  sudo -n tc qdisc del dev "$BRIDGE" root 2>/dev/null && echo "netem removed" || echo "netem already clear"
}
trap cleanup EXIT

cd /home/angkon/Pangochain_AOOP

run_rtt() {
  local RTT=$1
  declare -a tps_vals lat_vals

  echo ""
  echo "=== RTT ${RTT}ms ==="

  # Apply / clear netem
  sudo -n tc qdisc del dev "$BRIDGE" root 2>/dev/null || true
  if [[ $RTT -gt 0 ]]; then
    sudo -n tc qdisc add dev "$BRIDGE" root netem delay "${RTT}ms"
    echo "netem ${RTT}ms applied"
    sleep 2
  else
    echo "No delay (baseline)"
  fi

  # TPS: 5 runs via WAN loadtest
  echo "Running $REPS_TPS TPS rounds at 200 clients..."
  for run in $(seq 1 $REPS_TPS); do
    echo -n "  TPS run $run/$REPS_TPS: "
    OUT=$(node experiments/caliper/pangochain-loadtest-wan.js 2>&1)
    TPS=$(echo "$OUT" | grep -oP 'TPS=\K[0-9.]+' | head -1)
    P50=$(echo "$OUT" | grep -oP 'P50=\K[0-9]+' | head -1)
    P95=$(echo "$OUT" | grep -oP 'P95=\K[0-9]+' | head -1)
    ERR=$(echo "$OUT" | grep -oP 'errors=\K[0-9]+' | head -1)
    tps_vals+=("$TPS")
    echo "TPS=$TPS P50=${P50}ms P95=${P95}ms errors=$ERR"
  done

  MEAN_TPS=$(python3 -c "
vals=[float(x) for x in '${tps_vals[*]}'.split() if x]
print(f'{sum(vals)/len(vals):.1f}' if vals else '0')
")
  echo "  Mean TPS: $MEAN_TPS"

  # RegisterDocument latency: 20 CLI samples
  echo "Running $REPS_LATENCY RegisterDocument CLI samples..."
  for i in $(seq 1 $REPS_LATENCY); do
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
      -c "{\"function\":\"RegisterDocument\",\"Args\":[\"wan-${RTT}ms-${i}\",\"case-wan-001\",\"wanhash${RTT}x${i}\",\"QmWanTest${i}\",\"user-wan-001\",\"FirmAMSP\",\"2026-05-22T10:00:00Z\"]}" 2>&1)
    END=$(date +%s%3N)
    ELAPSED=$((END - START))
    if echo "$OUT" | grep -q "invoke successful"; then
      lat_vals+=($ELAPSED)
      echo "  Lat $i/$REPS_LATENCY: ${ELAPSED}ms  OK"
    else
      echo "  Lat $i/$REPS_LATENCY: FAIL"
    fi
  done

  python3 - "$RTT" "$MEAN_TPS" "${lat_vals[@]}" <<'PYEOF'
import sys
rtt, mean_tps = sys.argv[1], sys.argv[2]
times = [int(x) for x in sys.argv[3:]]
if times:
    s = sorted(times)
    n = len(s)
    p50 = s[n//2]
    p95 = s[min(int(n*0.95), n-1)]
    mean = sum(times)/n
    print(f"\nRESULT RTT={rtt}ms: TPS={mean_tps} RegDoc P50={p50}ms P95={p95}ms n={n}")
    print(f"Raw latencies: {s}")
else:
    print(f"\nRESULT RTT={rtt}ms: TPS={mean_tps} RegDoc N/A (no successful samples)")
PYEOF

  unset tps_vals lat_vals
}

run_rtt 0
run_rtt 50
run_rtt 100
run_rtt 150

echo ""
echo "=== Experiment 5 Done ==="

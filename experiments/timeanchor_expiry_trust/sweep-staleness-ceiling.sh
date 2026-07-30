#!/usr/bin/env bash
# Experiment 17b - staleness-ceiling sweep (security vs availability).
#
# MaxAnchorStalenessSeconds is both halves of the trade-off at once:
#   availability - how long the ordering service can be unavailable before CheckAccess
#                  starts refusing otherwise-valid access decisions;
#   security     - the ceiling on how far a gateway that withholds heartbeats can backdate
#                  a proposal, which is this value plus MaxClockSkewSeconds.
#
# For each ceiling the run commits a fresh anchor, then stops feeding it and polls
# CheckAccess until the decision flips from authorised to refused. The elapsed time to that
# flip is the measured availability window; the security bound follows from it.
#
# The ceiling is a compile-time constant on purpose (a runtime-settable security ceiling
# would be reachable by the gateway it constrains), so each point requires a chaincode
# upgrade. That is why this sweeps a handful of points rather than a fine grid.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
EXP_DIR="$ROOT_DIR/experiments/timeanchor_expiry_trust"
CC_SRC="$ROOT_DIR/pangochain-chaincode/legalcc/types.go"
STAMP="$(date -u +%Y%m%d_%H%M%S)"
OUT_DIR="${PANGOCHAIN_SWEEP_OUT:-$EXP_DIR/results/sweep_$STAMP}"

CHANNEL="${PANGOCHAIN_CHANNEL:-legal-channel}"
CC="${PANGOCHAIN_CHAINCODE:-legalcc}"
CLI="${PANGOCHAIN_FABRIC_CLI:-fabric-cli}"
POLL="${PANGOCHAIN_SWEEP_POLL:-3}"

# Ceilings in seconds. 0 is the shipping default (disabled) and is deliberately LAST so the
# network and the source tree are left in the shipped configuration when the run ends.
CEILINGS=(${PANGOCHAIN_SWEEP_CEILINGS:-30 60 120 0})
# Cap on how long to wait for a refusal. For the disabled case no refusal is expected, so
# this doubles as the observation window that demonstrates reads stay available.
GIVE_UP="${PANGOCHAIN_SWEEP_GIVEUP:-200}"

# Chaincode sequence must strictly increase across upgrades; start after what is committed.
START_SEQ="${PANGOCHAIN_SWEEP_START_SEQ:-5}"

CRYPTO=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto
ORD_CA="$CRYPTO/ordererOrganizations/pangochain.com/orderers/orderer1.pangochain.com/msp/tlscacerts/tlsca.pangochain.com-cert.pem"
CA_A="$CRYPTO/peerOrganizations/firma.pangochain.com/peers/peer0.firma.pangochain.com/tls/ca.crt"
CA_B="$CRYPTO/peerOrganizations/firmb.pangochain.com/peers/peer0.firmb.pangochain.com/tls/ca.crt"
CA_R="$CRYPTO/peerOrganizations/regulator.pangochain.com/peers/peer0.regulator.pangochain.com/tls/ca.crt"

mkdir -p "$OUT_DIR"
LOG="$OUT_DIR/run.log"
CSV="$OUT_DIR/sweep.csv"
exec > >(tee -a "$LOG") 2>&1
log(){ printf '[sweep %s] %s\n' "$(date -u +%H:%M:%S)" "$*"; }

DOC="$(cat "${PANGOCHAIN_SWEEP_DOC:-$OUT_DIR/../../doc.txt}" 2>/dev/null || true)"
GRANTEE="$(cat "${PANGOCHAIN_SWEEP_GRANTEE:-$OUT_DIR/../../grantee.txt}" 2>/dev/null || true)"
[ -n "$DOC" ] && [ -n "$GRANTEE" ] || { echo "set PANGOCHAIN_SWEEP_DOC / _GRANTEE to files holding the fixture ids"; exit 1; }
CHECK="{\"function\":\"CheckAccess\",\"Args\":[\"$DOC\",\"$GRANTEE\",\"FirmBMSP\"]}"

echo "ceiling_seconds,availability_window_seconds,backdating_bound_seconds,outcome" > "$CSV"

{
  echo "{"
  echo "  \"experiment\": \"17b - staleness ceiling sweep\","
  echo "  \"timestamp_utc\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\","
  echo "  \"host\": \"$(uname -srm)\","
  echo "  \"channel\": \"$CHANNEL\", \"chaincode\": \"$CC\","
  echo "  \"max_clock_skew_seconds\": 120,"
  echo "  \"ceilings\": \"${CEILINGS[*]}\","
  echo "  \"poll_seconds\": $POLL, \"give_up_seconds\": $GIVE_UP"
  echo "}"
} > "$OUT_DIR/environment.json"

anchor(){
  docker exec "$CLI" peer chaincode invoke -o orderer1.pangochain.com:7050 --tls --cafile "$ORD_CA" \
    -C "$CHANNEL" -n "$CC" --waitForEvent \
    --peerAddresses peer0.firma.pangochain.com:7051 --tlsRootCertFiles "$CA_A" \
    --peerAddresses peer0.firmb.pangochain.com:8051 --tlsRootCertFiles "$CA_B" \
    --peerAddresses peer0.regulator.pangochain.com:9051 --tlsRootCertFiles "$CA_R" \
    -c '{"function":"UpdateTimeAnchor","Args":[]}' 2>&1 | grep -c "status:200" || true
}

seq_no="$START_SEQ"
for ceiling in "${CEILINGS[@]}"; do
  log "=== ceiling ${ceiling}s (chaincode seq ${seq_no}) ==="
  sed -i "s/^\tMaxAnchorStalenessSeconds = .*/\tMaxAnchorStalenessSeconds = ${ceiling}/" "$CC_SRC"
  grep -n "MaxAnchorStalenessSeconds = " "$CC_SRC" | head -1

  ( cd "$ROOT_DIR/pangochain-fabric" && \
    CC_VERSION="1.$((seq_no+10))" CC_SEQUENCE="$seq_no" bash scripts/deploy-chaincode.sh ) \
    > "$OUT_DIR/deploy_ceiling_${ceiling}.log" 2>&1 \
    || { log "deploy failed for ceiling ${ceiling}; see deploy_ceiling_${ceiling}.log"; seq_no=$((seq_no+1)); continue; }

  # Fresh anchor, then stop feeding it: from here the anchor ages in real time.
  if [ "$(anchor)" != "1" ]; then
    log "  heartbeat did not commit; skipping this point"
    seq_no=$((seq_no+1)); continue
  fi
  t0=$(date -u +%s)
  log "  anchor committed; polling CheckAccess every ${POLL}s (give up at ${GIVE_UP}s)"

  window=""
  while :; do
    elapsed=$(( $(date -u +%s) - t0 ))
    if [ "$elapsed" -ge "$GIVE_UP" ]; then break; fi
    out="$(docker exec "$CLI" peer chaincode query -C "$CHANNEL" -n "$CC" -c "$CHECK" 2>&1 || true)"
    if echo "$out" | grep -q "stale relative to this proposal"; then
      window="$elapsed"
      log "  REFUSED after ${elapsed}s (staleness ceiling enforced)"
      break
    fi
    sleep "$POLL"
  done

  if [ -n "$window" ]; then
    printf '%s,%s,%s,%s\n' "$ceiling" "$window" "$((window + 120))" "refused" >> "$CSV"
  else
    log "  still authorising after ${GIVE_UP}s - no ceiling enforced"
    printf '%s,,,%s\n' "$ceiling" "no_refusal_within_${GIVE_UP}s" >> "$CSV"
  fi
  seq_no=$((seq_no+1))
done

log "sweep complete. results:"; column -t -s, "$CSV" | sed 's/^/    /'
log "source left at MaxAnchorStalenessSeconds = $(grep -oP 'MaxAnchorStalenessSeconds = \K[0-9]+' "$CC_SRC" | head -1)"
log "raw evidence in $OUT_DIR"

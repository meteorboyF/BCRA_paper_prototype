#!/usr/bin/env bash
# V1 Phase B — BatchTimeout sensitivity at peak client level (conc=50).
# Rebuilds the Fabric network at BatchTimeout=500ms then 250ms (MaxMessageCount stays 500),
# measuring conc=50 x5 with BOTH tools: configurable (fixed-duration 60s) and exp1-round
# (fixed-count). Restores BatchTimeout=2s at the end. Appends to results/exp1_throughput.csv.
set -uo pipefail
REPO=/home/angkon/Pangochain_AOOP
FAB=$REPO/pangochain-fabric
CSV=$REPO/results/exp1_throughput.csv
CONFIGTX=$FAB/configtx.yaml
ORDERER_TLS=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/pangochain.com/orderers/orderer1.pangochain.com/tls/ca.crt
CB=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto
CONF=$REPO/experiments/caliper/pangochain-loadtest-configurable.js
ROUND=$REPO/experiments/exp1-round.js
cd "$REPO"
log(){ echo "[B $(date +%H:%M:%S)] $*"; }

regen_artifacts(){
  rm -f "$FAB/channel-artifacts/genesis.block" "$FAB/channel-artifacts/legal-channel.block" \
        "$FAB/channel-artifacts/legal-channel.tx" "$FAB/channel-artifacts/"*anchors.tx
  docker run --rm -v "$FAB:/workspace" -w /workspace hyperledger/fabric-tools:2.4 bash -c "
    export FABRIC_CFG_PATH=/workspace; mkdir -p /workspace/channel-artifacts
    configtxgen -profile LegalOrdererGenesis -channelID system-channel -outputBlock /workspace/channel-artifacts/genesis.block
    configtxgen -profile LegalChannel -outputCreateChannelTx /workspace/channel-artifacts/legal-channel.tx -channelID legal-channel
    configtxgen -profile LegalChannel -outputAnchorPeersUpdate /workspace/channel-artifacts/FirmAMSPanchors.tx -channelID legal-channel -asOrg FirmAMSP
    configtxgen -profile LegalChannel -outputAnchorPeersUpdate /workspace/channel-artifacts/FirmBMSPanchors.tx -channelID legal-channel -asOrg FirmBMSP
    configtxgen -profile LegalChannel -outputAnchorPeersUpdate /workspace/channel-artifacts/RegulatorMSPanchors.tx -channelID legal-channel -asOrg RegulatorMSP" 2>&1 | tail -3
}
join_deploy(){
  docker exec fabric-cli peer channel create -o orderer1.pangochain.com:7050 -c legal-channel \
    -f "${CB}/../channel-artifacts/legal-channel.tx" --tls --cafile "$ORDERER_TLS" \
    --outputBlock "${CB}/../channel-artifacts/legal-channel.block" 2>&1 | tail -1 || return 1
  docker exec fabric-cli peer channel join -b "${CB}/../channel-artifacts/legal-channel.block" 2>&1 | tail -1
  docker exec -e CORE_PEER_ADDRESS=peer0.firmb.pangochain.com:8051 -e CORE_PEER_LOCALMSPID=FirmBMSP \
    -e "CORE_PEER_TLS_ROOTCERT_FILE=${CB}/peerOrganizations/firmb.pangochain.com/peers/peer0.firmb.pangochain.com/tls/ca.crt" \
    -e "CORE_PEER_MSPCONFIGPATH=${CB}/peerOrganizations/firmb.pangochain.com/users/Admin@firmb.pangochain.com/msp" \
    fabric-cli peer channel join -b "${CB}/../channel-artifacts/legal-channel.block" 2>&1 | tail -1
  docker exec -e CORE_PEER_ADDRESS=peer0.regulator.pangochain.com:9051 -e CORE_PEER_LOCALMSPID=RegulatorMSP \
    -e "CORE_PEER_TLS_ROOTCERT_FILE=${CB}/peerOrganizations/regulator.pangochain.com/peers/peer0.regulator.pangochain.com/tls/ca.crt" \
    -e "CORE_PEER_MSPCONFIGPATH=${CB}/peerOrganizations/regulator.pangochain.com/users/Admin@regulator.pangochain.com/msp" \
    fabric-cli peer channel join -b "${CB}/../channel-artifacts/legal-channel.block" 2>&1 | tail -1
  # Anchor-peer updates — REQUIRED for cross-org gateway service discovery (endorsement policy).
  # Without these, the backend gateway write path fails with FAILED_PRECONDITION (no peer combination).
  docker exec fabric-cli peer channel update -o orderer1.pangochain.com:7050 -c legal-channel \
    -f "${CB}/../channel-artifacts/FirmAMSPanchors.tx" --tls --cafile "$ORDERER_TLS" 2>&1 | tail -1
  docker exec -e CORE_PEER_ADDRESS=peer0.firmb.pangochain.com:8051 -e CORE_PEER_LOCALMSPID=FirmBMSP \
    -e "CORE_PEER_TLS_ROOTCERT_FILE=${CB}/peerOrganizations/firmb.pangochain.com/peers/peer0.firmb.pangochain.com/tls/ca.crt" \
    -e "CORE_PEER_MSPCONFIGPATH=${CB}/peerOrganizations/firmb.pangochain.com/users/Admin@firmb.pangochain.com/msp" \
    fabric-cli peer channel update -o orderer1.pangochain.com:7050 -c legal-channel \
    -f "${CB}/../channel-artifacts/FirmBMSPanchors.tx" --tls --cafile "$ORDERER_TLS" 2>&1 | tail -1
  docker exec -e CORE_PEER_ADDRESS=peer0.regulator.pangochain.com:9051 -e CORE_PEER_LOCALMSPID=RegulatorMSP \
    -e "CORE_PEER_TLS_ROOTCERT_FILE=${CB}/peerOrganizations/regulator.pangochain.com/peers/peer0.regulator.pangochain.com/tls/ca.crt" \
    -e "CORE_PEER_MSPCONFIGPATH=${CB}/peerOrganizations/regulator.pangochain.com/users/Admin@regulator.pangochain.com/msp" \
    fabric-cli peer channel update -o orderer1.pangochain.com:7050 -c legal-channel \
    -f "${CB}/../channel-artifacts/RegulatorMSPanchors.tx" --tls --cafile "$ORDERER_TLS" 2>&1 | tail -1
  bash "$FAB/scripts/deploy-chaincode.sh" 2>&1 | tail -4 || return 1
}
rebuild(){  # rebuild <timeout-str e.g 500ms>
  local ts=$1
  log "rebuild network @ BatchTimeout=$ts"
  sed -i "s/BatchTimeout: [0-9a-z.]*/BatchTimeout: ${ts}/" "$CONFIGTX"; grep BatchTimeout "$CONFIGTX"
  (cd "$FAB" && docker compose -f docker-compose.fabric.yml down -v --remove-orphans 2>&1 | tail -1 || true)
  docker rm -f legalcc 2>/dev/null || true
  regen_artifacts
  (cd "$FAB" && docker compose -f docker-compose.fabric.yml up -d 2>&1 | tail -1)
  log "waiting 30s for peers..."; sleep 30
  join_deploy || { log "join/deploy FAILED for $ts"; return 1; }
  log "chaincode deployed @ $ts"
}
restart_backend(){
  local pid; pid=$(pgrep -f "java -jar target/pangochain-backend-2.0.0.jar" | head -1); [ -n "$pid" ] && kill "$pid"; sleep 5
  bash /tmp/launch-backend.sh
  for i in $(seq 1 40); do curl -sf http://localhost:8080/actuator/health 2>/dev/null|grep -q UP && { log "backend healthy"; return 0; }; sleep 3; done
  log "backend did NOT become healthy"; return 1
}
setup_data(){ local OUT; OUT=$(python3 experiments/setup-bench-data.py 2>/tmp/b_setup.err) || { cat /tmp/b_setup.err; return 1; }; eval "$OUT"; export PANGOCHAIN_JWT_TOKEN PANGOCHAIN_TEST_CASE_ID PANGOCHAIN_TEST_DOC_ID; [ -n "${PANGOCHAIN_JWT_TOKEN:-}" ]; }

measure(){  # measure <bt_ms>
  local bt=$1 L t
  log "warmup (configurable conc=10 30s)"; PANGOCHAIN_CONCURRENCY=10 PANGOCHAIN_DURATION_SEC=30 node "$CONF" >/dev/null 2>&1
  for t in 1 2 3 4 5; do
    L=$(PANGOCHAIN_CONCURRENCY=50 PANGOCHAIN_DURATION_SEC=60 node "$CONF" 2>&1)
    TPS=$(grep -oP 'TPS=\K[0-9.]+'<<<"$L"); P50=$(grep -oP 'P50=\K[0-9]+'<<<"$L"); P95=$(grep -oP 'P95=\K[0-9]+'<<<"$L"); ERR=$(grep -oP 'errors=\K[0-9]+'<<<"$L")
    echo "exp1,fabric,$bt,duration60s,50,$t,${TPS:-0},${P50:-NA},${P95:-NA},${ERR:-NA},NA,60,NA,NA,gateway,linux_x86_64" >> "$CSV"
    log "  dur60 trial $t: $L"; sleep 8
  done
  for t in 1 2 3 4 5; do
    L=$(PANGOCHAIN_CONCURRENCY=50 node "$ROUND" 2>&1)
    TPS=$(grep -oP 'TPS=\K[0-9.]+'<<<"$L"); P50=$(grep -oP 'P50=\K[0-9]+'<<<"$L"); P95=$(grep -oP 'P95=\K[0-9]+'<<<"$L"); ERR=$(grep -oP 'errors=\K[0-9]+'<<<"$L"); SU=$(grep -oP 'success=\K[0-9]+'<<<"$L"); EL=$(grep -oP 'elapsed=\K[0-9.]+'<<<"$L")
    echo "exp1,fabric,$bt,fixedcount_x10,50,$t,${TPS:-0},${P50:-NA},${P95:-NA},${ERR:-NA},${SU:-NA},${EL:-NA},NA,NA,gateway,linux_x86_64" >> "$CSV"
    log "  fixedcount trial $t: $L"; sleep 8
  done
}

for spec in 500ms:500 250ms:250; do
  TS=${spec%%:*}; BT=${spec##*:}
  log "================= BatchTimeout=$TS ================="
  rebuild "$TS" || { log "SKIP $TS (rebuild failed)"; continue; }
  restart_backend || { log "SKIP $TS (backend)"; continue; }
  setup_data || { log "SKIP $TS (data)"; continue; }
  # verify a gateway commit
  curl -s -o /dev/null -w "" -X POST http://localhost:8080/api/documents/upload -H "Authorization: Bearer $PANGOCHAIN_JWT_TOKEN" -H 'Content-Type: application/json' \
    -d "{\"caseId\":\"$PANGOCHAIN_TEST_CASE_ID\",\"fileName\":\"v.bin\",\"ivBase64\":\"AAAAAAAAAAAAAAAA\",\"ciphertextBase64\":\"AAAA\",\"documentHashSha256\":\"$(printf '0%.0s' {1..64})\",\"wrappedKeyTokenForOwner\":\"$(printf 'A%.0s' {1..125})\"}"
  measure "$BT"
done

log "================= restore BatchTimeout=2s ================="
rebuild "2s" && restart_backend && { setup_data && log "restored, gateway up"; } || log "WARN restore incomplete"
log "=== Phase B complete ==="

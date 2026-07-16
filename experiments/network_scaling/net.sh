#!/usr/bin/env bash
# Experiment 13 — generic network lifecycle for generated topologies.
#
#   net.sh up   <topology_dir>                 # artifacts + containers + channel
#   net.sh cc   <topology_dir> [policy]        # deploy legalcc (ccaas); policy = majority|single
#   net.sh down <topology_dir>                 # full teardown incl. volumes
#
# Patterned on pangochain-fabric/scripts/{generate-artifacts,start-network,
# deploy-chaincode}.sh, generalized to N orgs x P peers via topology.json.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CMD="${1:?usage: net.sh up|cc|down <topology_dir> [policy]}"
TOPO_DIR="$(cd "${2:?topology dir required}" && pwd)"
CHANNEL="legal-channel"
CC_NAME="legalcc"; CC_VERSION="1.0"; CC_SEQUENCE=1; CC_LABEL="${CC_NAME}_${CC_VERSION}"
PROJECT="netscale"

log(){ printf '[net %s] %s\n' "$(date -u +%H:%M:%S)" "$*"; }
topo(){ python3 -c "import json;t=json.load(open('$TOPO_DIR/topology.json'));print($1)"; }

N_ORGS="$(topo "t['orgs']")"
N_PEERS="$(topo "t['peers_per_org']")"
DOMAIN="$(topo "t['domain']")"

CLI_BASE="/opt/gopath/src/github.com/hyperledger/fabric/peer"
ORDERER_TLS="$CLI_BASE/crypto/ordererOrganizations/$DOMAIN/orderers/orderer1.$DOMAIN/tls/ca.crt"

# docker exec env for org $1 peer $2
peer_env(){
  local dom="org$1.$DOMAIN"
  echo "-e CORE_PEER_ADDRESS=peer$2.$dom:7051 \
        -e CORE_PEER_LOCALMSPID=Org$1MSP \
        -e CORE_PEER_TLS_ROOTCERT_FILE=$CLI_BASE/crypto/peerOrganizations/$dom/peers/peer$2.$dom/tls/ca.crt \
        -e CORE_PEER_MSPCONFIGPATH=$CLI_BASE/crypto/peerOrganizations/$dom/users/Admin@$dom/msp"
}

case "$CMD" in
up)
  log "generating artifacts for $N_ORGS orgs x $N_PEERS peers"
  docker run --rm -v "$TOPO_DIR:/workspace" -w /workspace hyperledger/fabric-tools:2.4 bash -c '
    set -e
    export FABRIC_CFG_PATH=/workspace
    cryptogen generate --config=/workspace/crypto-config.yaml --output=/workspace/crypto-config
    mkdir -p /workspace/channel-artifacts
    configtxgen -profile LegalOrdererGenesis -channelID system-channel \
      -outputBlock /workspace/channel-artifacts/genesis.block
    configtxgen -profile LegalChannel -outputCreateChannelTx \
      /workspace/channel-artifacts/legal-channel.tx -channelID legal-channel
    for i in $(seq 1 '"$N_ORGS"'); do
      configtxgen -profile LegalChannel \
        -outputAnchorPeersUpdate /workspace/channel-artifacts/Org${i}MSPanchors.tx \
        -channelID legal-channel -asOrg Org${i}MSP
    done'

  log "starting containers"
  docker compose -p "$PROJECT" -f "$TOPO_DIR/docker-compose.yml" up -d
  log "waiting 20s for peers and orderers"
  sleep 20

  log "creating $CHANNEL"
  docker exec fabric-cli peer channel create -o "orderer1.$DOMAIN:7050" -c "$CHANNEL" \
    -f "$CLI_BASE/channel-artifacts/legal-channel.tx" \
    --tls --cafile "$ORDERER_TLS" \
    --outputBlock "$CLI_BASE/channel-artifacts/legal-channel.block"

  for i in $(seq 1 "$N_ORGS"); do
    for p in $(seq 0 $((N_PEERS - 1))); do
      log "joining peer$p.org$i"
      # shellcheck disable=SC2046
      docker exec $(peer_env "$i" "$p") fabric-cli peer channel join \
        -b "$CLI_BASE/channel-artifacts/legal-channel.block"
    done
    log "anchor peer update org$i"
    # shellcheck disable=SC2046
    docker exec $(peer_env "$i" 0) fabric-cli peer channel update \
      -o "orderer1.$DOMAIN:7050" -c "$CHANNEL" \
      -f "$CLI_BASE/channel-artifacts/Org${i}MSPanchors.tx" \
      --tls --cafile "$ORDERER_TLS"
  done
  log "network up: $N_ORGS orgs x $N_PEERS peers on $CHANNEL"
  ;;

cc)
  POLICY="${3:-majority}"
  POLICY_ARGS=()
  if [[ "$POLICY" == "single" ]]; then
    POLICY_ARGS=(--signature-policy "OR('Org1MSP.peer')")
  fi
  log "deploying $CC_NAME (endorsement policy: $POLICY)"

  docker image inspect pangochain/legalcc:latest >/dev/null 2>&1 || \
    docker build -t pangochain/legalcc:latest "$ROOT_DIR/pangochain-chaincode/legalcc"

  TMP_PKG=$(mktemp -d)
  printf '{"address":"legalcc:7777","dial_timeout":"10s","tls_required":false}' > "$TMP_PKG/connection.json"
  printf '{"type":"ccaas","label":"%s"}' "$CC_LABEL" > "$TMP_PKG/metadata.json"
  (cd "$TMP_PKG" && tar czf code.tar.gz connection.json && tar czf "$CC_LABEL.tar.gz" metadata.json code.tar.gz)
  docker cp "$TMP_PKG/$CC_LABEL.tar.gz" "fabric-cli:/tmp/$CC_LABEL.tar.gz"
  rm -rf "$TMP_PKG"

  for i in $(seq 1 "$N_ORGS"); do
    for p in $(seq 0 $((N_PEERS - 1))); do
      log "installing on peer$p.org$i"
      # shellcheck disable=SC2046
      docker exec $(peer_env "$i" "$p") fabric-cli peer lifecycle chaincode install "/tmp/$CC_LABEL.tar.gz"
    done
  done

  PACKAGE_ID="$(docker exec fabric-cli peer lifecycle chaincode queryinstalled --output json \
    | python3 -c "import sys,json;d=json.load(sys.stdin);print(next(c['package_id'] for c in d['installed_chaincodes'] if '$CC_LABEL' in c['label']))")"
  log "package id: $PACKAGE_ID"

  for i in $(seq 1 "$N_ORGS"); do
    log "approving for org$i"
    # shellcheck disable=SC2046
    docker exec $(peer_env "$i" 0) fabric-cli peer lifecycle chaincode approveformyorg \
      -o "orderer1.$DOMAIN:7050" --channelID "$CHANNEL" --name "$CC_NAME" \
      --version "$CC_VERSION" --package-id "$PACKAGE_ID" --sequence "$CC_SEQUENCE" \
      --tls --cafile "$ORDERER_TLS" "${POLICY_ARGS[@]}"
  done

  COMMIT_PEERS=()
  for i in $(seq 1 "$N_ORGS"); do
    dom="org$i.$DOMAIN"
    COMMIT_PEERS+=(--peerAddresses "peer0.$dom:7051" \
      --tlsRootCertFiles "$CLI_BASE/crypto/peerOrganizations/$dom/peers/peer0.$dom/tls/ca.crt")
  done
  log "committing definition"
  docker exec fabric-cli peer lifecycle chaincode commit \
    -o "orderer1.$DOMAIN:7050" --channelID "$CHANNEL" --name "$CC_NAME" \
    --version "$CC_VERSION" --sequence "$CC_SEQUENCE" \
    --tls --cafile "$ORDERER_TLS" "${POLICY_ARGS[@]}" "${COMMIT_PEERS[@]}"

  docker rm -f legalcc 2>/dev/null || true
  docker run -d --name legalcc --network fabric_test \
    -e CHAINCODE_ID="$PACKAGE_ID" -e CHAINCODE_SERVER_ADDRESS="0.0.0.0:7777" \
    pangochain/legalcc:latest >/dev/null
  sleep 5

  log "smoke: RegisterCase"
  docker exec fabric-cli peer chaincode invoke \
    -o "orderer1.$DOMAIN:7050" --channelID "$CHANNEL" --name "$CC_NAME" \
    --tls --cafile "$ORDERER_TLS" "${COMMIT_PEERS[@]}" \
    -c '{"function":"RegisterCase","Args":["CASE-SMOKE-NS","ORG1","Netscale Smoke","admin","2024-01-01T00:00:00Z"]}'
  log "chaincode deployed (policy: $POLICY)"
  ;;

down)
  log "tearing down"
  docker rm -f legalcc 2>/dev/null || true
  docker compose -p "$PROJECT" -f "$TOPO_DIR/docker-compose.yml" down -v --remove-orphans 2>/dev/null || true
  docker run --rm -v "$TOPO_DIR:/workspace" alpine \
    sh -c "rm -rf /workspace/crypto-config /workspace/channel-artifacts" 2>/dev/null || true
  ;;

*) echo "unknown command: $CMD" >&2; exit 1 ;;
esac

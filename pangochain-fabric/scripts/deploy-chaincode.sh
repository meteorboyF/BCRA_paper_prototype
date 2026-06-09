#!/bin/bash
# Deploy legalcc chaincode as an external chaincode server (ccaas pattern).
# The chaincode runs as its own Docker container; peers connect to it via TCP.

set -euo pipefail

export MSYS_NO_PATHCONV=1

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NETWORK_DIR="$(dirname "$SCRIPT_DIR")"
CHAINCODE_DIR="${NETWORK_DIR}/../pangochain-chaincode/legalcc"
CC_NAME="legalcc"
CC_VERSION="1.0"
CC_SEQUENCE=1
CHANNEL="legal-channel"
CC_LABEL="${CC_NAME}_${CC_VERSION}"
NETWORK_NAME="fabric_test"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
log()  { echo -e "${GREEN}[+]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
die()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }

ORDERER_TLS="/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/pangochain.com/orderers/orderer1.pangochain.com/tls/ca.crt"
CRYPTO_BASE="/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto"

# ─── 1. Build the chaincode Docker image ──────────────────────────────────────
log "Building legalcc Docker image..."
docker build -t pangochain/legalcc:latest "$CHAINCODE_DIR"

# ─── 2. Create ccaas connection package ───────────────────────────────────────
log "Creating ccaas package..."
TMP_PKG=$(mktemp -d)

cat > "${TMP_PKG}/connection.json" <<'EOF'
{
  "address": "legalcc:7777",
  "dial_timeout": "10s",
  "tls_required": false
}
EOF

cat > "${TMP_PKG}/metadata.json" <<EOF
{
  "type": "ccaas",
  "label": "${CC_LABEL}"
}
EOF

(cd "${TMP_PKG}" && tar czf code.tar.gz connection.json)
(cd "${TMP_PKG}" && tar czf "/tmp/${CC_LABEL}.tar.gz" metadata.json code.tar.gz)

CC_PACKAGE="/tmp/${CC_LABEL}.tar.gz"
log "Package ready: ${CC_PACKAGE}"

# ─── 3. Copy package into CLI container and install on all peers ───────────────
log "Copying package to CLI container..."
docker cp "${CC_PACKAGE}" fabric-cli:/tmp/${CC_LABEL}.tar.gz

log "Installing chaincode on peer0.firma..."
docker exec fabric-cli peer lifecycle chaincode install /tmp/${CC_LABEL}.tar.gz

log "Installing chaincode on peer0.firmb..."
docker exec \
  -e CORE_PEER_ADDRESS=peer0.firmb.pangochain.com:8051 \
  -e CORE_PEER_LOCALMSPID=FirmBMSP \
  -e CORE_PEER_TLS_ROOTCERT_FILE="${CRYPTO_BASE}/peerOrganizations/firmb.pangochain.com/peers/peer0.firmb.pangochain.com/tls/ca.crt" \
  -e CORE_PEER_MSPCONFIGPATH="${CRYPTO_BASE}/peerOrganizations/firmb.pangochain.com/users/Admin@firmb.pangochain.com/msp" \
  fabric-cli peer lifecycle chaincode install /tmp/${CC_LABEL}.tar.gz

log "Installing chaincode on peer0.regulator..."
docker exec \
  -e CORE_PEER_ADDRESS=peer0.regulator.pangochain.com:9051 \
  -e CORE_PEER_LOCALMSPID=RegulatorMSP \
  -e CORE_PEER_TLS_ROOTCERT_FILE="${CRYPTO_BASE}/peerOrganizations/regulator.pangochain.com/peers/peer0.regulator.pangochain.com/tls/ca.crt" \
  -e CORE_PEER_MSPCONFIGPATH="${CRYPTO_BASE}/peerOrganizations/regulator.pangochain.com/users/Admin@regulator.pangochain.com/msp" \
  fabric-cli peer lifecycle chaincode install /tmp/${CC_LABEL}.tar.gz

# ─── 4. Get Package ID ────────────────────────────────────────────────────────
log "Querying installed chaincodes..."
PACKAGE_ID=$(docker exec fabric-cli peer lifecycle chaincode queryinstalled --output json \
  | python3 -c "
import sys, json
data = json.load(sys.stdin)
for cc in data.get('installed_chaincodes', []):
    if '${CC_LABEL}' in cc.get('label',''):
        print(cc['package_id'])
        break
")
[ -z "$PACKAGE_ID" ] && die "Could not determine package ID after install"
log "Package ID: ${PACKAGE_ID}"

# ─── 5. Approve for each org ──────────────────────────────────────────────────
log "Approving chaincode for FirmA..."
docker exec fabric-cli peer lifecycle chaincode approveformyorg \
  -o orderer1.pangochain.com:7050 --channelID "$CHANNEL" --name "$CC_NAME" \
  --version "$CC_VERSION" --package-id "$PACKAGE_ID" --sequence "$CC_SEQUENCE" \
  --tls --cafile "$ORDERER_TLS"

log "Approving chaincode for FirmB..."
docker exec \
  -e CORE_PEER_ADDRESS=peer0.firmb.pangochain.com:8051 \
  -e CORE_PEER_LOCALMSPID=FirmBMSP \
  -e CORE_PEER_TLS_ROOTCERT_FILE="${CRYPTO_BASE}/peerOrganizations/firmb.pangochain.com/peers/peer0.firmb.pangochain.com/tls/ca.crt" \
  -e CORE_PEER_MSPCONFIGPATH="${CRYPTO_BASE}/peerOrganizations/firmb.pangochain.com/users/Admin@firmb.pangochain.com/msp" \
  fabric-cli peer lifecycle chaincode approveformyorg \
  -o orderer1.pangochain.com:7050 --channelID "$CHANNEL" --name "$CC_NAME" \
  --version "$CC_VERSION" --package-id "$PACKAGE_ID" --sequence "$CC_SEQUENCE" \
  --tls --cafile "$ORDERER_TLS"

log "Approving chaincode for Regulator..."
docker exec \
  -e CORE_PEER_ADDRESS=peer0.regulator.pangochain.com:9051 \
  -e CORE_PEER_LOCALMSPID=RegulatorMSP \
  -e CORE_PEER_TLS_ROOTCERT_FILE="${CRYPTO_BASE}/peerOrganizations/regulator.pangochain.com/peers/peer0.regulator.pangochain.com/tls/ca.crt" \
  -e CORE_PEER_MSPCONFIGPATH="${CRYPTO_BASE}/peerOrganizations/regulator.pangochain.com/users/Admin@regulator.pangochain.com/msp" \
  fabric-cli peer lifecycle chaincode approveformyorg \
  -o orderer1.pangochain.com:7050 --channelID "$CHANNEL" --name "$CC_NAME" \
  --version "$CC_VERSION" --package-id "$PACKAGE_ID" --sequence "$CC_SEQUENCE" \
  --tls --cafile "$ORDERER_TLS"

# ─── 6. Check commit readiness ────────────────────────────────────────────────
log "Checking commit readiness..."
docker exec fabric-cli peer lifecycle chaincode checkcommitreadiness \
  --channelID "$CHANNEL" --name "$CC_NAME" --version "$CC_VERSION" \
  --sequence "$CC_SEQUENCE" --output json

# ─── 7. Commit chaincode definition ───────────────────────────────────────────
log "Committing chaincode definition..."
docker exec fabric-cli peer lifecycle chaincode commit \
  -o orderer1.pangochain.com:7050 --channelID "$CHANNEL" --name "$CC_NAME" \
  --version "$CC_VERSION" --sequence "$CC_SEQUENCE" \
  --tls --cafile "$ORDERER_TLS" \
  --peerAddresses peer0.firma.pangochain.com:7051 \
  --tlsRootCertFiles "${CRYPTO_BASE}/peerOrganizations/firma.pangochain.com/peers/peer0.firma.pangochain.com/tls/ca.crt" \
  --peerAddresses peer0.firmb.pangochain.com:8051 \
  --tlsRootCertFiles "${CRYPTO_BASE}/peerOrganizations/firmb.pangochain.com/peers/peer0.firmb.pangochain.com/tls/ca.crt" \
  --peerAddresses peer0.regulator.pangochain.com:9051 \
  --tlsRootCertFiles "${CRYPTO_BASE}/peerOrganizations/regulator.pangochain.com/peers/peer0.regulator.pangochain.com/tls/ca.crt"

# ─── 8. Start chaincode server container ──────────────────────────────────────
log "Starting legalcc server container..."
docker rm -f legalcc 2>/dev/null || true
docker run -d \
  --name legalcc \
  --network "$NETWORK_NAME" \
  -e CHAINCODE_ID="$PACKAGE_ID" \
  -e CHAINCODE_SERVER_ADDRESS="0.0.0.0:7777" \
  pangochain/legalcc:latest

log ""
log "════════════════════════════════════════════════════════"
log "  legalcc deployed on legal-channel"
log "  Package ID: ${PACKAGE_ID}"
log "════════════════════════════════════════════════════════"

# ─── 9. Smoke test ────────────────────────────────────────────────────────────
log "Waiting 5s for chaincode server to start..."
sleep 5

log "Smoke test: RegisterCase..."
docker exec fabric-cli peer chaincode invoke \
  -o orderer1.pangochain.com:7050 --channelID "$CHANNEL" --name "$CC_NAME" \
  --tls --cafile "$ORDERER_TLS" \
  --peerAddresses peer0.firma.pangochain.com:7051 \
  --tlsRootCertFiles "${CRYPTO_BASE}/peerOrganizations/firma.pangochain.com/peers/peer0.firma.pangochain.com/tls/ca.crt" \
  -c '{"function":"RegisterCase","Args":["CASE-SMOKE-001","FIRMA","Smoke Test Case","admin","2024-01-01T00:00:00Z"]}'

log "Smoke test PASSED. Deployment complete."

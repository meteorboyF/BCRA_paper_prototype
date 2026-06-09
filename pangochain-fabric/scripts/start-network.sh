#!/bin/bash
# PangoChain Fabric Network Startup Script
# Works on Linux, macOS, and Windows (WSL2 / Git Bash with Docker Desktop)
# No local Fabric binaries required — uses hyperledger/fabric-tools:2.4 Docker image.

set -euo pipefail

# Prevent Git Bash on Windows from mangling /container/paths into C:/Program Files/Git/...
export MSYS_NO_PATHCONV=1

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NETWORK_DIR="$(dirname "$SCRIPT_DIR")"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
log()  { echo -e "${GREEN}[+]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
die()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }

command -v docker >/dev/null 2>&1 || die "docker not found — install Docker Desktop first"

cd "$NETWORK_DIR"

# ─── 1. Tear down previous state ──────────────────────────────────────────────
log "Cleaning previous network state..."
docker compose -f docker-compose.fabric.yml down -v --remove-orphans 2>/dev/null || true
# crypto-config is created by a root-running Docker container — remove via Docker to avoid permission errors
docker run --rm -v "${NETWORK_DIR}:/workspace" alpine sh -c "rm -rf /workspace/crypto-config /workspace/channel-artifacts" 2>/dev/null || true
rm -rf crypto-config channel-artifacts 2>/dev/null || true

# ─── 2. Generate crypto + channel artifacts via container ─────────────────────
log "Generating crypto material and channel artifacts (inside fabric-tools container)..."
mkdir -p channel-artifacts

docker run --rm \
  -v "${NETWORK_DIR}:/workspace" \
  -w /workspace \
  hyperledger/fabric-tools:2.4 \
  bash /workspace/scripts/generate-artifacts.sh

log "Artifacts generated."

# ─── 3. Start Docker network services ─────────────────────────────────────────
log "Starting Fabric network containers..."
docker compose -f docker-compose.fabric.yml up -d

log "Waiting 20s for peers and orderer to be ready..."
sleep 20

log "Host entries for Fabric nodes baked into fabric-cli via extra_hosts (static IPs 172.20.0.2-5)."

# ─── 4. Create and join channel ───────────────────────────────────────────────
ORDERER_TLS="/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/pangochain.com/orderers/orderer1.pangochain.com/tls/ca.crt"
CRYPTO_BASE="/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto"

log "Creating legal-channel..."
docker exec fabric-cli peer channel create \
  -o orderer1.pangochain.com:7050 \
  -c legal-channel \
  -f /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/legal-channel.tx \
  --tls --cafile "$ORDERER_TLS" \
  --outputBlock /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/legal-channel.block

log "Joining peer0.firma to legal-channel..."
docker exec fabric-cli peer channel join \
  -b /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/legal-channel.block

log "Joining peer0.firmb to legal-channel..."
docker exec \
  -e CORE_PEER_ADDRESS=peer0.firmb.pangochain.com:8051 \
  -e CORE_PEER_LOCALMSPID=FirmBMSP \
  -e CORE_PEER_TLS_ROOTCERT_FILE="${CRYPTO_BASE}/peerOrganizations/firmb.pangochain.com/peers/peer0.firmb.pangochain.com/tls/ca.crt" \
  -e CORE_PEER_MSPCONFIGPATH="${CRYPTO_BASE}/peerOrganizations/firmb.pangochain.com/users/Admin@firmb.pangochain.com/msp" \
  fabric-cli peer channel join \
  -b /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/legal-channel.block

log "Joining peer0.regulator to legal-channel..."
docker exec \
  -e CORE_PEER_ADDRESS=peer0.regulator.pangochain.com:9051 \
  -e CORE_PEER_LOCALMSPID=RegulatorMSP \
  -e CORE_PEER_TLS_ROOTCERT_FILE="${CRYPTO_BASE}/peerOrganizations/regulator.pangochain.com/peers/peer0.regulator.pangochain.com/tls/ca.crt" \
  -e CORE_PEER_MSPCONFIGPATH="${CRYPTO_BASE}/peerOrganizations/regulator.pangochain.com/users/Admin@regulator.pangochain.com/msp" \
  fabric-cli peer channel join \
  -b /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/legal-channel.block

log "All peers joined legal-channel."

# ─── 5. Update anchor peers ───────────────────────────────────────────────────
log "Updating anchor peers..."

docker exec fabric-cli peer channel update \
  -o orderer1.pangochain.com:7050 -c legal-channel \
  -f /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/FirmAMSPanchors.tx \
  --tls --cafile "$ORDERER_TLS"

docker exec \
  -e CORE_PEER_ADDRESS=peer0.firmb.pangochain.com:8051 \
  -e CORE_PEER_LOCALMSPID=FirmBMSP \
  -e CORE_PEER_TLS_ROOTCERT_FILE="${CRYPTO_BASE}/peerOrganizations/firmb.pangochain.com/peers/peer0.firmb.pangochain.com/tls/ca.crt" \
  -e CORE_PEER_MSPCONFIGPATH="${CRYPTO_BASE}/peerOrganizations/firmb.pangochain.com/users/Admin@firmb.pangochain.com/msp" \
  fabric-cli peer channel update \
  -o orderer1.pangochain.com:7050 -c legal-channel \
  -f /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/FirmBMSPanchors.tx \
  --tls --cafile "$ORDERER_TLS"

docker exec \
  -e CORE_PEER_ADDRESS=peer0.regulator.pangochain.com:9051 \
  -e CORE_PEER_LOCALMSPID=RegulatorMSP \
  -e CORE_PEER_TLS_ROOTCERT_FILE="${CRYPTO_BASE}/peerOrganizations/regulator.pangochain.com/peers/peer0.regulator.pangochain.com/tls/ca.crt" \
  -e CORE_PEER_MSPCONFIGPATH="${CRYPTO_BASE}/peerOrganizations/regulator.pangochain.com/users/Admin@regulator.pangochain.com/msp" \
  fabric-cli peer channel update \
  -o orderer1.pangochain.com:7050 -c legal-channel \
  -f /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/RegulatorMSPanchors.tx \
  --tls --cafile "$ORDERER_TLS"

log "Anchor peers updated."
log ""
log "════════════════════════════════════════════════════════"
log "  PangoChain Fabric network is UP on legal-channel"
log "  Run scripts/deploy-chaincode.sh next"
log "════════════════════════════════════════════════════════"

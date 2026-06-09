#!/bin/bash
# Runs INSIDE the fabric-tools container. Generates crypto material and channel artifacts.
# Called by start-network.sh via: docker run --rm ... hyperledger/fabric-tools:2.4 /scripts/generate-artifacts.sh

set -euo pipefail

WORK=/workspace
mkdir -p "${WORK}/channel-artifacts"

GREEN='\033[0;32m'; NC='\033[0m'
log() { echo -e "${GREEN}[+]${NC} $1"; }

export FABRIC_CFG_PATH="${WORK}"

# ─── 1. Crypto material ───────────────────────────────────────────────────────
log "Generating crypto material..."
cryptogen generate \
  --config="${WORK}/crypto-config.yaml" \
  --output="${WORK}/crypto-config"

# ─── 2. Genesis block ─────────────────────────────────────────────────────────
log "Generating genesis block..."
configtxgen \
  -profile LegalOrdererGenesis \
  -channelID system-channel \
  -outputBlock "${WORK}/channel-artifacts/genesis.block"

# ─── 3. Channel creation tx ───────────────────────────────────────────────────
log "Generating channel creation transaction..."
configtxgen \
  -profile LegalChannel \
  -outputCreateChannelTx "${WORK}/channel-artifacts/legal-channel.tx" \
  -channelID legal-channel

# ─── 4. Anchor peer updates ───────────────────────────────────────────────────
for org in FirmA FirmB Regulator; do
  log "Generating anchor peer update for ${org}..."
  configtxgen \
    -profile LegalChannel \
    -outputAnchorPeersUpdate "${WORK}/channel-artifacts/${org}MSPanchors.tx" \
    -channelID legal-channel \
    -asOrg "${org}MSP"
done

log ""
log "Artifacts ready in ${WORK}/channel-artifacts/"
log "  genesis.block"
log "  legal-channel.tx"
log "  FirmAMSPanchors.tx  FirmBMSPanchors.tx  RegulatorMSPanchors.tx"

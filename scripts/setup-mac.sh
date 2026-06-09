#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

log() { printf '\033[0;32m[+]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[!]\033[0m %s\n' "$*"; }
die() { printf '\033[0;31m[x]\033[0m %s\n' "$*" >&2; exit 1; }
has_cmd() { command -v "$1" >/dev/null 2>&1; }

brew_install() {
  local package="$1"
  local label="$2"
  has_cmd brew || die "Homebrew is required for automatic macOS setup. Install it from https://brew.sh, then double-click SETUP_MAC.command again."
  log "Installing $label"
  brew install "$package"
}

brew_install_cask() {
  local package="$1"
  local label="$2"
  has_cmd brew || die "Homebrew is required for automatic macOS setup. Install it from https://brew.sh, then double-click SETUP_MAC.command again."
  log "Installing $label"
  brew install --cask "$package"
}

docker_running() {
  docker info >/dev/null 2>&1
}

log "Repository: $ROOT_DIR"

if ! has_cmd git; then
  brew_install git "Git"
else
  log "Git found: $(git --version)"
fi

if ! has_cmd java; then
  brew_install_cask temurin "Temurin Java 21 JDK"
else
  log "Java found: $(java -version 2>&1 | head -n 1)"
fi

if ! has_cmd node; then
  brew_install node "Node.js"
else
  log "Node.js found: $(node --version)"
fi

if ! has_cmd npm; then
  warn "npm is missing. Install Node.js, then rerun this setup."
else
  log "npm found: $(npm --version)"
fi

if ! has_cmd docker; then
  brew_install_cask docker "Docker Desktop"
  warn "Open Docker Desktop from Applications, finish first-run setup, then rerun SETUP_MAC.command."
else
  log "Docker CLI found"
fi

chmod +x "$ROOT_DIR/scripts/dev.sh" "$ROOT_DIR/pangochain-backend/mvnw" 2>/dev/null || true

if has_cmd npm; then
  log "Installing frontend dependencies"
  (cd "$ROOT_DIR/pangochain-frontend" && npm install)
fi

if has_cmd docker; then
  if ! docker_running; then
    warn "Docker Desktop is not running."
    if has_cmd open; then
      warn "Trying to open Docker Desktop now."
      open -a Docker >/dev/null 2>&1 || true
    fi
    warn "Wait until Docker Desktop says it is running, then double-click SETUP_MAC.command again to pull images."
  else
    log "Pulling PostgreSQL/IPFS images"
    (cd "$ROOT_DIR" && docker compose pull postgres ipfs ipfs2)

    log "Pulling Fabric images used by the research network"
    docker pull hyperledger/fabric-orderer:2.4
    docker pull hyperledger/fabric-peer:2.4
    docker pull hyperledger/fabric-tools:2.4
    docker pull couchdb:3.3
  fi
fi

echo
log "Manual step if needed: Docker Desktop must be open and running before starting PangoChain."
log "Start the project with: bash scripts/dev.sh"
log "For DB/IPFS-only startup without Fabric: PANGOCHAIN_WITH_FABRIC=0 bash scripts/dev.sh"

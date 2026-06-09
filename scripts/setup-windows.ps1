$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$FrontendDir = Join-Path $Root "pangochain-frontend"
$BackendDir = Join-Path $Root "pangochain-backend"

function Info($Message) { Write-Host "[+] $Message" -ForegroundColor Green }
function Warn($Message) { Write-Host "[!] $Message" -ForegroundColor Yellow }
function Fail($Message) { Write-Host "[x] $Message" -ForegroundColor Red }
function HasCommand($Name) { return $null -ne (Get-Command $Name -ErrorAction SilentlyContinue) }

function Install-WithWinget($Id, $Name) {
  if (-not (HasCommand "winget")) {
    Warn "$Name is missing. Install it manually because winget is not available."
    return
  }

  Info "Installing $Name with winget"
  winget install --id $Id --exact --accept-source-agreements --accept-package-agreements
}

function Docker-Running {
  try {
    docker info *> $null
    return $true
  } catch {
    return $false
  }
}

Info "Repository: $Root"

if (-not (HasCommand "git")) {
  Install-WithWinget "Git.Git" "Git"
} else {
  Info "Git found"
}

if (-not (HasCommand "java")) {
  Install-WithWinget "EclipseAdoptium.Temurin.21.JDK" "Temurin Java 21 JDK"
} else {
  $JavaVersion = (& java -version 2>&1 | Select-Object -First 1)
  Info "Java found: $JavaVersion"
}

if (-not (HasCommand "node")) {
  Install-WithWinget "OpenJS.NodeJS.LTS" "Node.js LTS"
} else {
  Info "Node.js found: $(node --version)"
}

if (-not (HasCommand "npm")) {
  Warn "npm is missing. Install Node.js LTS, then rerun this setup."
} else {
  Info "npm found: $(npm --version)"
}

if (-not (HasCommand "docker")) {
  Install-WithWinget "Docker.DockerDesktop" "Docker Desktop"
  Warn "Open Docker Desktop from the Start menu and finish its first-run setup, then rerun this file."
} else {
  Info "Docker CLI found"
}

if (HasCommand "npm") {
  Info "Installing frontend dependencies"
  Push-Location $FrontendDir
  npm install
  Pop-Location
}

if (Test-Path (Join-Path $BackendDir "mvnw.cmd")) {
  Info "Maven wrapper found; backend dependencies download on first backend start"
} else {
  Warn "pangochain-backend\mvnw.cmd was not found. Backend startup may fail."
}

if (HasCommand "docker") {
  if (Docker-Running) {
    Info "Pulling PostgreSQL/IPFS images"
    Push-Location $Root
    docker compose pull postgres ipfs ipfs2
    Pop-Location

    Info "Pulling Fabric images used by the research network"
    docker pull hyperledger/fabric-orderer:2.4
    docker pull hyperledger/fabric-peer:2.4
    docker pull hyperledger/fabric-tools:2.4
    docker pull couchdb:3.3
  } else {
    Warn "Docker Desktop is installed but not running."
    Warn "Open Docker Desktop, wait until it says it is running, then rerun this setup to pull images."
  }
}

$GitBashCandidates = @(
  "$env:ProgramFiles\Git\bin\bash.exe",
  "${env:ProgramFiles(x86)}\Git\bin\bash.exe",
  "$env:LocalAppData\Programs\Git\bin\bash.exe"
) | Where-Object { $_ -and (Test-Path $_) }

Write-Host ""
Info "Manual step if needed: Docker Desktop must be opened and running before starting PangoChain."
if ($GitBashCandidates.Count -gt 0) {
  Info "Start the project from Git Bash with: bash scripts/dev.sh"
} else {
  Warn "Git Bash was not found. Install Git for Windows or use WSL, then run: bash scripts/dev.sh"
}
Info "For DB/IPFS-only startup without Fabric: PANGOCHAIN_WITH_FABRIC=0 bash scripts/dev.sh"

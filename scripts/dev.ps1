# One-command local dev runner for PangoChain (Windows/PowerShell edition).
#
# Usage:
#   pwsh scripts/dev.ps1           # start infra + backend + frontend, then follow logs
#   pwsh scripts/dev.ps1 start     # same as default
#   pwsh scripts/dev.ps1 stop      # stop backend/frontend
#   pwsh scripts/dev.ps1 restart   # stop then start
#   pwsh scripts/dev.ps1 status    # show ports/PIDs
#   pwsh scripts/dev.ps1 logs      # follow backend/frontend logs
#
# Optional (set before running):
#   $env:PANGOCHAIN_WITH_FABRIC = "0"   # skip Fabric, run backend with FABRIC_ENABLED=false

param([string]$Command = "start")

$ErrorActionPreference = "Stop"

$RootDir      = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$StateDir     = Join-Path $RootDir ".pango-dev"
$BePidFile    = Join-Path $StateDir "backend.pid"
$FePidFile    = Join-Path $StateDir "frontend.pid"
$BeLog        = if ($env:PANGOCHAIN_BACKEND_LOG)  { $env:PANGOCHAIN_BACKEND_LOG  } else { Join-Path $StateDir "backend.log"  }
$FeLog        = if ($env:PANGOCHAIN_FRONTEND_LOG) { $env:PANGOCHAIN_FRONTEND_LOG } else { Join-Path $StateDir "frontend.log" }
$WithFabric   = if ($null -ne $env:PANGOCHAIN_WITH_FABRIC)  { $env:PANGOCHAIN_WITH_FABRIC  } else { "1" }
$BackendPort  = if ($env:PANGOCHAIN_BACKEND_PORT)  { $env:PANGOCHAIN_BACKEND_PORT  } else { "8080" }
$FrontendPort = if ($env:PANGOCHAIN_FRONTEND_PORT) { $env:PANGOCHAIN_FRONTEND_PORT } else { "3000" }

if (-not (Test-Path $StateDir)) { New-Item -ItemType Directory -Path $StateDir | Out-Null }

function Log($m)  { Write-Host "[+] $m" -ForegroundColor Green }
function Warn($m) { Write-Host "[!] $m" -ForegroundColor Yellow }
function Die($m)  { Write-Host "[x] $m" -ForegroundColor Red; exit 1 }
function HasCmd($n) { $null -ne (Get-Command $n -ErrorAction SilentlyContinue) }

# ---------------------------------------------------------------------------
# Docker Compose wrapper
# ---------------------------------------------------------------------------
function Compose {
    if (-not (HasCmd docker)) { Die "docker not found - start Docker Desktop first." }
    & docker compose version | Out-Null
    if ($LASTEXITCODE -eq 0) {
        & docker compose @args
    } elseif (HasCmd docker-compose) {
        & docker-compose @args
    } else {
        Die "Docker Compose not found. Install Docker Desktop (includes Compose v2)."
    }
}

# ---------------------------------------------------------------------------
# PID helpers
# ---------------------------------------------------------------------------
function PidAlive($p) {
    if (-not $p) { return $false }
    $null -ne (Get-Process -Id $p -ErrorAction SilentlyContinue)
}

function ReadPid($f) {
    if (-not (Test-Path $f)) { return $null }
    $s = (Get-Content $f -Raw).Trim()
    if ($s -match '^\d+$') { return [int]$s }
    return $null
}

function CleanStale($label, $f) {
    $p = ReadPid $f
    if ($p -and -not (PidAlive $p)) {
        Warn "Removing stale $label PID file (PID $p no longer running)"
        Remove-Item $f -Force -ErrorAction SilentlyContinue
    }
}

function KillTree($p) {
    if (-not $p) { return }
    # taskkill /T kills the full process tree on Windows
    & taskkill /F /T /PID $p 2>$null | Out-Null
}

# ---------------------------------------------------------------------------
# Network helper
# ---------------------------------------------------------------------------
function PortBusy($port) {
    $null -ne (Get-NetTCPConnection -LocalPort ([int]$port) -State Listen -ErrorAction SilentlyContinue)
}

function WaitHttp($name, $url, $secs) {
    for ($i = 1; $i -le $secs; $i++) {
        try {
            $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
            if ($r.StatusCode -lt 500) { Log "$name is ready  $url"; return $true }
        } catch {}
        Start-Sleep 1
    }
    Warn "$name did not become ready within ${secs}s"
    return $false
}

# ---------------------------------------------------------------------------
# Background process launcher
# Uses a temp .cmd wrapper so quoting/env-vars are handled by cmd.exe cleanly.
# ---------------------------------------------------------------------------
function StartBg($workdir, $pidFile, $logFile, $envLines, $runCmd) {
    # Build a small wrapper script so we avoid PowerShell->cmd quoting nightmares
    $tmp = Join-Path $StateDir ("wrap_" + [System.Guid]::NewGuid().ToString("N").Substring(0,8) + ".cmd")
    $content = "@echo off`r`n"
    foreach ($line in $envLines) { $content += "$line`r`n" }
    $content += "$runCmd >> `"$logFile`" 2>&1`r`n"
    [System.IO.File]::WriteAllText($tmp, $content, [System.Text.Encoding]::ASCII)

    $proc = Start-Process -FilePath "cmd.exe" `
        -ArgumentList "/c", "`"$tmp`"" `
        -WorkingDirectory $workdir `
        -WindowStyle Hidden `
        -PassThru

    "$($proc.Id)" | Set-Content -Path $pidFile -Encoding ASCII
    return $proc.Id
}

# ---------------------------------------------------------------------------
# Infra / Fabric
# ---------------------------------------------------------------------------
function StartDockerInfra {
    Log "Starting PostgreSQL + IPFS containers"
    Push-Location $RootDir
    try { Compose up postgres ipfs ipfs2 -d }
    finally { Pop-Location }
}

function StartFabricIfNeeded {
    if ($WithFabric -ne "1") {
        Warn "Skipping Fabric (PANGOCHAIN_WITH_FABRIC=$WithFabric)"
        return
    }
    if (-not (HasCmd docker)) { Die "docker not found - cannot start Fabric." }

    $running = & docker ps --format "{{.Names}}" 2>$null
    $hasFabric = ($running -match 'fabric-cli') -and ($running -match 'legalcc')
    if ($hasFabric) { Log "Fabric containers already up - reusing them"; return }

    Warn "Starting Fabric network (this can take several minutes on a fresh run)."
    Push-Location (Join-Path $RootDir "pangochain-fabric")
    try { & make up; & make chaincode; & make smoke }
    finally { Pop-Location }
}

# ---------------------------------------------------------------------------
# Backend
# ---------------------------------------------------------------------------
function StartBackend {
    CleanStale "backend" $BePidFile
    $p = ReadPid $BePidFile
    if ($p -and (PidAlive $p)) { Log "Backend already running (PID $p)"; return }

    try {
        $r = Invoke-WebRequest -Uri "http://localhost:$BackendPort/actuator/health" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
        if ($r.StatusCode -lt 500) { Warn "Backend already healthy on :$BackendPort - reusing it"; return }
    } catch {}

    if (PortBusy $BackendPort) { Die "Port $BackendPort already in use. Run 'pwsh scripts/dev.ps1 stop' first." }

    $fabricFlag = if ($WithFabric -eq "1") { "true" } else { "false" }
    $mvnw   = if (Test-Path (Join-Path $RootDir "pangochain-backend\mvnw.cmd")) { "mvnw.cmd" } else { "mvnw" }
    $beCmd  = "$mvnw spring-boot:run"

    Set-Content -Path $BeLog -Value "" -Encoding UTF8
    Log "Starting backend on :$BackendPort  (log: $BeLog)"

    $newPid = StartBg `
        (Join-Path $RootDir "pangochain-backend") `
        $BePidFile `
        $BeLog `
        @("set FABRIC_ENABLED=$fabricFlag") `
        $beCmd

    Log "Backend PID: $newPid"
    if (-not (WaitHttp "Backend" "http://localhost:$BackendPort/actuator/health" 120)) {
        Warn "Last 80 backend log lines:"
        Get-Content $BeLog -Tail 80 -ErrorAction SilentlyContinue
    }
}

# ---------------------------------------------------------------------------
# Frontend
# ---------------------------------------------------------------------------
function StartFrontend {
    CleanStale "frontend" $FePidFile
    $p = ReadPid $FePidFile
    if ($p -and (PidAlive $p)) { Log "Frontend already running (PID $p)"; return }

    try {
        $r = Invoke-WebRequest -Uri "http://localhost:$FrontendPort" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
        if ($r.StatusCode -lt 500) { Warn "Frontend already responding on :$FrontendPort - reusing it"; return }
    } catch {}

    if (PortBusy $FrontendPort) { Die "Port $FrontendPort already in use. Run 'pwsh scripts/dev.ps1 stop' first." }

    $feDir = Join-Path $RootDir "pangochain-frontend"
    if (-not (Test-Path (Join-Path $feDir "node_modules"))) {
        Log "Installing frontend dependencies..."
        Push-Location $feDir; try { npm install } finally { Pop-Location }
    }

    Set-Content -Path $FeLog -Value "" -Encoding UTF8
    Log "Starting frontend on :$FrontendPort  (log: $FeLog)"

    $newPid = StartBg `
        $feDir `
        $FePidFile `
        $FeLog `
        @() `
        "npm run dev -- --host 0.0.0.0 --port $FrontendPort"

    Log "Frontend PID: $newPid"
    if (-not (WaitHttp "Frontend" "http://localhost:$FrontendPort" 60)) {
        Warn "Last 80 frontend log lines:"
        Get-Content $FeLog -Tail 80 -ErrorAction SilentlyContinue
    }
}

# ---------------------------------------------------------------------------
# Stop
# ---------------------------------------------------------------------------
function StopPidFile($label, $f) {
    $p = ReadPid $f
    if (-not $p) {
        Remove-Item $f -Force -ErrorAction SilentlyContinue
        Warn "No $label PID file found"
        return
    }
    if (-not (PidAlive $p)) {
        Warn "$label PID $p already gone - removing stale PID file"
        Remove-Item $f -Force -ErrorAction SilentlyContinue
        return
    }
    Log "Stopping $label (PID $p + children)"
    KillTree $p
    Remove-Item $f -Force -ErrorAction SilentlyContinue
}

# ---------------------------------------------------------------------------
# Log follower - reads both log files simultaneously using FileStream so
# Windows file-locking doesn't block us while the process writes.
# ---------------------------------------------------------------------------
function ReadNew($path, [ref]$posRef) {
    if (-not (Test-Path $path)) { return @() }
    $lines = @()
    try {
        $fs     = [System.IO.FileStream]::new($path, [System.IO.FileMode]::Open,
                                              [System.IO.FileAccess]::Read,
                                              [System.IO.FileShare]::ReadWrite)
        if ($posRef.Value -gt $fs.Length) { $posRef.Value = 0 }  # log was cleared
        $fs.Seek($posRef.Value, [System.IO.SeekOrigin]::Begin) | Out-Null
        $reader = [System.IO.StreamReader]::new($fs)
        while (-not $reader.EndOfStream) { $lines += $reader.ReadLine() }
        $posRef.Value = $fs.Position
        $reader.Dispose(); $fs.Dispose()
    } catch {}
    return $lines
}

function FollowLogs {
    if (-not (Test-Path $BeLog)) { New-Item -ItemType File $BeLog -Force | Out-Null }
    if (-not (Test-Path $FeLog)) { New-Item -ItemType File $FeLog -Force | Out-Null }

    Log "Following logs - Ctrl+C stops watching, services keep running."
    Write-Host ""

    # Show last 20 lines of each as a starting snapshot
    Get-Content $BeLog -Tail 20 -ErrorAction SilentlyContinue |
        ForEach-Object { Write-Host "[BE] $_" -ForegroundColor Cyan }
    Get-Content $FeLog -Tail 20 -ErrorAction SilentlyContinue |
        ForEach-Object { Write-Host "[FE] $_" -ForegroundColor Yellow }

    $beItem = Get-Item $BeLog -ErrorAction SilentlyContinue
    $feItem = Get-Item $FeLog -ErrorAction SilentlyContinue
    [long]$bPos = if ($beItem) { $beItem.Length } else { 0 }
    [long]$fPos = if ($feItem) { $feItem.Length } else { 0 }

    try {
        while ($true) {
            ReadNew $BeLog ([ref]$bPos) | ForEach-Object { Write-Host "[BE] $_" -ForegroundColor Cyan }
            ReadNew $FeLog ([ref]$fPos) | ForEach-Object { Write-Host "[FE] $_" -ForegroundColor Yellow }
            Start-Sleep -Milliseconds 250
        }
    } catch { }  # absorbs Ctrl+C (PipelineStoppedException)
}

# ---------------------------------------------------------------------------
# Status
# ---------------------------------------------------------------------------
function CmdStatus {
    CleanStale "backend"  $BePidFile
    CleanStale "frontend" $FePidFile
    $bp = ReadPid $BePidFile;  Log ("Backend  PID : " + $(if ($bp) { $bp } else { "none" }))
    $fp = ReadPid $FePidFile;  Log ("Frontend PID : " + $(if ($fp) { $fp } else { "none" }))

    if (PortBusy $BackendPort)  { Log "Port $BackendPort  : LISTENING" } else { Warn "Port $BackendPort  : nothing listening" }
    if (PortBusy $FrontendPort) { Log "Port $FrontendPort : LISTENING" } else { Warn "Port $FrontendPort : nothing listening" }

    Log "Docker containers:"
    if (HasCmd docker) {
        & docker ps --format "table {{.Names}}`t{{.Status}}`t{{.Ports}}" 2>$null |
            Where-Object { $_ -match 'pangochain|orderer|peer0|fabric-cli|legalcc|couchdb|NAMES' }
    } else { Warn "docker not available." }
}

# ---------------------------------------------------------------------------
# Dispatch
# ---------------------------------------------------------------------------
switch ($Command.ToLower()) {
    "start" {
        StartDockerInfra
        StartFabricIfNeeded
        StartBackend
        StartFrontend
        Log "PangoChain is ready"
        Log "  Frontend : http://localhost:$FrontendPort"
        Log "  Backend  : http://localhost:$BackendPort"
        Log "  Swagger  : http://localhost:$BackendPort/swagger-ui.html"
        Log ""
        Log "  pwsh scripts/dev.ps1 logs    - re-attach to live logs"
        Log "  pwsh scripts/dev.ps1 stop    - stop app processes"
        Log ""
        FollowLogs
    }
    "stop" {
        StopPidFile "frontend" $FePidFile
        StopPidFile "backend"  $BePidFile
        Log "Stopped. Docker infra still running - 'docker compose down' to remove it."
    }
    "restart" {
        StopPidFile "frontend" $FePidFile
        StopPidFile "backend"  $BePidFile
        StartDockerInfra
        StartFabricIfNeeded
        StartBackend
        StartFrontend
        FollowLogs
    }
    "status" { CmdStatus }
    "logs"   { FollowLogs }
    default {
        Write-Host @"
Usage: pwsh scripts/dev.ps1 [start|stop|restart|status|logs]
Default subcommand: start

Environment variables (set before running):
  `$env:PANGOCHAIN_WITH_FABRIC = "0"   Skip Fabric; backend runs with FABRIC_ENABLED=false
  `$env:PANGOCHAIN_BACKEND_PORT        Backend port (default 8080)
  `$env:PANGOCHAIN_FRONTEND_PORT       Frontend port (default 3000)
"@
        exit 2
    }
}

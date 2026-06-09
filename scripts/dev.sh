#!/usr/bin/env bash
# One-command local dev runner for PangoChain.
#
# Usage:
#   bash scripts/dev.sh           # start infra + backend + frontend, then follow logs
#   bash scripts/dev.sh start     # same as default
#   bash scripts/dev.sh stop      # stop backend/frontend started by this script
#   bash scripts/dev.sh restart   # stop then start
#   bash scripts/dev.sh status    # show ports/PIDs
#   bash scripts/dev.sh logs      # follow backend/frontend logs
#
# Optional:
#   PANGOCHAIN_WITH_FABRIC=0 bash scripts/dev.sh start
#     Skip Fabric startup and run backend with FABRIC_ENABLED=false.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STATE_DIR="$ROOT_DIR/.pango-dev"
BACKEND_PID_FILE="$STATE_DIR/backend.pid"
FRONTEND_PID_FILE="$STATE_DIR/frontend.pid"
BACKEND_LOG="${PANGOCHAIN_BACKEND_LOG:-/tmp/pangochain-backend.log}"
FRONTEND_LOG="${PANGOCHAIN_FRONTEND_LOG:-/tmp/pangochain-frontend.log}"
WITH_FABRIC="${PANGOCHAIN_WITH_FABRIC:-1}"
BACKEND_PORT="${PANGOCHAIN_BACKEND_PORT:-8080}"
FRONTEND_PORT="${PANGOCHAIN_FRONTEND_PORT:-3000}"

GREEN=$'\033[0;32m'
YELLOW=$'\033[1;33m'
RED=$'\033[0;31m'
NC=$'\033[0m'

log() { printf '%s[+]%s %s\n' "$GREEN" "$NC" "$*"; }
warn() { printf '%s[!]%s %s\n' "$YELLOW" "$NC" "$*"; }
die() { printf '%s[x]%s %s\n' "$RED" "$NC" "$*" >&2; exit 1; }

mkdir -p "$STATE_DIR"

has_cmd() {
  command -v "$1" >/dev/null 2>&1
}

compose() {
  if docker compose version >/dev/null 2>&1; then
    docker compose "$@"
  elif has_cmd docker-compose; then
    docker-compose "$@"
  else
    die "Docker Compose not found. Install Docker Compose v2 ('docker compose') or the legacy docker-compose binary."
  fi
}

pid_alive() {
  local pid="${1:-}"
  [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null
}

read_pid_file() {
  local file="$1"
  [[ -f "$file" ]] && tr -dc '0-9' < "$file" || true
}

cleanup_stale_pid_file() {
  local label="$1" file="$2"
  local pid
  pid="$(read_pid_file "$file")"
  if [[ -n "$pid" ]] && ! pid_alive "$pid"; then
    warn "Removing stale $label PID file ($pid is not running)"
    rm -f "$file"
  fi
}

port_listener() {
  local port="$1"
  if has_cmd ss; then
    ss -ltnp "sport = :$port" 2>/dev/null | awk 'NR > 1 { print; found=1 } END { exit found ? 0 : 1 }'
  elif has_cmd lsof; then
    lsof -nP -iTCP:"$port" -sTCP:LISTEN 2>/dev/null
  else
    return 1
  fi
}

start_background() {
  local workdir="$1" pid_file="$2" log_file="$3" command="$4"
  (
    cd "$workdir"
    if has_cmd setsid; then
      setsid bash -lc "$command" >> "$log_file" 2>&1 &
    else
      bash -lc "$command" >> "$log_file" 2>&1 &
    fi
    echo $! > "$pid_file"
  )
}

wait_for_http() {
  local name="$1" url="$2" seconds="$3"
  local i
  for ((i=1; i<=seconds; i++)); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      log "$name is ready: $url"
      return 0
    fi
    sleep 1
  done
  warn "$name did not become ready within ${seconds}s"
  return 1
}

start_docker_infra() {
  has_cmd docker || die "docker not found. Start Docker Desktop / Docker Engine first."
  log "Starting PostgreSQL + IPFS containers"
  (cd "$ROOT_DIR" && compose up postgres ipfs ipfs2 -d)
}

fabric_container_up() {
  docker ps --format '{{.Names}}' | grep -qx 'fabric-cli' &&
  docker ps --format '{{.Names}}' | grep -qx 'legalcc'
}

start_fabric_if_needed() {
  if [[ "$WITH_FABRIC" != "1" ]]; then
    warn "Skipping Fabric startup because PANGOCHAIN_WITH_FABRIC=$WITH_FABRIC"
    return 0
  fi

  has_cmd docker || die "docker not found. Cannot start Fabric."
  if fabric_container_up; then
    log "Fabric containers already look up; reusing them"
    return 0
  fi

  warn "Fabric is not fully up. Starting Fabric network and deploying chaincode."
  log "This can take a few minutes on a fresh run."
  (cd "$ROOT_DIR/pangochain-fabric" && make up && make chaincode && make smoke)
}

start_backend() {
  cleanup_stale_pid_file "backend" "$BACKEND_PID_FILE"
  local pid
  pid="$(read_pid_file "$BACKEND_PID_FILE")"

  if pid_alive "$pid"; then
    log "Backend already started by this script (PID $pid)"
    return 0
  fi

  if curl -fsS "http://localhost:$BACKEND_PORT/actuator/health" >/dev/null 2>&1; then
    warn "Backend is already healthy on :$BACKEND_PORT; reusing it instead of starting another copy"
    return 0
  fi

  if port_listener "$BACKEND_PORT" >/dev/null; then
    warn "Something is already listening on :$BACKEND_PORT, but health check is not UP."
    port_listener "$BACKEND_PORT" || true
    die "Stop that process or run 'bash scripts/dev.sh stop' if it was started by this script."
  fi

  : > "$BACKEND_LOG"
  log "Starting backend on :$BACKEND_PORT (log: $BACKEND_LOG)"
  local fabric_flag="true"
  [[ "$WITH_FABRIC" == "1" ]] || fabric_flag="false"
  local material_db_fallback="${DOCUMENT_MATERIAL_DB_FALLBACK:-true}"
  if [[ "$WITH_FABRIC" != "1" && "${DOCUMENT_MATERIAL_DB_FALLBACK+x}" != "x" ]]; then
    material_db_fallback="true"
  fi

  start_background \
    "$ROOT_DIR/pangochain-backend" \
    "$BACKEND_PID_FILE" \
    "$BACKEND_LOG" \
    "FABRIC_ENABLED=$fabric_flag DOCUMENT_MATERIAL_DB_FALLBACK=$material_db_fallback ./mvnw spring-boot:run"

  pid="$(read_pid_file "$BACKEND_PID_FILE")"
  log "Backend PID: $pid"
  wait_for_http "Backend" "http://localhost:$BACKEND_PORT/actuator/health" 120 || {
    warn "Last 80 backend log lines:"
    tail -n 80 "$BACKEND_LOG" || true
    return 1
  }
}

start_frontend() {
  cleanup_stale_pid_file "frontend" "$FRONTEND_PID_FILE"
  local pid
  pid="$(read_pid_file "$FRONTEND_PID_FILE")"

  if pid_alive "$pid"; then
    log "Frontend already started by this script (PID $pid)"
    return 0
  fi

  if curl -fsS "http://localhost:$FRONTEND_PORT" >/dev/null 2>&1; then
    warn "Frontend is already responding on :$FRONTEND_PORT; reusing it instead of starting another copy"
    return 0
  fi

  if port_listener "$FRONTEND_PORT" >/dev/null; then
    warn "Something is already listening on :$FRONTEND_PORT."
    port_listener "$FRONTEND_PORT" || true
    die "Stop that process or run 'bash scripts/dev.sh stop' if it was started by this script."
  fi

  if [[ ! -d "$ROOT_DIR/pangochain-frontend/node_modules" ]]; then
    log "Installing frontend dependencies"
    (cd "$ROOT_DIR/pangochain-frontend" && npm install)
  fi

  : > "$FRONTEND_LOG"
  log "Starting frontend on :$FRONTEND_PORT (log: $FRONTEND_LOG)"
  start_background \
    "$ROOT_DIR/pangochain-frontend" \
    "$FRONTEND_PID_FILE" \
    "$FRONTEND_LOG" \
    "npm run dev -- --host 0.0.0.0 --port $FRONTEND_PORT"

  pid="$(read_pid_file "$FRONTEND_PID_FILE")"
  log "Frontend PID: $pid"
  wait_for_http "Frontend" "http://localhost:$FRONTEND_PORT" 60 || {
    warn "Last 80 frontend log lines:"
    tail -n 80 "$FRONTEND_LOG" || true
    return 1
  }
}

stop_pid_file() {
  local label="$1" file="$2"
  local pid
  pid="$(read_pid_file "$file")"

  if [[ -z "$pid" ]]; then
    rm -f "$file"
    warn "No $label PID file found"
    return 0
  fi

  if ! pid_alive "$pid"; then
    warn "$label PID $pid is not running; cleaning stale PID file"
    rm -f "$file"
    return 0
  fi

  log "Stopping $label PID $pid"
  kill "-$pid" 2>/dev/null || kill "$pid" 2>/dev/null || true
  sleep 2
  if pid_alive "$pid"; then
    warn "$label did not stop cleanly; forcing PID $pid"
    kill -9 "-$pid" 2>/dev/null || kill -9 "$pid" 2>/dev/null || true
  fi
  rm -f "$file"
}

cmd_start() {
  start_docker_infra
  start_fabric_if_needed
  start_backend
  start_frontend
  log "PangoChain is ready"
  log "Frontend: http://localhost:$FRONTEND_PORT"
  log "Backend:  http://localhost:$BACKEND_PORT"
  log "Use 'bash scripts/dev.sh logs' to follow logs, or 'bash scripts/dev.sh stop' to stop app processes."
  follow_logs
}

cmd_stop() {
  stop_pid_file "frontend" "$FRONTEND_PID_FILE"
  stop_pid_file "backend" "$BACKEND_PID_FILE"
  log "Stopped frontend/backend processes started by this script."
  warn "Docker infra is left running. Use 'docker compose down' and 'cd pangochain-fabric && make down' when you want to tear it down."
}

cmd_status() {
  cleanup_stale_pid_file "backend" "$BACKEND_PID_FILE"
  cleanup_stale_pid_file "frontend" "$FRONTEND_PID_FILE"
  local backend_pid frontend_pid
  backend_pid="$(read_pid_file "$BACKEND_PID_FILE")"
  frontend_pid="$(read_pid_file "$FRONTEND_PID_FILE")"
  log "Backend PID file: ${backend_pid:-none}"
  log "Frontend PID file: ${frontend_pid:-none}"
  echo
  log "Port $BACKEND_PORT:"
  port_listener "$BACKEND_PORT" || warn "No listener on :$BACKEND_PORT"
  echo
  log "Port $FRONTEND_PORT:"
  port_listener "$FRONTEND_PORT" || warn "No listener on :$FRONTEND_PORT"
  echo
  log "Docker containers:"
  if docker ps >/dev/null 2>&1; then
    docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' | grep -E 'pangochain|orderer|peer0|fabric-cli|legalcc|couchdb|NAMES' || true
  else
    warn "Cannot read Docker status. Is Docker running, and does this user have Docker permission?"
  fi
}

follow_logs() {
  touch "$BACKEND_LOG" "$FRONTEND_LOG"
  log "Following logs. Press Ctrl+C to stop watching; services will keep running."
  tail -n 40 -F "$BACKEND_LOG" "$FRONTEND_LOG"
}

case "${1:-start}" in
  start)
    cmd_start
    ;;
  stop)
    cmd_stop
    ;;
  restart)
    cmd_stop
    cmd_start
    ;;
  status)
    cmd_status
    ;;
  logs)
    follow_logs
    ;;
  *)
    cat <<EOF
Usage: bash scripts/dev.sh [start|stop|restart|status|logs]

Default: start

Environment:
  PANGOCHAIN_WITH_FABRIC=0  Skip Fabric and run backend with FABRIC_ENABLED=false.
  PANGOCHAIN_BACKEND_PORT   Backend port, default 8080.
  PANGOCHAIN_FRONTEND_PORT  Frontend port, default 3000.
EOF
    exit 2
    ;;
esac

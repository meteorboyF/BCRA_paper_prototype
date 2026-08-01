#!/usr/bin/env bash
# Restart the backend into one measurement arm and wait until it is serving.
#
#   restart-backend.sh fabric    -> FABRIC_ENABLED=true  DOCUMENT_MATERIAL_DB_FALLBACK=false
#   restart-backend.sh db_only   -> FABRIC_ENABLED=false DOCUMENT_MATERIAL_DB_FALLBACK=true
#
# db_only needs the fallback ON: with fabric.enabled=false the FabricGatewayService
# bean is not created at all (@ConditionalOnProperty), so DocumentService sees a null
# gateway and fails closed unless the PostgreSQL-ACL fallback is enabled. That
# fallback path (accessRepository.findActiveEntry) *is* the database-only access
# check this arm is meant to measure, and it is how the original 7.16 ms figure was
# produced (results/EXPERIMENT_PROGRESS.md, Task DB).
#
# Kills by PID, never `pkill -f spring-boot:run` — that pattern matches the calling
# shell's own command line and kills the caller.
set -euo pipefail

ARM="${1:?usage: restart-backend.sh fabric|db_only}"
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

case "$ARM" in
  fabric)  FE=true;  DBF=false ;;
  db_only) FE=false; DBF=true  ;;
  *) echo "unknown arm: $ARM" >&2; exit 2 ;;
esac

# Kill whatever is holding 8080, by PID.
OLD=$(ss -lntpH 'sport = :8080' 2>/dev/null | grep -oP 'pid=\K[0-9]+' | head -1 || true)
if [[ -n "${OLD:-}" ]]; then
  echo "[restart] stopping backend pid=$OLD"
  kill "$OLD" 2>/dev/null || true
  for _ in $(seq 1 60); do kill -0 "$OLD" 2>/dev/null || break; sleep 1; done
  kill -9 "$OLD" 2>/dev/null || true
fi
# Maven forks the JVM; make sure no stale child still holds the port.
for _ in $(seq 1 30); do ss -lntH 'sport = :8080' | grep -q . || break; sleep 1; done

set -a; source "$REPO/.env"; set +a   # dev.sh does not do this for a manual run;
                                      # without it Liquibase fails on the DB password
LOG="${BACKEND_LOG:-/tmp/backend-$ARM.log}"
echo "[restart] starting arm=$ARM FABRIC_ENABLED=$FE DOCUMENT_MATERIAL_DB_FALLBACK=$DBF"
cd "$REPO/pangochain-backend"
FABRIC_ENABLED=$FE DOCUMENT_MATERIAL_DB_FALLBACK=$DBF \
  nohup ./mvnw -q spring-boot:run > "$LOG" 2>&1 &

for i in $(seq 1 180); do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 http://localhost:8080/actuator/health || true)
  if [[ "$code" == "200" ]]; then
    echo "[restart] up after ${i}s (arm=$ARM)"
    # Confirm the arm actually took effect rather than trusting the env we passed.
    NEWPID=$(ss -lntpH 'sport = :8080' | grep -oP 'pid=\K[0-9]+' | head -1)
    echo "[restart] pid=$NEWPID"
    tr '\0' '\n' < "/proc/$NEWPID/environ" | grep -E '^(FABRIC_ENABLED|DOCUMENT_MATERIAL_DB_FALLBACK)=' \
      || echo "[restart] WARNING: could not read arm env from /proc/$NEWPID/environ"
    exit 0
  fi
  sleep 1
done
echo "[restart] FAILED to come up; tail of $LOG:" >&2
tail -30 "$LOG" >&2
exit 1

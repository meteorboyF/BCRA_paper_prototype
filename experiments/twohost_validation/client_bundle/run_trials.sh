#!/usr/bin/env bash
# Two-host validation — client-side trial orchestrator (runs on the
# GENERATOR machine, e.g. the Vivobook; never on the network host).
#
#   bash run_trials.sh <CONFIG_LABEL> <N_TRIALS>
#     e.g.  bash run_trials.sh A 10      # Config A: server at 500 ms BatchTimeout
#           bash run_trials.sh B 5       # Config B: server at 2 s BatchTimeout
#
# Requires exported env (see config.env.example + creds.env from
# setup_bench_data.py): PANGOCHAIN_API_URL, PANGOCHAIN_JWT_TOKEN,
# PANGOCHAIN_TEST_CASE_ID, PANGOCHAIN_TEST_DOC_ID,
# PANGOCHAIN_CONCURRENCY (50), PANGOCHAIN_DURATION_SEC (60).
#
# Per config block this script records:
#   - 100 ping-RTT samples to the server BEFORE and AFTER the block
#   - 1 discarded warm-up trial + N measured trials
#   - client CPU%% of the generator process per trial (GNU time -v)
#   - trials.csv + environment.json + raw per-trial logs
set -euo pipefail

CONFIG="${1:?usage: run_trials.sh <CONFIG_LABEL> <N_TRIALS>}"
NTRIALS="${2:?usage: run_trials.sh <CONFIG_LABEL> <N_TRIALS>}"
: "${PANGOCHAIN_API_URL:?export PANGOCHAIN_API_URL first (see config.env.example)}"
: "${PANGOCHAIN_JWT_TOKEN:?source creds.env first (from setup_bench_data.py)}"

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOST="$(python3 - <<PY
from urllib.parse import urlparse; import os
print(urlparse(os.environ["PANGOCHAIN_API_URL"]).hostname)
PY
)"
STAMP="$(date -u +%Y%m%d_%H%M%S)"
OUT="$HERE/../results/${STAMP}_config${CONFIG}"
mkdir -p "$OUT"
CSV="$OUT/trials.csv"
echo "config,phase,trial,tps,p50_ms,p95_ms,errors,elapsed_s,concurrency,client_cpu_pct,start_utc" > "$CSV"

command -v /usr/bin/time >/dev/null || { echo "GNU time missing: sudo apt install time"; exit 1; }

log(){ printf '[twohost %s] %s\n' "$(date -u +%H:%M:%S)" "$*"; }

run_one(){  # run_one <phase> <trial-idx>
  local phase="$1" idx="$2" t0 line cpu
  t0="$(date -u +%FT%TZ)"
  /usr/bin/time -v node "$HERE/loadtest.js" > "$OUT/${phase}_${idx}.out" 2> "$OUT/${phase}_${idx}.time" || true
  line="$(grep -E '^TPS=' "$OUT/${phase}_${idx}.out" | tail -1 || true)"
  cpu="$(grep 'Percent of CPU' "$OUT/${phase}_${idx}.time" | grep -o '[0-9]*%' | tr -d '%' || echo NA)"
  if [[ -z "$line" ]]; then
    log "trial $phase/$idx produced no result line — recording failure"
    echo "$CONFIG,$phase,$idx,NA,NA,NA,NA,NA,${PANGOCHAIN_CONCURRENCY:-50},$cpu,$t0" >> "$CSV"
    return
  fi
  local tps p50 p95 err el conc
  tps="$(sed -n 's/.*TPS=\([0-9.]*\).*/\1/p' <<<"$line")"
  p50="$(sed -n 's/.*P50=\([0-9]*\).*/\1/p' <<<"$line")"
  p95="$(sed -n 's/.*P95=\([0-9]*\).*/\1/p' <<<"$line")"
  err="$(sed -n 's/.*errors=\([0-9]*\).*/\1/p' <<<"$line")"
  el="$(sed -n 's/.*elapsed=\([0-9.]*\)s.*/\1/p' <<<"$line")"
  conc="$(sed -n 's/.*concurrency=\([0-9]*\).*/\1/p' <<<"$line")"
  echo "$CONFIG,$phase,$idx,$tps,$p50,$p95,$err,$el,$conc,$cpu,$t0" >> "$CSV"
  log "$phase $idx: $line (client CPU ${cpu}%)"
}

log "config $CONFIG → $OUT (server: $HOST)"
log "ping block (pre): 100 samples"
ping -c 100 -i 0.2 "$HOST" > "$OUT/ping_pre.txt" || log "WARN: ping failed/partial"

log "warm-up trial (discarded from analysis, recorded for completeness)"
run_one warmup 0

for i in $(seq 1 "$NTRIALS"); do
  run_one trial "$i"
done

log "ping block (post): 100 samples"
ping -c 100 -i 0.2 "$HOST" > "$OUT/ping_post.txt" || log "WARN: ping failed/partial"

python3 - <<PY > "$OUT/environment.json"
import json, os, platform, subprocess, datetime
def sh(c):
    try: return subprocess.check_output(c, shell=True, text=True).strip()
    except Exception as e: return f"ERR:{e}"
print(json.dumps({
  "role": "load generator (client) — two-host validation",
  "config": "$CONFIG", "trials": $NTRIALS, "warmup_discarded": 1,
  "utc": datetime.datetime.utcnow().isoformat() + "Z",
  "hostname": platform.node(), "kernel": platform.release(),
  "cpu": sh("grep -m1 'model name' /proc/cpuinfo | cut -d: -f2"),
  "nproc": sh("nproc"), "mem": sh("free -h | awk '/^Mem:/{print \$2}'"),
  "node": sh("node --version"),
  "network_note": "RECORD HERE whether wired LAN or Wi-Fi",
  "api_url": os.environ["PANGOCHAIN_API_URL"],
  "concurrency": os.environ.get("PANGOCHAIN_CONCURRENCY", "50"),
  "duration_sec": os.environ.get("PANGOCHAIN_DURATION_SEC", "60"),
}, indent=2))
PY

log "done — results in $OUT"
log "next: git add + commit + push (branch linux-validation), then tell the server session"

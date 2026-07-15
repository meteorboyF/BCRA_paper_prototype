#!/usr/bin/env bash
# V4 / Exp4 — Audit verification efficiency.
# (1) PostgreSQL audit_log query over 1,000 events — server-side time via psql \timing.
# (2) Manual CSV export + SHA-256 hash-chain verification of the same 1,000 events.
# 10 trials each. Raw -> results/exp4_audit.csv ; summary -> results/exp4_audit.summary.json
set -uo pipefail
REPO=/home/angkon/Pangochain_AOOP
CSV=$REPO/results/exp4_audit.csv; SJ=$REPO/results/exp4_audit.summary.json
PG="docker exec pangochain-postgres psql -U pangochain -d pangochain"
TRIALS=${TRIALS:-10}
cd "$REPO"; mkdir -p results
log(){ echo "[v4 $(date +%H:%M:%S)] $*"; }
echo "experiment,method,trial,ms,rows,platform" > "$CSV"

Q="SELECT id,event_type,actor_id,resource_type,resource_id,fabric_tx_id,timestamp,metadata_json FROM audit_log ORDER BY timestamp DESC LIMIT 1000"

log "=== Method 1: PostgreSQL query (1000 events), server-side \\timing, $TRIALS trials ==="
declare -a q_ms
for t in $(seq 1 "$TRIALS"); do
  OUT=$($PG -c '\timing on' -c "$Q" 2>/dev/null | grep -i "^Time:" | tail -1)
  MS=$(grep -oP 'Time:\s*\K[0-9.]+' <<<"$OUT")
  q_ms+=("$MS"); echo "exp4,pg_query_1000,$t,${MS:-NA},1000,linux_x86_64" >> "$CSV"
  log "  trial $t: ${MS}ms"
done

log "=== Method 2: manual CSV export + SHA-256 chain (1000 events), $TRIALS trials ==="
# Export once to CSV for hashing; time the fetch+hash compute each trial
declare -a m_ms
for t in $(seq 1 "$TRIALS"); do
  START=$(python3 -c "import time;print(time.perf_counter())")
  $PG -tA -F',' -c "COPY (${Q}) TO STDOUT WITH CSV" > /tmp/exp4_audit_export.csv 2>/dev/null
  MS=$(python3 - "$START" <<'PY'
import sys,time,hashlib,csv
start=float(sys.argv[1])
prev="0"*64; n=0
with open("/tmp/exp4_audit_export.csv",newline="") as f:
    for row in csv.reader(f):
        h=hashlib.sha256((",".join(row)+prev).encode()).hexdigest(); prev=h; n+=1
print(round((time.perf_counter()-start)*1000,2))
PY
)
  m_ms+=("$MS"); echo "exp4,csv_sha256_chain_1000,$t,${MS:-NA},1000,linux_x86_64" >> "$CSV"
  log "  trial $t: ${MS}ms"
done

python3 - "$SJ" "pg_query" "${q_ms[@]}" "--" "csv_sha256" "${m_ms[@]}" <<'PY'
import sys,json,statistics
sj=sys.argv[1]; args=sys.argv[2:]
i=args.index("--"); q=[float(x) for x in args[1:i] if x]; m=[float(x) for x in args[i+2:] if x]
def st(v): return dict(n=len(v),mean=round(statistics.mean(v),2),p50=round(statistics.median(v),2),
  min=round(min(v),2),max=round(max(v),2),stdev=round(statistics.stdev(v),2) if len(v)>1 else 0,raw=v)
json.dump({"pg_query_1000":st(q),"csv_sha256_chain_1000":st(m)},open(sj,"w"),indent=2)
print("pg_query P50:",st(q)["p50"],"ms | csv_sha256 P50:",st(m)["p50"],"ms")
PY
log "=== V4 done -> $CSV ==="

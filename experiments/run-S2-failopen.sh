#!/usr/bin/env bash
# S2 — Fail-open validation. Under steady 50-client /ciphertext load, stop the 3 Fabric
# peers (induce peer unreachability), confirm the service enters PostgreSQL-ACL fallback
# (requests still succeed = fail-OPEN) and every fallback decision emits an
# ACL_FABRIC_FALLBACK audit row; then restart peers and confirm chaincode-authoritative
# enforcement resumes (CheckAccess via Fabric again, no new fallback rows).
# Evidence -> results/exp_failopen.csv (per-second outcomes + event markers),
#             results/exp_failopen.audit.json (sample ACL_FABRIC_FALLBACK rows),
#             results/exp_failopen.summary.json
set -uo pipefail
REPO=/home/angkon/Pangochain_AOOP
BLOG=/tmp/pangochain-backend.log
PG="docker exec pangochain-postgres psql -U pangochain -d pangochain -tA"
CSV=$REPO/results/exp_failopen.csv
LOADER=$REPO/experiments/s2-ciphertext-load.js
PEERS=(peer0.firma.pangochain.com peer0.firmb.pangochain.com peer0.regulator.pangochain.com)
cd "$REPO"; mkdir -p results
log(){ echo "[S2 $(date +%H:%M:%S)] $*"; }
now_ms(){ python3 -c "import time;print(int(time.time()*1000))"; }
fb_count(){ $PG -c "SELECT count(*) FROM audit_log WHERE event_type='ACL_FABRIC_FALLBACK';" 2>/dev/null | tr -d '[:space:]'; }

# Need a DOC the bench user can read via /ciphertext (has IPFS content + active access).
OUT=$(python3 experiments/setup-bench-data.py 2>/tmp/s2_setup.err) || { cat /tmp/s2_setup.err; exit 1; }
eval "$OUT"; export PANGOCHAIN_JWT_TOKEN PANGOCHAIN_TEST_DOC_ID
log "doc=$PANGOCHAIN_TEST_DOC_ID"

# Sanity: one /ciphertext read should be 200 with Fabric up (chaincode-authoritative)
H=$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $PANGOCHAIN_JWT_TOKEN" "http://localhost:8080/api/documents/$PANGOCHAIN_TEST_DOC_ID/ciphertext")
log "pre-outage /ciphertext http=$H (expect 200, served after Fabric CheckAccess)"
FB0=$(fb_count); log "ACL_FABRIC_FALLBACK rows before: $FB0"

log "starting 50-client load for 150s..."
PANGOCHAIN_CONCURRENCY=50 PANGOCHAIN_DURATION_SEC=150 node "$LOADER" > /tmp/s2_load.jsonl 2>&1 &
LPID=$!
T_START=$(now_ms)

sleep 30
T_STOP=$(now_ms); log "=== STOPPING PEERS (t=$(( (T_STOP-T_START)/1000 ))s) ==="
docker stop "${PEERS[@]}" >/dev/null 2>&1
log "peers stopped"

sleep 45
T_START_PEERS=$(now_ms); log "=== RESTARTING PEERS (t=$(( (T_START_PEERS-T_START)/1000 ))s) ==="
docker start "${PEERS[@]}" >/dev/null 2>&1
log "peers started; waiting for gateway reconnect"
sleep 45

wait $LPID 2>/dev/null || true
T_END=$(now_ms)
FB1=$(fb_count); log "ACL_FABRIC_FALLBACK rows after: $FB1 (delta=$((FB1-FB0)))"

# Build per-second CSV with event markers
echo "experiment,t_sec,ok,http5xx,http403,err,inflight,event,platform" > "$CSV"
python3 - "$CSV" "$T_START" "$T_STOP" "$T_START_PEERS" <<'PY'
import sys,json
csvp,ts,tstop,tstart_peers=sys.argv[1],int(sys.argv[2]),int(sys.argv[3]),int(sys.argv[4])
stop_s=round((tstop-ts)/1000); start_s=round((tstart_peers-ts)/1000)
rows=[]
for line in open("/tmp/s2_load.jsonl"):
    line=line.strip()
    if not line.startswith("{"): continue
    try: d=json.loads(line)
    except: continue
    ev=""
    if d["t"]==stop_s: ev="PEERS_STOPPED"
    elif d["t"]==start_s: ev="PEERS_STARTED"
    rows.append(d|{"event":ev})
with open(csvp,"a") as f:
    for d in rows:
        f.write(f"exp_failopen,{d['t']},{d['ok']},{d['h5']},{d['h403']},{d['err']},{d['inflight']},{d['event']},linux_x86_64\n")
print(f"stop@{stop_s}s start@{start_s}s rows={len(rows)}")
PY

# Dump sample ACL_FABRIC_FALLBACK rows emitted during the window
$PG -c "COPY (SELECT id,event_type,actor_id,resource_id,timestamp,metadata_json FROM audit_log WHERE event_type='ACL_FABRIC_FALLBACK' ORDER BY timestamp DESC LIMIT 20) TO STDOUT WITH (FORMAT json)" 2>/dev/null \
  > /tmp/s2_audit.txt || true
python3 - "$REPO/results/exp_failopen.audit.json" <<'PY'
import json,sys
rows=[]
for line in open("/tmp/s2_audit.txt"):
    line=line.strip()
    if line:
        try: rows.append(json.loads(line))
        except: pass
json.dump(rows,open(sys.argv[1],"w"),indent=2); print(f"dumped {len(rows)} ACL_FABRIC_FALLBACK rows")
PY

# Backend log evidence (fallback + recovery)
log "=== backend log: fallback + recovery markers ==="
grep -iE "ACL_FABRIC_FALLBACK|Fabric ACL check failed|circuit|UNAVAILABLE|Fabric tx committed" "$BLOG" | tail -15

python3 - "$REPO/results/exp_failopen.summary.json" "$FB0" "$FB1" <<'PY'
import sys,json,csv
sj,fb0,fb1=sys.argv[1],int(sys.argv[2]),int(sys.argv[3])
rows=list(csv.DictReader(open("/home/angkon/Pangochain_AOOP/results/exp_failopen.csv")))
def phase(rows,lo,hi): return [r for r in rows if lo<=int(r["t_sec"])<hi]
stop=next((int(r["t_sec"]) for r in rows if r["event"]=="PEERS_STOPPED"),None)
start=next((int(r["t_sec"]) for r in rows if r["event"]=="PEERS_STARTED"),None)
def agg(rs):
    return dict(ok=sum(int(r["ok"]) for r in rs),h5=sum(int(r["http5xx"]) for r in rs),
               h403=sum(int(r["http403"]) for r in rs),err=sum(int(r["err"]) for r in rs))
s={"fallback_rows_delta":fb1-fb0,
   "before_outage":agg(phase(rows,0,stop)) if stop else None,
   "during_outage":agg(phase(rows,stop,start)) if stop and start else None,
   "after_recovery":agg(phase(rows,start,10**9)) if start else None,
   "peers_stopped_at_s":stop,"peers_started_at_s":start}
json.dump(s,open(sj,"w"),indent=2); print(json.dumps(s,indent=2))
PY
log "=== S2 done -> $CSV ==="

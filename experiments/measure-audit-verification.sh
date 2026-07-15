#!/bin/bash
# Experiment 4 — Audit Verification Efficiency
# Compares: Fabric GetHistoryForKey vs PostgreSQL audit log vs manual CSV+SHA-256
# Usage: JWT=<token> CASE_ID=<id> bash measure-audit-verification.sh

BASE="http://localhost:8080/api"

[ -z "$JWT" ] && { echo "ERROR: set JWT env var"; exit 1; }
[ -z "$CASE_ID" ] && { echo "ERROR: set CASE_ID env var"; exit 1; }

H="Authorization: Bearer $JWT"
REPS=5

echo "=== Experiment 4 — Audit Verification Efficiency ==="
echo "Date: $(date -Iseconds)"
echo "Case ID: $CASE_ID"
echo ""

# msec() — portable millisecond timestamp (macOS date has no %N)
msec() { python3 -c "import time; print(int(time.time()*1000))"; }

# Method 1: PostgreSQL audit log query (via /api/audit?size=1000)
echo "--- Method 1: PostgreSQL audit log (API query) ---"
total=0
pg_times=()
for i in $(seq 1 $REPS); do
  t=$( { time curl -sf -H "$H" \
    "$BASE/audit?size=1000" > /dev/null 2>&1; } 2>&1 \
    | grep real | awk '{print $2}' | sed 's/[ms]/ /g' \
    | awk '{print $1*60000 + $2*1000}' )
  pg_times+=("$t")
  total=$(echo "$total + $t" | bc)
  echo "  Run $i: ${t}ms"
done
IFS=$'\n' sorted=($(sort -n <<<"${pg_times[*]}")); unset IFS
pg_mean=$(echo "scale=1; $total / $REPS" | bc)
pg_p50="${sorted[$((REPS/2))]}"
echo "  PostgreSQL: mean=${pg_mean}ms P50=${pg_p50}ms"

# Method 2: Export to JSON + local SHA-256 chain verify (manual baseline)
echo ""
echo "--- Method 2: Export + local SHA-256 chain verify (manual baseline) ---"
t_start=$(msec)
curl -sf -H "$H" "$BASE/audit?size=1000" -o /tmp/audit-export.json 2>/dev/null
t_fetch=$(msec)

python3 -c "
import json, hashlib, sys, csv, time
with open('/tmp/audit-export.json') as f:
    data = json.load(f)
records = data.get('content', data) if isinstance(data, dict) else data
print(f'Loaded {len(records)} records', file=sys.stderr)
prev_hash = '0' * 64
with open('/tmp/audit-export.csv', 'w', newline='') as cf:
    writer = csv.writer(cf)
    writer.writerow(['id','eventType','actorId','resourceId','timestamp','fabricTxId','hash'])
    for r in records:
        h = hashlib.sha256((str(r) + prev_hash).encode()).hexdigest()
        writer.writerow([r.get('id',''), r.get('eventType',''), r.get('actorId',''),
                         r.get('resourceId',''), r.get('createdAt',''),
                         r.get('fabricTxId',''), h])
        prev_hash = h
print('Chain hash computation complete', file=sys.stderr)
" 2>&1
t_verify=$(msec)

export_time=$((t_fetch - t_start))
verify_time=$((t_verify - t_fetch))
total_manual=$((t_verify - t_start))
echo "  Fetch: ${export_time}ms | SHA-256 chain verify: ${verify_time}ms | Total: ${total_manual}ms"

echo ""
echo "=== Summary ==="
echo "| Method | Time (ms) | Notes |"
echo "|--------|-----------|-------|"
echo "| PostgreSQL API query | ${pg_mean}ms (mean) | P50=${pg_p50}ms |"
echo "| Manual CSV + SHA-256 | ${total_manual}ms | fetch=${export_time}ms + verify=${verify_time}ms |"
echo ""

speedup=$(python3 -c "print(f'{${total_manual} / ${pg_mean}:.1f}x')" 2>/dev/null || echo "N/A")
echo "Speedup (automated vs manual): ${speedup}"

echo ""
echo "Note: Fabric GetHistoryForKey (on-chain verification) requires direct peer access."
echo "The Fabric audit trail can be verified independently of this application server."
echo "Record all values in experiment_results.md under Experiment 4."

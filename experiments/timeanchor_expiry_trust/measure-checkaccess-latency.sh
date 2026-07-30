#!/usr/bin/env bash
# Paired latency probe for the CheckAccess release path.
# Only the deployed chaincode differs between runs, so the delta isolates the
# TimeAnchor freshness read. Usage: measure_ca.sh <label> <n>
set -euo pipefail
SP=/tmp/claude-1000/-home-angkon-Projects-Blockchain/65b076e9-8cda-421e-be6b-174db86ff293/scratchpad
LABEL="$1"; N="${2:-100}"
TOK=$(cat "$SP/tok.txt"); DOC=$(cat "$SP/doc.txt")
URL="http://localhost:8080/api/documents/$DOC/wrapped-key"

# Warm-up: JIT, connection pool, CouchDB cache, and - the reason this is 60 rather than a
# handful - the chaincode container's cold start after a redeploy, which produced a single
# ~1.6s outlier at n=8 on a 15-iteration warm-up. Discarded, not measured.
for _ in $(seq 1 60); do curl -s -o /dev/null "$URL" -H "Authorization: Bearer $TOK"; done

: > "$SP/lat_$LABEL.txt"
for _ in $(seq 1 "$N"); do
  curl -s -o /dev/null -w '%{time_total}\n' "$URL" -H "Authorization: Bearer $TOK" >> "$SP/lat_$LABEL.txt"
done

python3 - "$SP/lat_$LABEL.txt" "$LABEL" <<'EOF'
import sys, statistics as st
vals = sorted(float(l)*1000 for l in open(sys.argv[1]) if l.strip())
def pct(p):
    return vals[min(len(vals)-1, int(round((p/100)*len(vals))) - 1 if p else 0)]
print(f"{sys.argv[2]}: n={len(vals)} mean={st.mean(vals):.2f}ms "
      f"P50={st.median(vals):.2f}ms P95={pct(95):.2f}ms SD={st.stdev(vals):.2f}ms")
EOF

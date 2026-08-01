#!/usr/bin/env bash
# Experiment 2 re-run — bracketed fabric / db_only / fabric CheckAccess comparison.
#
# WHY BRACKETED. The original Exp 2 measured its two arms weeks apart (the db_only
# arm was a later top-up, results/EXPERIMENT_PROGRESS.md Task DB) and reported both
# as absolute figures. That is only sound on a quiet, stable host. This host is no
# longer quiet — it is running the user's desktop session and is deep into swap —
# so absolute latencies drift on a timescale comparable to the run itself.
#
# Running fabric, then db_only, then fabric again turns that drift from an unknown
# into a measured quantity: if the two fabric brackets agree, the fabric-vs-db_only
# difference measured between them is attributable to the arm and not to the host.
# If they disagree, the run says so instead of quietly reporting the drift as an
# effect. The paired difference is the claim the manuscript actually makes; the
# absolute figures from this run are host-loaded and are NOT comparable to the
# original 6.51 / 7.16 ms.
#
# Each arm gets a freshly restarted JVM so the arms are matched on JIT state too;
# every arm still discards its own first 20 samples.
#
# Usage: bash run.sh [stamp]
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STAMP="${1:-$(date +%Y%m%d_%H%M%S)}"
OUT="$HERE/results/$STAMP"
mkdir -p "$OUT"

CC_LABEL="$(docker exec fabric-cli peer lifecycle chaincode querycommitted -C legal-channel -n legalcc 2>/dev/null \
  | grep -oP 'Version: \S+, Sequence: \d+' || echo 'unrecorded')"

snapshot_host() {  # $1 = label; records the conditions this arm actually ran under
  {
    echo "## $1  $(date -Iseconds)"
    uptime
    free -m | sed -n '1,3p'
    grep -E '^(pgpgin|pgpgout|pswpin|pswpout)' /proc/vmstat
    echo
  } >> "$OUT/host_conditions.txt"
}

login_and_fixture() {  # creates the one document every arm then reads
  node "$HERE/setup.mjs" 2>>"$OUT/setup.log"
}

relogin() {  # $1 = source fixture, $2 = dest; same document, fresh token after a restart
  python3 - "$1" "$2" <<'PY'
import json, sys, urllib.request
fx = json.load(open(sys.argv[1]))
req = urllib.request.Request("http://localhost:8080/api/auth/login",
    data=json.dumps({"email": fx["ownerEmail"], "password": "Demo2026#Secure"}).encode(),
    headers={"Content-Type": "application/json"})
fx["jwt"] = json.load(urllib.request.urlopen(req))["accessToken"]
json.dump(fx, open(sys.argv[2], "w"))
PY
}

measure_arm() {  # $1 = arm (fabric|db_only), $2 = ops, $3 = fixture json, $4 = bracket label
  local arm="$1" ops="$2" fx="$3" bracket="$4"
  local fe dbf
  case "$arm" in fabric) fe=true; dbf=false ;; db_only) fe=false; dbf=true ;; esac
  # `mode` carries the arm, `method` the bracket, so the two fabric brackets stay
  # distinguishable in the merged CSV.
  JWT=$(python3 -c "import json,sys;print(json.load(open('$fx'))['jwt'])") \
  DOC_ID=$(python3 -c "import json,sys;print(json.load(open('$fx'))['docId'])") \
  CASE_ID=$(python3 -c "import json,sys;print(json.load(open('$fx'))['caseId'])") \
  MODE="$arm" METHOD="$bracket" OUT="$OUT" OPS="$ops" \
  CC_LABEL="$CC_LABEL" ARM_FABRIC_ENABLED="$fe" ARM_DB_FALLBACK="$dbf" \
  python3 "$HERE/measure.py"
}

echo "=== Exp 2 re-run, bracketed — $STAMP ==="
echo "chaincode: $CC_LABEL"

# ── bracket 1: fabric ────────────────────────────────────────────────────────
bash "$HERE/restart-backend.sh" fabric
snapshot_host "fabric bracket 1"
FX=$(login_and_fixture); echo "$FX" > "$OUT/fixture_fabric1.json"
measure_arm fabric checkaccess,registerdoc "$OUT/fixture_fabric1.json" fabric1
mv "$OUT/exp2_latency.csv" "$OUT/exp2_latency.fabric1.csv"
mv "$OUT/exp2_latency.summary.json" "$OUT/exp2_latency.fabric1.summary.json"

# ── db_only ──────────────────────────────────────────────────────────────────
# Uses the SAME document created above: the uploader holds both an on-chain grant
# (RegisterDocument) and a document_access row (DocumentService persists the owner
# entry), so the identical request is a Fabric CheckAccess in one arm and a
# PostgreSQL ACL lookup in the other.
bash "$HERE/restart-backend.sh" db_only
snapshot_host "db_only"
relogin "$OUT/fixture_fabric1.json" "$OUT/fixture_dbonly.json"
measure_arm db_only checkaccess "$OUT/fixture_dbonly.json" dbonly
mv "$OUT/exp2_latency.csv" "$OUT/exp2_latency.dbonly.csv"
mv "$OUT/exp2_latency.summary.json" "$OUT/exp2_latency.dbonly.summary.json"

# ── bracket 2: fabric (drift control; also restores the stack to fabric mode) ─
bash "$HERE/restart-backend.sh" fabric
snapshot_host "fabric bracket 2"
relogin "$OUT/fixture_fabric1.json" "$OUT/fixture_fabric2.json"   # same document as bracket 1
measure_arm fabric checkaccess "$OUT/fixture_fabric2.json" fabric2
mv "$OUT/exp2_latency.csv" "$OUT/exp2_latency.fabric2.csv"
mv "$OUT/exp2_latency.summary.json" "$OUT/exp2_latency.fabric2.summary.json"

cat "$OUT"/exp2_latency.fabric1.csv > "$OUT/exp2_latency.csv"
tail -n +2 -q "$OUT/exp2_latency.dbonly.csv" "$OUT/exp2_latency.fabric2.csv" >> "$OUT/exp2_latency.csv"

# The fixtures record which document each arm read, for provenance — but they also
# carry a live bearer token, which has no business in the repository.
python3 - "$OUT" <<'PY'
import json, glob, os, sys
for f in glob.glob(os.path.join(sys.argv[1], "fixture_*.json")):
    o = json.load(open(f))
    if "jwt" in o:
        o["jwt"] = "<redacted: bearer token not committed>"
        json.dump(o, open(f, "w"), indent=1)
PY

echo "=== done: $OUT ==="

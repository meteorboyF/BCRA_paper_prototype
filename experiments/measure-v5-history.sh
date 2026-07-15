#!/usr/bin/env bash
# V5 / Exp7 — GetHistoryForKey at scale. Seeds a doc with 107 history entries
# (1 RegisterDocument + 106 GrantAccess, each its own block via --waitForEvent),
# then times GetDocumentHistory (wraps GetHistoryForKey) over 10 query trials.
# Emits ALL 10 raw values. Seeds via peer CLI (fabric-cli). Idempotent doc id per run.
set -uo pipefail
REPO=/home/angkon/Pangochain_AOOP
CSV=$REPO/results/exp7_history.csv
SJ=$REPO/results/exp7_history.summary.json
ORDERER_TLS=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/pangochain.com/orderers/orderer1.pangochain.com/tls/ca.crt
CB=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto
FA=$CB/peerOrganizations/firma.pangochain.com/peers/peer0.firma.pangochain.com/tls/ca.crt
FB=$CB/peerOrganizations/firmb.pangochain.com/peers/peer0.firmb.pangochain.com/tls/ca.crt
DOCID=${DOCID:-HIST-BENCH-DOC-$(date +%s)}
GRANTS=${GRANTS:-106}    # 1 RegisterDocument + 106 GrantAccess = 107 entries
TRIALS=${TRIALS:-10}
OWNER=hist-owner-001; OWNERORG=FirmAMSP; CASEID=case-hist-001
TS=2026-06-01T00:00:00Z

cd "$REPO"; mkdir -p results
log(){ echo "[v5 $(date +%H:%M:%S)] $*"; }
invoke(){  # invoke <fn> <args-json-array-inner>
  docker exec fabric-cli peer chaincode invoke -C legal-channel -n legalcc \
    -o orderer1.pangochain.com:7050 --tls --cafile "$ORDERER_TLS" \
    --waitForEvent --waitForEventTimeout 30s \
    --peerAddresses peer0.firma.pangochain.com:7051 --tlsRootCertFiles "$FA" \
    --peerAddresses peer0.firmb.pangochain.com:8051 --tlsRootCertFiles "$FB" \
    -c "$1" 2>&1
}

log "=== V5 seeding docId=$DOCID (1 RegisterDocument + $GRANTS GrantAccess) ==="
OUT=$(invoke "{\"function\":\"RegisterDocument\",\"Args\":[\"$DOCID\",\"$CASEID\",\"hash0\",\"QmHist0\",\"$OWNER\",\"$OWNERORG\",\"$TS\"]}")
echo "$OUT" | grep -q "result: status:200\|Chaincode invoke successful" && log "RegisterDocument OK" || { log "RegisterDocument FAILED: $OUT"; exit 1; }
ok=0
for i in $(seq 1 "$GRANTS"); do
  OUT=$(invoke "{\"function\":\"GrantAccess\",\"Args\":[\"$DOCID\",\"subject-$i\",\"FirmBMSP\",\"read\",\"2030-01-01T00:00:00Z\",\"wk-$i\",\"$OWNER\"]}")
  if echo "$OUT" | grep -q "status:200\|invoke successful"; then ok=$((ok+1)); else log "  grant $i FAIL: $(echo "$OUT"|tail -1)"; fi
  [ $((i%20)) -eq 0 ] && log "  grants: $ok/$i"
done
log "seeding done: $ok/$GRANTS grants ok (history depth target = $((ok+1)))"

# Verify history depth
HJSON=$(docker exec fabric-cli peer chaincode query -C legal-channel -n legalcc \
  -c "{\"function\":\"GetDocumentHistory\",\"Args\":[\"$DOCID\"]}" 2>/dev/null)
DEPTH=$(echo "$HJSON" | python3 -c "import sys,json
try:
  d=json.load(sys.stdin); print(len(d) if isinstance(d,list) else len(d.get('history',d)))
except Exception as e: print('parse_err')" 2>/dev/null)
log "history depth reported by chaincode: $DEPTH"

echo "experiment,doc_id,history_depth,trial,latency_ms,method,platform" > "$CSV"
log "=== timing GetDocumentHistory ($TRIALS trials) ==="
declare -a vals
for t in $(seq 1 "$TRIALS"); do
  START=$(python3 -c "import time;print(int(time.time()*1000))")
  docker exec fabric-cli peer chaincode query -C legal-channel -n legalcc \
    -c "{\"function\":\"GetDocumentHistory\",\"Args\":[\"$DOCID\"]}" >/dev/null 2>&1
  END=$(python3 -c "import time;print(int(time.time()*1000))")
  MS=$((END-START)); vals+=("$MS")
  echo "exp7,$DOCID,${DEPTH},$t,$MS,peer_cli_query,linux_x86_64" >> "$CSV"
  log "  trial $t: ${MS}ms"
done
python3 - "$SJ" "$DEPTH" "${vals[@]}" <<'PY'
import sys,json,statistics
sj=sys.argv[1]; depth=sys.argv[2]; v=[int(x) for x in sys.argv[3:]]
s={"history_depth":depth,"n":len(v),"raw":v,"mean":round(statistics.mean(v),2),
   "p50":statistics.median(v),"min":min(v),"max":max(v),
   "stdev":round(statistics.stdev(v),2) if len(v)>1 else 0}
json.dump(s,open(sj,"w"),indent=2); print("RAW:",v,"\nP50:",s["p50"],"mean:",s["mean"])
PY
log "=== V5 done -> $CSV ==="

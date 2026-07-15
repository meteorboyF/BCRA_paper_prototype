#!/usr/bin/env bash
# TASK SENS — Clean BatchTimeout sensitivity with the CANONICAL duration60s tool.
# conc=50, timeouts {2s,500ms,250ms}, 10 reps each. Rebuilds the ledger for each timeout
# (keeps crypto, includes anchor updates), RESTORES 2s at the end. Captures client-side
# (load generator) %CPU each rep to test whether the load generator — not the orderer — is
# the ceiling when 250ms is non-monotonic vs 500ms.
# Raw -> results/exp_batchtimeout_sens.csv ; summary -> results/exp_batchtimeout_sens.summary.json
set -uo pipefail
REPO=/home/angkon/Pangochain_AOOP
FAB=$REPO/pangochain-fabric
CSV=$REPO/results/exp_batchtimeout_sens.csv
SJ=$REPO/results/exp_batchtimeout_sens.summary.json
CONFIGTX=$FAB/configtx.yaml
ORDERER_TLS=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/pangochain.com/orderers/orderer1.pangochain.com/tls/ca.crt
CB=/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto
TOOL=$REPO/experiments/caliper/pangochain-loadtest-configurable.js
CONC=${CONC:-50}; DUR=${DUR:-60}; REPS=${REPS:-10}
cd "$REPO"
log(){ echo "[SENS $(date +%H:%M:%S)] $*"; }

regen_artifacts(){
  rm -f "$FAB/channel-artifacts/genesis.block" "$FAB/channel-artifacts/legal-channel.block" \
        "$FAB/channel-artifacts/legal-channel.tx" "$FAB/channel-artifacts/"*anchors.tx
  docker run --rm -v "$FAB:/workspace" -w /workspace hyperledger/fabric-tools:2.4 bash -c "
    export FABRIC_CFG_PATH=/workspace; mkdir -p /workspace/channel-artifacts
    configtxgen -profile LegalOrdererGenesis -channelID system-channel -outputBlock /workspace/channel-artifacts/genesis.block
    configtxgen -profile LegalChannel -outputCreateChannelTx /workspace/channel-artifacts/legal-channel.tx -channelID legal-channel
    configtxgen -profile LegalChannel -outputAnchorPeersUpdate /workspace/channel-artifacts/FirmAMSPanchors.tx -channelID legal-channel -asOrg FirmAMSP
    configtxgen -profile LegalChannel -outputAnchorPeersUpdate /workspace/channel-artifacts/FirmBMSPanchors.tx -channelID legal-channel -asOrg FirmBMSP
    configtxgen -profile LegalChannel -outputAnchorPeersUpdate /workspace/channel-artifacts/RegulatorMSPanchors.tx -channelID legal-channel -asOrg RegulatorMSP" 2>&1 | tail -1
}
join_deploy(){
  docker exec fabric-cli peer channel create -o orderer1.pangochain.com:7050 -c legal-channel \
    -f "${CB}/../channel-artifacts/legal-channel.tx" --tls --cafile "$ORDERER_TLS" \
    --outputBlock "${CB}/../channel-artifacts/legal-channel.block" 2>&1 | tail -1 || return 1
  docker exec fabric-cli peer channel join -b "${CB}/../channel-artifacts/legal-channel.block" 2>&1 | tail -1
  docker exec -e CORE_PEER_ADDRESS=peer0.firmb.pangochain.com:8051 -e CORE_PEER_LOCALMSPID=FirmBMSP \
    -e "CORE_PEER_TLS_ROOTCERT_FILE=${CB}/peerOrganizations/firmb.pangochain.com/peers/peer0.firmb.pangochain.com/tls/ca.crt" \
    -e "CORE_PEER_MSPCONFIGPATH=${CB}/peerOrganizations/firmb.pangochain.com/users/Admin@firmb.pangochain.com/msp" \
    fabric-cli peer channel join -b "${CB}/../channel-artifacts/legal-channel.block" 2>&1 | tail -1
  docker exec -e CORE_PEER_ADDRESS=peer0.regulator.pangochain.com:9051 -e CORE_PEER_LOCALMSPID=RegulatorMSP \
    -e "CORE_PEER_TLS_ROOTCERT_FILE=${CB}/peerOrganizations/regulator.pangochain.com/peers/peer0.regulator.pangochain.com/tls/ca.crt" \
    -e "CORE_PEER_MSPCONFIGPATH=${CB}/peerOrganizations/regulator.pangochain.com/users/Admin@regulator.pangochain.com/msp" \
    fabric-cli peer channel join -b "${CB}/../channel-artifacts/legal-channel.block" 2>&1 | tail -1
  # anchor-peer updates — REQUIRED for gateway cross-org endorsement discovery
  docker exec fabric-cli peer channel update -o orderer1.pangochain.com:7050 -c legal-channel \
    -f "${CB}/../channel-artifacts/FirmAMSPanchors.tx" --tls --cafile "$ORDERER_TLS" 2>&1 | tail -1
  docker exec -e CORE_PEER_ADDRESS=peer0.firmb.pangochain.com:8051 -e CORE_PEER_LOCALMSPID=FirmBMSP \
    -e "CORE_PEER_TLS_ROOTCERT_FILE=${CB}/peerOrganizations/firmb.pangochain.com/peers/peer0.firmb.pangochain.com/tls/ca.crt" \
    -e "CORE_PEER_MSPCONFIGPATH=${CB}/peerOrganizations/firmb.pangochain.com/users/Admin@firmb.pangochain.com/msp" \
    fabric-cli peer channel update -o orderer1.pangochain.com:7050 -c legal-channel \
    -f "${CB}/../channel-artifacts/FirmBMSPanchors.tx" --tls --cafile "$ORDERER_TLS" 2>&1 | tail -1
  docker exec -e CORE_PEER_ADDRESS=peer0.regulator.pangochain.com:9051 -e CORE_PEER_LOCALMSPID=RegulatorMSP \
    -e "CORE_PEER_TLS_ROOTCERT_FILE=${CB}/peerOrganizations/regulator.pangochain.com/peers/peer0.regulator.pangochain.com/tls/ca.crt" \
    -e "CORE_PEER_MSPCONFIGPATH=${CB}/peerOrganizations/regulator.pangochain.com/users/Admin@regulator.pangochain.com/msp" \
    fabric-cli peer channel update -o orderer1.pangochain.com:7050 -c legal-channel \
    -f "${CB}/../channel-artifacts/RegulatorMSPanchors.tx" --tls --cafile "$ORDERER_TLS" 2>&1 | tail -1
  bash "$FAB/scripts/deploy-chaincode.sh" 2>&1 | tail -2 || return 1
}
rebuild(){  # rebuild <timeout-str e.g 500ms>
  local ts=$1
  log "rebuild network @ BatchTimeout=$ts"
  sed -i "s/BatchTimeout: [0-9a-z.]*/BatchTimeout: ${ts}/" "$CONFIGTX"; grep BatchTimeout "$CONFIGTX"
  (cd "$FAB" && docker compose -f docker-compose.fabric.yml down -v --remove-orphans 2>&1 | tail -1 || true)
  docker rm -f legalcc 2>/dev/null || true
  regen_artifacts
  (cd "$FAB" && docker compose -f docker-compose.fabric.yml up -d 2>&1 | tail -1)
  log "waiting 30s for peers..."; sleep 30
  join_deploy || { log "join/deploy FAILED for $ts"; return 1; }
  log "chaincode deployed @ $ts"
}
restart_backend(){
  bash /tmp/launch-backend.sh
  for i in $(seq 1 50); do curl -sf http://localhost:8080/actuator/health 2>/dev/null|grep -q UP && { log "backend healthy"; return 0; }; sleep 3; done
  log "backend did NOT become healthy"; return 1
}
setup_data(){ local OUT; OUT=$(python3 experiments/setup-bench-data.py 2>/tmp/sens_setup.err) || { cat /tmp/sens_setup.err; return 1; }; eval "$OUT"; export PANGOCHAIN_JWT_TOKEN PANGOCHAIN_TEST_CASE_ID PANGOCHAIN_TEST_DOC_ID; [ -n "${PANGOCHAIN_JWT_TOKEN:-}" ]; }

measure(){  # measure <bt_ms>
  local bt=$1 t L TPS P50 P95 ERR CPU TF
  log "warmup conc=$CONC 30s (discarded)"; PANGOCHAIN_CONCURRENCY=$CONC PANGOCHAIN_DURATION_SEC=30 node "$TOOL" >/dev/null 2>&1
  for t in $(seq 1 "$REPS"); do
    TF=$(mktemp)
    # /usr/bin/time -v captures the load-generator (node) %CPU for this run
    L=$(PANGOCHAIN_CONCURRENCY=$CONC PANGOCHAIN_DURATION_SEC=$DUR /usr/bin/time -v node "$TOOL" 2>"$TF")
    TPS=$(grep -oP 'TPS=\K[0-9.]+'<<<"$L"); P50=$(grep -oP 'P50=\K[0-9]+'<<<"$L"); P95=$(grep -oP 'P95=\K[0-9]+'<<<"$L"); ERR=$(grep -oP 'errors=\K[0-9]+'<<<"$L")
    CPU=$(grep -oP 'Percent of CPU this job got:\s*\K[0-9]+' "$TF"); rm -f "$TF"
    echo "exp_sens,fabric,$bt,duration60s,$CONC,$t,${TPS:-0},${P50:-NA},${P95:-NA},${ERR:-NA},${CPU:-NA},gateway,linux_x86_64" >> "$CSV"
    log "  bt=${bt}ms trial $t: $L client_cpu=${CPU:-NA}%"; sleep 5
  done
}

echo "experiment,mode,batch_timeout_ms,tool,concurrency,trial,tps,p50_ms,p95_ms,errors,client_cpu_pct,method,platform" > "$CSV"
for spec in 2s:2000 500ms:500 250ms:250; do
  TS=${spec%%:*}; BT=${spec##*:}
  log "================= BatchTimeout=$TS ================="
  rebuild "$TS" || { log "SKIP $TS (rebuild failed)"; continue; }
  restart_backend || { log "SKIP $TS (backend)"; continue; }
  setup_data || { log "SKIP $TS (data)"; continue; }
  measure "$BT"
done

log "================= restore BatchTimeout=2s ================="
rebuild "2s" && restart_backend && { setup_data && log "restored, gateway up"; } || log "WARN restore incomplete"

python3 - "$CSV" "$SJ" <<'PY'
import csv,sys,json,statistics
rows=list(csv.DictReader(open(sys.argv[1])))
by={}
for r in rows: by.setdefault(r['batch_timeout_ms'],[]).append(r)
def st(v):
    v=[x for x in v if x is not None]
    return dict(n=len(v),mean=round(statistics.mean(v),2),p50=round(statistics.median(v),2),
                min=round(min(v),2),max=round(max(v),2),stdev=round(statistics.stdev(v),2) if len(v)>1 else 0.0)
out={}
for bt,rs in by.items():
    tps=[float(r['tps']) for r in rs]
    cpu=[float(r['client_cpu_pct']) for r in rs if r['client_cpu_pct'] not in ('NA','')]
    out[bt]={"tool":"duration60s","conc":int(rs[0]['concurrency']),"reps":len(rs),
             "tps":st(tps),"client_cpu_pct":st(cpu) if cpu else None,
             "raw_tps":tps,"errors_total":sum(int(r['errors']) for r in rs if r['errors'] not in ('NA',''))}
json.dump(out,open(sys.argv[2],"w"),indent=2)
for bt in sorted(out,key=lambda x:int(x)):
    o=out[bt]; cpu=o['client_cpu_pct']['mean'] if o['client_cpu_pct'] else 'NA'
    print(f"  bt={bt}ms: tps mean={o['tps']['mean']} p50={o['tps']['p50']} client_cpu_mean={cpu}% err={o['errors_total']}")
PY
log "=== TASK SENS done -> $CSV ==="

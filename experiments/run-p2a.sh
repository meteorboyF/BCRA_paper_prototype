#!/usr/bin/env bash
# Experiment P2-A: BatchTimeout TPS measurement (500ms and 250ms)
# Measures committed TPS at concurrency 50/100/200 for each BatchTimeout.
# Saves results to results/p2a_*.csv / .txt / .pdf
# Usage: bash experiments/run-p2a.sh
set -uo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FABRIC_DIR="$REPO_DIR/pangochain-fabric"
RESULTS_DIR="$REPO_DIR/results"
ERRORS_LOG="$RESULTS_DIR/errors.log"
CONFIGTX="$FABRIC_DIR/configtx.yaml"
ORDERER_TLS="/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto/ordererOrganizations/pangochain.com/orderers/orderer1.pangochain.com/tls/ca.crt"
CRYPTO_BASE="/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto"
BACKEND_JAR="$REPO_DIR/pangochain-backend/target/pangochain-backend-2.0.0.jar"
BACKEND_LOG="/tmp/pangochain-backend-p2a.log"
LOADTEST="$REPO_DIR/experiments/caliper/pangochain-loadtest-configurable.js"
SETUP_SCRIPT="$REPO_DIR/experiments/setup-bench-data.py"

mkdir -p "$RESULTS_DIR"

# CSV header
CSV="$RESULTS_DIR/p2a_batchtimeout_tps.csv"
[ -f "$CSV" ] || echo "batch_timeout_ms,concurrency,trial,tps_committed" > "$CSV"

log()  { echo "[P2-A $(date +%H:%M:%S)] $*"; }
err()  { echo "[P2-A ERROR $(date +%H:%M:%S)] $*" | tee -a "$ERRORS_LOG"; }
try()  {
  # try <cmd...>: runs cmd, on failure logs and returns 1 (does not abort script)
  "$@" 2>&1 || { err "FAILED: $*"; return 1; }
  return 0
}

wait_backend() {
  local max=90 elapsed=0
  log "  Waiting for backend on :8080..."
  while [ $elapsed -lt $max ]; do
    if curl -sf http://localhost:8080/actuator/health 2>/dev/null | grep -q '"status":"UP"'; then
      log "  Backend healthy"
      return 0
    fi
    sleep 3; elapsed=$((elapsed + 3))
  done
  err "Backend did not become healthy in ${max}s"
  return 1
}

start_backend() {
  log "Starting Spring Boot backend..."
  pkill -f "pangochain-backend.*\.jar" 2>/dev/null || true
  sleep 2
  # Must run from pangochain-backend/ so relative crypto paths resolve
  local BACKEND_DIR="$REPO_DIR/pangochain-backend"
  (cd "$BACKEND_DIR" && nohup java -jar "$BACKEND_JAR" \
    --spring.jpa.hibernate.ddl-auto=validate \
    > "$BACKEND_LOG" 2>&1 &)
  sleep 1
  log "  Backend starting (log: $BACKEND_LOG)"
  wait_backend
}

regen_artifacts() {
  log "Regenerating channel artifacts (keeping existing crypto-config)..."
  rm -f "$FABRIC_DIR/channel-artifacts/genesis.block" \
        "$FABRIC_DIR/channel-artifacts/legal-channel.block" \
        "$FABRIC_DIR/channel-artifacts/legal-channel.tx" \
        "$FABRIC_DIR/channel-artifacts/"*anchors.tx
  docker run --rm \
    -v "$FABRIC_DIR:/workspace" \
    -w /workspace \
    hyperledger/fabric-tools:2.4 \
    bash -c "
      export FABRIC_CFG_PATH=/workspace
      mkdir -p /workspace/channel-artifacts
      configtxgen -profile LegalOrdererGenesis -channelID system-channel \
        -outputBlock /workspace/channel-artifacts/genesis.block
      configtxgen -profile LegalChannel \
        -outputCreateChannelTx /workspace/channel-artifacts/legal-channel.tx \
        -channelID legal-channel
      configtxgen -profile LegalChannel \
        -outputAnchorPeersUpdate /workspace/channel-artifacts/FirmAMSPanchors.tx \
        -channelID legal-channel -asOrg FirmAMSP
      configtxgen -profile LegalChannel \
        -outputAnchorPeersUpdate /workspace/channel-artifacts/FirmBMSPanchors.tx \
        -channelID legal-channel -asOrg FirmBMSP
      configtxgen -profile LegalChannel \
        -outputAnchorPeersUpdate /workspace/channel-artifacts/RegulatorMSPanchors.tx \
        -channelID legal-channel -asOrg RegulatorMSP
    " 2>&1
}

wait_fabric_up() {
  local max=120 elapsed=0
  log "  Waiting for Fabric containers..."
  while [ $elapsed -lt $max ]; do
    local n
    n=$(docker ps --filter "name=orderer1.pangochain.com" --filter "status=running" --format "{{.Names}}" | wc -l)
    [ "$n" -ge 1 ] && break
    sleep 5; elapsed=$((elapsed + 5))
  done
  log "  Sleeping 20s for peer initialization..."
  sleep 20
}

join_channel_and_deploy() {
  log "Creating and joining legal-channel..."
  docker exec fabric-cli peer channel create \
    -o orderer1.pangochain.com:7050 \
    -c legal-channel \
    -f "${CRYPTO_BASE}/../channel-artifacts/legal-channel.tx" \
    --tls --cafile "$ORDERER_TLS" \
    --outputBlock "${CRYPTO_BASE}/../channel-artifacts/legal-channel.block" 2>&1 \
    || { err "channel create failed"; return 1; }

  docker exec fabric-cli peer channel join \
    -b "${CRYPTO_BASE}/../channel-artifacts/legal-channel.block" 2>&1

  docker exec \
    -e CORE_PEER_ADDRESS=peer0.firmb.pangochain.com:8051 \
    -e CORE_PEER_LOCALMSPID=FirmBMSP \
    -e "CORE_PEER_TLS_ROOTCERT_FILE=${CRYPTO_BASE}/peerOrganizations/firmb.pangochain.com/peers/peer0.firmb.pangochain.com/tls/ca.crt" \
    -e "CORE_PEER_MSPCONFIGPATH=${CRYPTO_BASE}/peerOrganizations/firmb.pangochain.com/users/Admin@firmb.pangochain.com/msp" \
    fabric-cli peer channel join \
    -b "${CRYPTO_BASE}/../channel-artifacts/legal-channel.block" 2>&1

  docker exec \
    -e CORE_PEER_ADDRESS=peer0.regulator.pangochain.com:9051 \
    -e CORE_PEER_LOCALMSPID=RegulatorMSP \
    -e "CORE_PEER_TLS_ROOTCERT_FILE=${CRYPTO_BASE}/peerOrganizations/regulator.pangochain.com/peers/peer0.regulator.pangochain.com/tls/ca.crt" \
    -e "CORE_PEER_MSPCONFIGPATH=${CRYPTO_BASE}/peerOrganizations/regulator.pangochain.com/users/Admin@regulator.pangochain.com/msp" \
    fabric-cli peer channel join \
    -b "${CRYPTO_BASE}/../channel-artifacts/legal-channel.block" 2>&1

  # Anchor peers
  docker exec fabric-cli peer channel update \
    -o orderer1.pangochain.com:7050 -c legal-channel \
    -f "${CRYPTO_BASE}/../channel-artifacts/FirmAMSPanchors.tx" \
    --tls --cafile "$ORDERER_TLS" 2>&1

  docker exec \
    -e CORE_PEER_ADDRESS=peer0.firmb.pangochain.com:8051 \
    -e CORE_PEER_LOCALMSPID=FirmBMSP \
    -e "CORE_PEER_TLS_ROOTCERT_FILE=${CRYPTO_BASE}/peerOrganizations/firmb.pangochain.com/peers/peer0.firmb.pangochain.com/tls/ca.crt" \
    -e "CORE_PEER_MSPCONFIGPATH=${CRYPTO_BASE}/peerOrganizations/firmb.pangochain.com/users/Admin@firmb.pangochain.com/msp" \
    fabric-cli peer channel update \
    -o orderer1.pangochain.com:7050 -c legal-channel \
    -f "${CRYPTO_BASE}/../channel-artifacts/FirmBMSPanchors.tx" \
    --tls --cafile "$ORDERER_TLS" 2>&1

  docker exec \
    -e CORE_PEER_ADDRESS=peer0.regulator.pangochain.com:9051 \
    -e CORE_PEER_LOCALMSPID=RegulatorMSP \
    -e "CORE_PEER_TLS_ROOTCERT_FILE=${CRYPTO_BASE}/peerOrganizations/regulator.pangochain.com/peers/peer0.regulator.pangochain.com/tls/ca.crt" \
    -e "CORE_PEER_MSPCONFIGPATH=${CRYPTO_BASE}/peerOrganizations/regulator.pangochain.com/users/Admin@regulator.pangochain.com/msp" \
    fabric-cli peer channel update \
    -o orderer1.pangochain.com:7050 -c legal-channel \
    -f "${CRYPTO_BASE}/../channel-artifacts/RegulatorMSPanchors.tx" \
    --tls --cafile "$ORDERER_TLS" 2>&1

  log "All peers joined. Deploying chaincode..."
  bash "$FABRIC_DIR/scripts/deploy-chaincode.sh" 2>&1 \
    || { err "chaincode deploy failed"; return 1; }
  log "Chaincode deployed."
}

start_network_at() {
  local timeout_str=$1   # e.g. "500ms"
  log "=== Starting Fabric network at BatchTimeout=${timeout_str} ==="

  # Update configtx.yaml
  sed -i "s/BatchTimeout: [0-9a-z.]*/BatchTimeout: ${timeout_str}/" "$CONFIGTX"
  log "  configtx.yaml updated: BatchTimeout=${timeout_str}"
  grep "BatchTimeout" "$CONFIGTX"

  # Tear down (remove ledger volumes, keep crypto-config)
  (cd "$FABRIC_DIR" && docker compose -f docker-compose.fabric.yml down -v --remove-orphans 2>&1 || true)
  docker rm -f legalcc 2>/dev/null || true
  log "  Previous network torn down"

  regen_artifacts

  # Start containers
  (cd "$FABRIC_DIR" && docker compose -f docker-compose.fabric.yml up -d 2>&1)
  wait_fabric_up
  join_channel_and_deploy
}

setup_test_data() {
  log "Setting up test data via REST API..."
  local out
  # Capture stdout only; stderr (activation messages) flows naturally to log
  out=$(python3 "$SETUP_SCRIPT") || { err "setup-bench-data.py failed"; return 1; }
  eval "$out" 2>/dev/null || true
  # Guard against unbound variables (set -u) if eval did not set them
  if [ -z "${PANGOCHAIN_JWT_TOKEN:-}" ]; then
    err "JWT not set — setup output: $out"
    return 1
  fi
  log "  JWT ok, CASE_ID=${PANGOCHAIN_TEST_CASE_ID:-UNSET}, DOC_ID=${PANGOCHAIN_TEST_DOC_ID:-UNSET}"
  export PANGOCHAIN_JWT_TOKEN PANGOCHAIN_TEST_CASE_ID PANGOCHAIN_TEST_DOC_ID
}

run_trial() {
  local timeout_ms=$1 concurrency=$2 trial=$3
  local out tps
  out=$(PANGOCHAIN_CONCURRENCY=$concurrency PANGOCHAIN_DURATION_SEC=60 \
        node "$LOADTEST" 2>&1)
  tps=$(echo "$out" | grep -oP 'TPS=\K[0-9.]+' | head -1)
  if [ -z "$tps" ]; then
    err "Trial ${trial} failed to parse TPS: $out"
    tps="0"
  fi
  echo "$timeout_ms,$concurrency,$trial,$tps" >> "$CSV"
  echo "    trial $trial: $out"
}

# ─── Main ────────────────────────────────────────────────────────────────────

log "=== P2-A BatchTimeout TPS Experiment ==="
log "Results CSV: $CSV"

# Ensure app stack is running
log "Ensuring PostgreSQL + IPFS are up..."
(cd "$REPO_DIR" && docker compose up -d postgres ipfs ipfs2 2>&1 | tail -5)
sleep 3

for TIMEOUT_STR in 500ms 250ms; do
  TIMEOUT_MS="${TIMEOUT_STR%ms}"
  log ""
  log "════════ BatchTimeout = $TIMEOUT_STR ════════"

  start_network_at "$TIMEOUT_STR" || { err "Network start failed for $TIMEOUT_STR — skipping"; continue; }
  start_backend    || { err "Backend start failed — skipping $TIMEOUT_STR"; continue; }
  setup_test_data  || { err "Test data setup failed — skipping $TIMEOUT_STR"; continue; }

  # Warm-up: 10 clients, 30 seconds
  log "  Warm-up: 10 clients × 30 seconds..."
  PANGOCHAIN_CONCURRENCY=10 PANGOCHAIN_DURATION_SEC=30 node "$LOADTEST" 2>&1 | tail -2
  log "  Warm-up done. Starting trials..."

  for CONCURRENCY in 50 100 200; do
    log "  --- Concurrency = $CONCURRENCY ---"
    for TRIAL in 1 2 3 4 5; do
      run_trial "$TIMEOUT_MS" "$CONCURRENCY" "$TRIAL"
      sleep 10
    done
  done

  log "  BatchTimeout=$TIMEOUT_STR complete."
done

# Restore BatchTimeout=2s
log ""
log "=== Restoring BatchTimeout=2s ==="
sed -i "s/BatchTimeout: [0-9a-z.]*/BatchTimeout: 2s/" "$CONFIGTX"
grep "BatchTimeout" "$CONFIGTX"

start_network_at "2s"
start_backend    || true
log "Network restored to BatchTimeout=2s"

# ─── Summary ──────────────────────────────────────────────────────────────────
SUMMARY="$RESULTS_DIR/p2a_summary.txt"
log "Writing summary to $SUMMARY..."
python3 - "$CSV" "$SUMMARY" <<'PYEOF'
import csv, sys, statistics, math

csv_path, out_path = sys.argv[1], sys.argv[2]
rows = list(csv.DictReader(open(csv_path)))
groups = {}
for r in rows:
    key = (int(r['batch_timeout_ms']), int(r['concurrency']))
    groups.setdefault(key, []).append(float(r['tps_committed']))

lines = ["P2-A BatchTimeout TPS Summary", "=" * 50, ""]
for key in sorted(groups):
    bt_ms, conc = key
    vals = groups[key]
    mean = statistics.mean(vals)
    mn   = min(vals)
    mx   = max(vals)
    sd   = statistics.stdev(vals) if len(vals) > 1 else 0
    lines.append(f"BatchTimeout={bt_ms}ms  Concurrency={conc}")
    lines.append(f"  mean={mean:.2f}  min={mn:.2f}  max={mx:.2f}  stddev={sd:.2f}  n={len(vals)}")
    lines.append("")

text = "\n".join(lines)
print(text)
open(out_path, "w").write(text)
PYEOF

# ─── Chart ────────────────────────────────────────────────────────────────────
log "Generating P2-A chart..."
python3 - "$CSV" "$RESULTS_DIR/p2a_tps_chart.pdf" <<'PYEOF'
import csv, sys, statistics, collections
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

csv_path, pdf_path = sys.argv[1], sys.argv[2]
rows = list(csv.DictReader(open(csv_path)))
groups = {}
for r in rows:
    key = int(r['batch_timeout_ms'])
    conc = int(r['concurrency'])
    groups.setdefault(key, {}).setdefault(conc, []).append(float(r['tps_committed']))

fig, ax = plt.subplots(figsize=(8, 5))
colors  = {500: '#1f77b4', 250: '#d62728'}
markers = {500: 'o', 250: 's'}

for bt_ms in sorted(groups):
    concs  = sorted(groups[bt_ms])
    means  = [statistics.mean(groups[bt_ms][c]) for c in concs]
    stddevs= [statistics.stdev(groups[bt_ms][c]) if len(groups[bt_ms][c])>1 else 0 for c in concs]
    ax.errorbar(concs, means, yerr=stddevs,
                label=f'BatchTimeout={bt_ms}ms',
                color=colors.get(bt_ms, '#2ca02c'),
                marker=markers.get(bt_ms, '^'),
                linewidth=2, capsize=4)

ax.axhline(16.7, linestyle='--', color='grey', linewidth=1.2, label='1,000-lawyer demand (16.7 TPS)')
ax.axhline(26.7, linestyle='--', color='black', linewidth=1.2, label='Baseline peak (2s batch)')

ax.set_xlabel('Concurrent Clients')
ax.set_ylabel('Committed TPS')
ax.set_title('TPS vs Concurrency at Reduced BatchTimeout (Linux x86_64)')
ax.legend(loc='upper right', fontsize=9)
ax.grid(True, alpha=0.3)
ax.set_xticks([50, 100, 200])

plt.tight_layout()
plt.savefig(pdf_path)
print(f"Chart saved: {pdf_path}")
PYEOF

# ─── Paper integration notes ──────────────────────────────────────────────────
NOTES="$RESULTS_DIR/paper_integration_notes.txt"
python3 - "$CSV" "$NOTES" <<'PYEOF'
import csv, sys, statistics

csv_path, out_path = sys.argv[1], sys.argv[2]
rows = list(csv.DictReader(open(csv_path)))
groups = {}
for r in rows:
    key = (int(r['batch_timeout_ms']), int(r['concurrency']))
    groups.setdefault(key, []).append(float(r['tps_committed']))

def mean(k): return statistics.mean(groups[k]) if k in groups else None

# Best TPS per BatchTimeout (across concurrency levels)
best = {}
for (bt, c), vals in groups.items():
    m = statistics.mean(vals)
    if bt not in best or m > best[bt][0]:
        best[bt] = (m, c)

lines = []
lines.append("P2-A — Sentences for Paper (Section VI-A)")
lines.append("=" * 60)
lines.append("")

for bt in sorted(best):
    peak_tps, peak_conc = best[bt]
    lines.append(f"BatchTimeout={bt}ms (peak TPS={peak_tps:.1f} @ {peak_conc} clients):")
    if bt == 500:
        comp = "exceeds" if peak_tps > 100 else "falls short of"
        lines.append(
            f"  We measured a peak committed TPS of {peak_tps:.1f} at BatchTimeout=500 ms with "
            f"{peak_conc} concurrent clients, which {comp} the ~100 TPS projection cited in "
            f"Section VI-A. The data show that reducing the orderer batch timeout from 2 s to "
            f"500 ms {'increases' if peak_tps > 26.7 else 'does not meaningfully increase'} throughput, "
            f"while the impact on latency is addressed in the companion latency table."
        )
    elif bt == 250:
        lines.append(
            f"  At BatchTimeout=250 ms the peak committed TPS is {peak_tps:.1f} "
            f"(at {peak_conc} clients). "
            f"Further reducing the timeout below 500 ms {'continues to improve' if peak_tps > best.get(500,(0,0))[0] else 'does not further improve'} "
            f"raw throughput, suggesting that block assembly overhead is {'not' if peak_tps <= best.get(500,(0,0))[0] else ''} "
            f"the dominant bottleneck at this load level."
        )
    lines.append("")

# Discrepancy flags
lines.append("DISCREPANCY FLAGS")
lines.append("-" * 40)
canonical_baseline = 26.7
discrepancies = []
for (bt, c), vals in groups.items():
    m = statistics.mean(vals)
    if abs(m - canonical_baseline) / canonical_baseline > 0.10:
        discrepancies.append((bt, c, m))

if discrepancies:
    for bt, c, m in discrepancies:
        pct = (m - canonical_baseline) / canonical_baseline * 100
        lines.append(
            f"WARNING: BatchTimeout={bt}ms Concurrency={c} measured TPS={m:.1f} "
            f"differs from baseline 26.7 TPS by {pct:+.0f}%."
        )
        lines.append("  Possible causes: CouchDB state DB serialization, Raft heartbeat overhead,")
        lines.append("  or Docker resource contention on single-host testbed.")
else:
    lines.append("No discrepancies >10% vs baseline 26.7 TPS detected.")

text = "\n".join(lines)
print(text)
open(out_path, "a").write("\n\n" + text)
PYEOF

log ""
log "=== P2-A COMPLETE ==="
log "Output files:"
for f in "$CSV" "$SUMMARY" "$RESULTS_DIR/p2a_tps_chart.pdf" "$NOTES"; do
  [ -f "$f" ] && log "  OK  $f" || log "  MISSING $f"
done

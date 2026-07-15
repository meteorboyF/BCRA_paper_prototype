#!/bin/bash
# Experiment 3 — IPFS upload latency by file size
# Uploads directly to IPFS Kubo HTTP API (port 5001)
# Total E2E latency = IPFS upload + Fabric commit (~2132ms from CLI benchmark)
# Usage: bash experiments/measure-ipfs-latency.sh

IPFS_API="http://localhost:5001"
REPS=10
FABRIC_COMMIT_P50=2132  # From measure-regdoc-latency.sh

echo "=== Experiment 3 — File Size Impact on IPFS Upload Latency ==="
echo "Date: $(date -Iseconds)"
echo "IPFS API: $IPFS_API"
echo "Fabric commit baseline (constant): ${FABRIC_COMMIT_P50}ms"
echo ""

# Check IPFS is reachable
if ! curl -sf -X POST "${IPFS_API}/api/v0/version" > /dev/null 2>&1; then
  echo "ERROR: IPFS API not reachable at $IPFS_API"
  exit 1
fi

echo "| File Size | Sample | IPFS Upload (ms) |"
echo "|-----------|--------|-----------------|"

for SIZE_MB in 1 5 10 20 30 50; do
  SIZE_BYTES=$((SIZE_MB * 1024 * 1024))

  # Generate random binary data
  dd if=/dev/urandom of="/tmp/bench-${SIZE_MB}mb.bin" bs=$SIZE_BYTES count=1 2>/dev/null

  declare -a times_arr
  total=0
  for i in $(seq 1 $REPS); do
    START=$(date +%s%3N)
    curl -sf -X POST "${IPFS_API}/api/v0/add?pin=false" \
      -F "file=@/tmp/bench-${SIZE_MB}mb.bin" > /dev/null 2>&1
    END=$(date +%s%3N)
    ELAPSED=$((END - START))
    times_arr+=($ELAPSED)
    total=$((total + ELAPSED))
    echo "| ${SIZE_MB}MB | $i | ${ELAPSED}ms |"
  done

  # Stats
  python3 - "${SIZE_MB}" "${FABRIC_COMMIT_P50}" "${times_arr[@]}" <<'PYEOF'
import sys
size_mb = int(sys.argv[1])
fabric_p50 = int(sys.argv[2])
ipfs_times = [int(x) for x in sys.argv[3:]]
n = len(ipfs_times)
ipfs_sorted = sorted(ipfs_times)
ipfs_mean = sum(ipfs_times) / n
ipfs_p50 = ipfs_sorted[n // 2]
ipfs_p95 = ipfs_sorted[min(int(n * 0.95), n-1)]
total_p50 = fabric_p50 + ipfs_p50
total_p95 = fabric_p50 + ipfs_p95
print(f"\n  {size_mb}MB IPFS: mean={ipfs_mean:.0f}ms P50={ipfs_p50}ms P95={ipfs_p95}ms")
print(f"  {size_mb}MB TOTAL (IPFS+Fabric): P50={total_p50}ms P95={total_p95}ms")
print(f"  {size_mb}MB IPFS est (from prior baseline 2081ms): {total_p50 - 2081}ms\n")
PYEOF

  unset times_arr
done

echo "=== Done ==="
echo "IPFS estimate baseline: Total P50 - 2081ms (from prior Linux 2026-05-15)"

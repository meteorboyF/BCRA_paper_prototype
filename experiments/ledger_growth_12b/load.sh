#!/usr/bin/env bash
# Phase B — per-document ledger cost on the current build.
#
# Registers a bounded batch of documents through the fabric-gateway SDK (the same
# path Experiment 12's preload used, so bytes/doc is comparable to the published
# ~7 KB/doc/peer) and brackets it with ledger-size snapshots. Phase A's
# background rate is subtracted in analysis, because heartbeat blocks keep
# accruing during the load window and would otherwise be charged to the
# documents.
#
#   load.sh <out-dir> [count] [concurrency]
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT="${1:?usage: load.sh <out-dir> [count] [concurrency]}"
COUNT="${2:-2000}"
CONC="${3:-40}"
CSV="$OUT/ledger_size.csv"
mkdir -p "$OUT"

echo "=== Phase B: $COUNT documents, concurrency $CONC ==="
bash "$HERE/snapshot.sh" "$CSV" load_start

set +e
node "$HERE/preload12b.js" --count "$COUNT" --concurrency "$CONC" 2>&1 | tee "$OUT/phase_b_preload.log"
rc=${PIPESTATUS[0]}
set -e

# The preloader's last stdout line is the JSON summary; keep it for the analysis,
# which divides by 'committed' rather than by the requested count.
tail -20 "$OUT/phase_b_preload.log" | grep -o '{.*"doc_id_prefix".*}' | tail -1 > "$OUT/phase_b_preload.json" || true

# Let the last commits settle into a block before the closing snapshot.
sleep 10
bash "$HERE/snapshot.sh" "$CSV" load_end

if [[ "$rc" != "0" ]]; then
  echo "preload exited $rc — see $OUT/phase_b_preload.log; bytes/doc may be invalid" >&2
  exit "$rc"
fi
echo "=== Phase B done -> $CSV ==="

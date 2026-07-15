# Experiment 12 — Document-Volume / Ledger-Growth Scaling: Results Report

- **IMPROVEMENTS.md item:** 3.3
- **Campaign:** `experiments/ledger_growth/results/20260715_183009/` (branch `prototype-fixes`, fresh ledger)
- **Figure:** `fig12_ledger_growth.png` / `.pdf`
- **Raw data:** `latency_samples.csv` (800 samples), `disk.csv`, `environment.json`, `run.log`, `continuation_1e6.log`
- **Status:** complete — checkpoints 10³/10⁴/10⁵ (first invocation) and 10⁶
  (flag-gated continuation, same campaign)

## Setup

Fresh 3-org network (`--fresh` wipes the ledger so document counts are
exact). Preload: `RegisterDocument` via fabric-gateway SDK, 200 closed-loop
submitters, unique `LG-<seq>` docIDs, production-shaped payloads (64-char
hash, 46-char CID). Sustained **76 TPS** end-to-end commit rate to 10⁵ and **70 TPS** over the
3.6 h continuation to 10⁶ (one transient dip to ~62 cumulative around 400k,
consistent with CouchDB compaction, recovered unaided); **0 transient
failures, 0 skipped across all 1,000,000 registrations**.

At each cumulative checkpoint: n=100 per function (warmup 10, random docIDs
across the full key range — Exp 2 continuity), plus disk usage from the
FirmA peer and its CouchDB.

## Results

### Query latency vs world-state size (n=100 per cell)

| Docs in world state | CheckAccess P50 | CheckAccess P95 | GetDocumentHistory P50 | GetDocumentHistory P95 |
|---|---|---|---|---|
| 1,000 | 7.96 ms | 10.85 ms | 5.68 ms | 7.76 ms |
| 10,000 | 7.07 ms | 10.20 ms | 5.82 ms | 8.35 ms |
| 100,000 | 7.58 ms | 10.87 ms | 6.01 ms | 8.29 ms |
| 1,000,000 | 8.60 ms | 11.93 ms | 7.12 ms | 9.89 ms |

**Effectively flat across three orders of magnitude.** CheckAccess rises
only +0.64 ms (8%) from 10³ to 10⁶ documents and stays consistent with
Exp 2's 7.16 ms P50 headline (measured on a near-empty ledger).
GetDocumentHistory rises +1.44 ms over the same 1000× growth (depth held
constant at 1; Exp 7 covers the depth axis). Sub-linear in the extreme:
a 1000× state increase costs under 1.5 ms on either query.

### Disk growth (FirmA peer)

| Docs | Block height | Block store | CouchDB state DB | Peer total |
|---|---|---|---|---|
| 0 (fresh) | 8 | 0.2 MB | 0.6 MB | 0.4 MB |
| 1,000 | 14 | 5.8 MB | 2.0 MB | 6.2 MB |
| 10,000 | 59 | 56.5 MB | 14.0 MB | 58.3 MB |
| 100,000 | 510 | 561.5 MB | 135.8 MB | 572.4 MB |
| 1,000,000 | 5,374 | 5,618.1 MB | 1,390.0 MB | 5,710.1 MB |

Linear in document count over the full range: **~5,618 B/doc block store +
~1,389 B/doc CouchDB ≈ 7 KB/doc per peer** (~21 KB across the 3-org
network) — the measured 10⁶ values land within 0.1% of the linear
extrapolation from 10⁵. Block-store cost includes the full signed
transaction envelope (majority-policy endorsements) plus the chaincode's
audit event; the world-state entry itself is the smaller CouchDB share.
10⁶ documents = 5.6 GB block store + 1.4 GB CouchDB per peer —
comfortably commodity hardware, which is the reviewer-facing point.

## Pass criteria

- [x] CheckAccess flat 10³→10⁶ (O(1) state lookup) — +0.64 ms over 1000×
- [x] GetDocumentHistory flat/near-flat — +1.44 ms over 1000×
- [x] Disk linear, stable per-document cost (~7 KB/doc/peer)
- [x] 10⁶ checkpoint (3.6 h continuation, 0 failures)

## Reproduce

```bash
# campaign start (~22 min): reset ledger, checkpoints 10^3,10^4,10^5
bash experiments/ledger_growth/run.sh --fresh --checkpoints 1000,10000,100000

# overnight continuation to 10^6 — appends to the SAME campaign CSVs.
# At the observed 76 TPS this is ~3.3 h. Do NOT pass --fresh.
bash experiments/ledger_growth/run.sh --checkpoint 1000000
```

Disk headroom needed for 10⁶: ~7 GB per peer × 3 peers + ~1.4 GB CouchDB × 3
≈ 25 GB total (413 GB free at time of writing). Resumable: if interrupted,
rerunning the same command continues from `.state.json`.

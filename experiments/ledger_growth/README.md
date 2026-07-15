# Experiment 12 — Document-Volume / Ledger-Growth Scaling

Implements **IMPROVEMENTS.md item 3.3**. Exp 7 measured history-depth cost
(107 entries on one key); this experiment covers the other axis: how query
latency and storage behave as the **number of documents** (world-state keys)
grows from 10⁴ to 10⁶.

## What it measures

At each cumulative checkpoint (default 10⁴, 10⁵; 10⁶ flag-gated):

- `CheckAccess` latency (n=100, warmup 10, random preloaded docIDs) — the
  ledger ACL decision on the release path vs world-state size.
- `GetDocumentHistory` latency (n=100, history depth constant at 1) — the
  block-store history index vs ledger size.
- Disk: peer `/var/hyperledger/production` total, block store
  (`ledgersData/chains`), CouchDB data dir, and block height → per-document
  growth rates.

Preload: `RegisterDocument` via the fabric-gateway SDK (same client path as
the backend and Exp 11), 200 concurrent closed-loop submitters, unique
`LG-<seq>` docIDs, production-shaped payloads. Resumable via `.state.json`.

## Run

```bash
# campaign start: reset ledger, run checkpoints 10^4 and 10^5 (~15 min)
bash experiments/ledger_growth/run.sh --fresh

# overnight continuation to 10^6 (~1.5-2 h at ~170 TPS); appends to the
# same campaign CSVs — do NOT pass --fresh
bash experiments/ledger_growth/run.sh --checkpoint 1000000
```

`--fresh` wipes the Fabric network so the doc count is exact (the Exp 11
Caliper run leaves ~24k residual documents otherwise). Custom checkpoint
lists: `--checkpoints 10000,50000,100000`.

## Outputs

Campaign dir `results/YYYYMMDD_HHMMSS/` (stable across continuations,
recorded in `.state.json`): `latency_samples.csv` (per-sample),
`disk.csv` (per-checkpoint), `environment.json`, `run.log`,
`fig12_ledger_growth.png/.pdf`.

## Pass criteria

- CheckAccess P50 flat (O(1) CouchDB key lookup) from 10⁴ to 10⁶ docs.
- GetDocumentHistory P50 flat or near-flat (indexed history lookup).
- Disk growth linear in document count; per-document cost stable and small
  (order of a few KB/doc across block store + state DB).

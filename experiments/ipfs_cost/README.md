# Experiment 10 — IPFS Storage/Retrieval Cost Analysis

Implements **IMPROVEMENTS.md item 3.4**. Exp 3 established upload-path
file-size independence to 50 MB; this experiment covers the remaining IPFS
questions a reviewer will ask: retrieval cost, replication cost, storage
overhead, and failure behaviour on the storage tier (complementing Exp 9,
which kills Fabric only).

## What it measures

| Phase | Question | Output |
|---|---|---|
| `retrieval` | Retrieval latency vs file size (1–50 MB, anchored to Exp 3's range) under concurrent load, from a node holding the blocks (*local*) vs a node that must fetch over the swarm (*remote*). Each request targets a distinct CID so concurrent remote fetches are independent cold transfers. | `retrieval.csv` |
| `replication` | Cost of the 2nd and 3rd replica: `pin add` wall time on a node that does not yet have the blocks, plus repo growth per replica. | `replication.csv` |
| `storage` | UnixFS DAG overhead vs raw ciphertext bytes, CID metadata size, and total footprint at 2x / 3x replication. Payloads are `os.urandom` (incompressible), matching AES-256-GCM ciphertext, which itself adds only a constant 12 B IV + 16 B tag. | `storage.csv` |
| `nodedown` | With a document pinned on 2 of 3 nodes: retrieval with all nodes up, with one replica stopped, with all replicas stopped (expected: timeout, no data served), and after recovery. | `node_down.csv` |

## Topology

Three Kubo v0.27.0 nodes: the app's `ipfs` (5001, pin origin) and `ipfs2`
(5002, 2nd replica) from the root compose file, plus a bench-only `ipfs3`
(5003, retriever / 3rd replica) from `docker-compose.ipfs3.yml`.

The kubo `server` profile ships `Swarm.AddrFilters` that block private
address ranges, so containers cannot dial each other across the docker
bridge and would silently fall back to public relays — corrupting latency
numbers. `run.sh` snapshots the original filters to `.addrfilters-*.json`,
clears them for the benchmark, and `run.sh --teardown` restores them.
Latencies are therefore docker-bridge RTT (LAN-like consortium assumption);
combine with Exp 5's WAN model for wide-area estimates.

## Run

```bash
bash experiments/ipfs_cost/run.sh              # full run (~10–20 min)
bash experiments/ipfs_cost/run.sh --teardown   # restore node config, stop ipfs3
```

Useful overrides:

```bash
PANGOCHAIN_IPFS_SIZES=1,10 PANGOCHAIN_IPFS_CONC=1,8 PANGOCHAIN_IPFS_REPS=8 \
PANGOCHAIN_IPFS_PHASES=retrieval,storage \
bash experiments/ipfs_cost/run.sh              # quick smoke run
```

`bench.py` can also be invoked directly; see `bench.py --help` for all flags
(`--sizes`, `--concurrency`, `--reps`, `--nodedown-size`, ...).

## Outputs

Each run writes `experiments/ipfs_cost/results/YYYYMMDD_HHMMSS/` containing
`retrieval.csv`, `replication.csv`, `storage.csv`, `node_down.csv`,
`summary.json`, `environment.json`, `run.log`, and
`fig10_ipfs_cost.png/.pdf` (2x2 panel figure in the Exp 1–9 house style).

## Pass criteria

- Retrieval latency grows roughly linearly with size; remote adds a
  transfer premium over local; no failures at any concurrency level.
- 3rd-replica pin cost is comparable to the 2nd (pins are independent).
- DAG overhead is small and stable (~1 % class, from 256 KiB chunking).
- `one_replica_down`: all requests still served (from the surviving pin).
- `all_replicas_down`: **zero** requests served, clean timeouts.
- `recovery`: service resumes without manual repair.

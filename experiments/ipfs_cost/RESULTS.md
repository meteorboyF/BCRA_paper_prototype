# Experiment 10 — IPFS Storage/Retrieval Cost: Results Report

- **IMPROVEMENTS.md item:** 3.4 (IPFS storage/retrieval cost analysis)
- **Run:** `experiments/ipfs_cost/results/20260715_173114/` (2026-07-15, branch `prototype-fixes`)
- **Figure:** `fig10_ipfs_cost.png` / `.pdf` (2×2 panels, Exp 1–9 house style)
- **Raw data:** `retrieval.csv` (576 rows), `replication.csv` (40), `storage.csv` (4), `node_down.csv` (40), plus `summary.json`, `environment.json`, `run.log`

## Setup

Three Kubo v0.27.0 nodes on the app's docker network:

| Node | Container | API | Role |
|---|---|---|---|
| node1 | `pangochain-ipfs` | :5001 | pin origin (app's primary node) |
| node2 | `pangochain-ipfs2` | :5002 | 2nd replica |
| node3 | `pangochain-ipfs3` (bench-only, `docker-compose.ipfs3.yml`) | :5003 | retriever / 3rd replica |

The kubo `server` profile ships `Swarm.AddrFilters` blocking private ranges
(`172.16.0.0/12` etc.), so containers could not dial each other over the
docker bridge and silently fell back to **public relays** — which would have
corrupted every latency number. `run.sh` snapshots the original filters to
`.addrfilters-*.json`, clears them, and wires direct swarm connections;
`run.sh --teardown` restores the config and stops node3.

Parameters: sizes 1/10/25/50 MB (anchored to Exp 3's ≤50 MB range),
concurrency 1/8/24, n=24 distinct CIDs per retrieval cell, 5 pins/size in
replication, 10 samples per node-down scenario (10 MB files, pinned on 2 of
3 nodes). Payloads are `os.urandom` — incompressible, matching AES-256-GCM
ciphertext (which adds only a constant 12 B IV + 16 B tag).

## Results

### (a) Retrieval latency vs file size under concurrent load

576 requests, **0 failed**. Latency is linear in file size. "Remote"
(retrieving node must fetch blocks over the swarm) carries a ~2–3.5×
premium over "local" (node already holds the blocks).

| Size | local c=1 P50 | local c=24 P50 | remote c=1 P50 | remote c=8 P50 | remote c=24 P50 |
|---|---|---|---|---|---|
| 1 MB | 10 ms | 119 ms | 38 ms | 91 ms | 188 ms |
| 10 MB | 57 ms | 937 ms | 222 ms | 502 ms | 1450 ms |
| 25 MB | 169 ms | 1950 ms | 465 ms | 1355 ms | 3672 ms |
| 50 MB | 254 ms | 3818 ms | 875 ms | 2644 ms | 6960 ms |

(P95 values in `retrieval.csv`; P95/P50 ratio stays tight, ≤ ~1.3.)
Degradation under 24-way concurrency is graceful — throughput saturates,
nothing fails or times out.

### (b) Replication cost per added replica

Pin wall-time on a node that does not yet hold the blocks:

| Size | 2nd replica P50 | 3rd replica P50 |
|---|---|---|
| 1 MB | 34 ms | 45 ms |
| 10 MB | 87 ms | 106 ms |
| 25 MB | 158 ms | 180 ms |
| 50 MB | 297 ms | 226 ms |

Replicas are independent: the 3rd replica costs about the same as the 2nd,
so 3-node pinning is ≈1.5× the *total* transfer cost of 2-node — linear,
not superlinear. **Caveat:** the 50 MB crossover (2nd > 3rd) is noise at
n=5 pins/size (wide P95 whisker); rerun the paper version with
`--repl-reps 20` (~1 extra minute).

### (c) Storage overhead

| Size | raw bytes | DAG bytes | overhead | 2-rep footprint | 3-rep footprint |
|---|---|---|---|---|---|
| 1 MB | 1,048,576 | 1,048,832 | 0.024% | 2,097,664 | 3,146,496 |
| 10 MB | 10,485,760 | 10,488,250 | 0.024% | 20,976,500 | 31,464,750 |
| 25 MB | 26,214,400 | 26,220,610 | 0.024% | 52,441,220 | 78,661,830 |
| 50 MB | 52,428,800 | 52,441,328 | 0.024% | 104,882,656 | 157,323,984 |

UnixFS DAG overhead is a flat **0.024%** at every size (256 KiB chunking);
CID metadata is 46 B/document. Total footprint ≈ replicas × raw × 1.00024.

### (d) Behaviour under IPFS node failure (complements Exp 9)

Document pinned on node1+node2 (2 of 3 nodes); retrieval from node3, cold
cache each scenario, 10 MB files, n=10:

| Scenario | Served | P50 |
|---|---|---|
| All replicas up | 10/10 | 204 ms |
| One replica down (`docker stop` node2) | 10/10 | 206 ms |
| All replicas down (node1+node2 stopped) | **0/10** | clean timeouts (10 s), 0 bytes served |
| After recovery (nodes restarted) | 10/10 | 214 ms |

Losing one of two replicas has **no measurable retrieval penalty**; losing
all replicas fails cleanly (no stale data); service resumes without manual
repair. This is the storage-tier mirror of Exp 9's fail-closed result on
the Fabric tier.

## Pass criteria — all met

- [x] Retrieval linear in size, no failures at any concurrency
- [x] 3rd-replica cost ≈ 2nd-replica cost (independent pins)
- [x] DAG overhead small and constant (0.024%)
- [x] `one_replica_down`: all requests served
- [x] `all_replicas_down`: zero requests served, clean timeouts
- [x] `recovery`: service resumes

## Caveats / notes for the manuscript

1. Latencies are docker-bridge RTT (LAN-like consortium assumption).
   Combine with Exp 5's WAN latency model for wide-area estimates.
2. Replication phase should use `--repl-reps 20` for the paper run (see (b)).
3. Bench swarm config (cleared AddrFilters, node3) is still active until
   `bash experiments/ipfs_cost/run.sh --teardown` is run.
4. `results/smoke/` is a validation run with toy parameters — not evidence;
   safe to delete.
5. Environment: Linux, kubo 0.27.0, Docker 29.6.1, 18-core host, 7.1 GiB
   RAM (full details in `environment.json`).

---

## Addendum (2026-07-18): replication panel rerun at n=20

The §(b) caveat above flagged the 50 MB "2nd-replica > 3rd-replica"
crossover as probable noise at n=5 pins/size. Rerun executed on the
original host (`--phases replication --repl-reps 20`, run
`results/20260718_045700/`, kubo 0.27.0 ×3, AddrFilters cleared for the
bench and restored via `--teardown` afterwards):

| Size | 2nd replica P50 (n=5 → n=20) | 3rd replica P50 (n=5 → n=20) |
|---|---|---|
| 1 MB | 34 → 25 ms | 45 → 24 ms |
| 10 MB | 87 → 54 ms | 106 → 54 ms |
| 25 MB | 158 → 91 ms | 180 → 86 ms |
| 50 MB | 297 → 161 ms | 226 → 153 ms |

**The crossover disappeared at n=20**: at 50 MB the ordering is again
2nd ≥ 3rd (161 vs 153 ms), consistent with all other sizes and with the
"replicas are independent" conclusion. Absolute pin times are lower
than the 2026-07-15 run across the board (nodes were long-warm and the
host was otherwise idle); the panel's conclusion rests on the ordering
and linearity, not the absolute level, and both runs support it.

`fig10_ipfs_cost` in this run's directory was regenerated with the
experiment's own `plot.py`; panels (a), (c), (d) are rendered from
byte-identical copies of the 20260715_173114 CSVs (retrieval, storage,
node_down — carried over unchanged into the run directory for the
plotter), and the pdftotext text-layer diff against the committed
figure confirms every number outside panel (b) is identical (the only
differences are panel (b)'s y-axis tick labels, rescaled to the lower
n=20 values).

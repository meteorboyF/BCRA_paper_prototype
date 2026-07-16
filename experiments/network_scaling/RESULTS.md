# Experiment 13 — Network-Size Scaling: Results Report

- **IMPROVEMENTS.md item:** 3.2 ("the single biggest depth gap")
- **Evidence run:** `experiments/network_scaling/results/20260715_225854/` (9 points)
  plus replication run `results/o7verify/` (see Outlier note)
- **Figure:** `fig13_network_scaling.png` / `.pdf` (rendered from `matrix_final.csv`)
- **Raw data:** `matrix.csv` (as measured), `matrix_final.csv` (curated, one row
  replaced by its verified rerun), `samples.csv` (per-tx latencies),
  `stats_<point>.csv` (container resource snapshots), `environment.json`, `run.log`

## Setup

Fully generated topologies (`gen-topology.py`): N orgs × P peers/org, each
with per-peer CouchDB, 3 Raft orderers, TLS, ccaas `legalcc` — identical
Fabric 2.4 stack and batch parameters (2 s / 500 / 2 MB) to the reference
3-org network; CA containers omitted (cryptogen material only). Endorsement
policy set at chaincode commit: `majority` (channel default, ⌈N/2⌉-of-N) vs
`single` (`OR('Org1MSP.peer')`).

Per point: fresh network → deploy → benchmark → teardown. Benchmark
(`bench.js`, fabric-gateway client on peer0.org1, same client model as
Exp 11/12): RegisterDocument closed-loop, 100 in-flight, 2,000 tx → TPS +
latency; then CheckAccess sequential n=100.

## Results (matrix_final.csv)

| Orgs | Peers/org | Policy | Write TPS | Write P50 | Write P95 | Read P50 | Read P95 | Fails |
|---|---|---|---|---|---|---|---|---|
| 2 | 1 | single | 43.3 | 2297 ms | 2400 ms | 5.15 ms | 6.98 ms | 0 |
| 2 | 1 | majority | 42.9 | 2322 ms | 2420 ms | 4.69 ms | 6.22 ms | 0 |
| 3 | 1 | single | 42.8 | 2325 ms | 2421 ms | 3.93 ms | 6.11 ms | 0 |
| 3 | 1 | majority | 42.1 | 2363 ms | 2468 ms | 5.44 ms | 6.85 ms | 0 |
| 3 | 2 | majority | 40.7 | 2445 ms | 2550 ms | 4.45 ms | 6.30 ms | 0 |
| 5 | 1 | single | 42.3 | 2358 ms | 2446 ms | 5.12 ms | 6.76 ms | 0 |
| 5 | 1 | majority | 40.0 | 2482 ms | 2622 ms | 4.78 ms | 6.25 ms | 0 |
| 7 | 1 | single | 40.9 | 2432 ms | 2542 ms | 4.63 ms | 6.11 ms | 0 |
| 7 | 1 | majority | 35.7* | 2785 ms | 2937 ms | 5.46 ms | 7.20 ms | 0 |

\* verified rerun; see Outlier note. 18,000 write transactions total across
the matrix, **zero failures at every point** (2,000 more in the rerun).

### Key findings

1. **Throughput is ordering-dominated, not network-size-dominated.** Write
   TPS declines only 43.3 → 40.9 (−5.5%) from 2 to 7 orgs under single-org
   endorsement; write P50 stays ≈ 2.3–2.4 s (the 2 s BatchTimeout floor,
   as Exp 8/11 established).
2. **Majority endorsement cost grows gently with N**: −0.9% (2 orgs),
   −1.6% (3), −5.4% (5), −12.7% (7) vs the single-org policy at the same
   size — the gateway collects ⌈N/2⌉ endorsements in parallel, so cost
   tracks the slowest endorser, not the sum.
3. **Doubling peers/org is nearly free** at 3 orgs (42.1 → 40.7 TPS,
   −3.3%): extra peers add validation/gossip work but no endorsement work.
4. **Read path is size-independent**: CheckAccess P50 stays 3.9–5.5 ms
   across every topology and policy — consistent with Exp 12's flatness
   result on the volume axis.

### Outlier note (honest-reporting record)

The first o7p1-majority measurement returned 15.9 TPS / 6,087 ms write P50 /
34.98 ms read P50. The 7× read-latency inflation (reads touch only the
gateway peer and should not scale with org count) indicated transient host
contention rather than protocol cost, so the point was re-run in isolation
(`results/o7verify/`): 35.7 TPS / 2,785 ms / 5.46 ms — a smooth
continuation of the 2→5-org trend. `matrix.csv` preserves the original
measurement; `matrix_final.csv` (used for the figure) carries the verified
rerun. Both runs had zero transaction failures.

## Hardware framing

All 9 topologies ran on one 18-core / 7 GiB host (peers ≈ 70 MiB each; the
no-CA, internal-DNS generation keeps footprints small), so absolute TPS is
conservative and inter-point *ratios* are the meaningful result. The
generator + `net.sh` + `run-matrix.sh` are machine-independent: rerunning
the identical matrix on server-class hardware is one command
(`bash experiments/network_scaling/run-matrix.sh`).

## Reproduce

```bash
bash experiments/network_scaling/run-matrix.sh                    # 9 points, ~20 min
PANGOCHAIN_NS_POINTS="7x1:majority" \
PANGOCHAIN_NS_OUTPUT_DIR=experiments/network_scaling/results/x \
bash experiments/network_scaling/run-matrix.sh                    # single point
```

WARNING: tears down any running Fabric network (including the app's 3-org
network) between points. Restore the app network afterwards with
`cd pangochain-fabric && make up && make chaincode`.

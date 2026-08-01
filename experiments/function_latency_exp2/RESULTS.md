# Experiment 2 re-run — function-level CheckAccess latency on the current build

- **Reviewer item:** re-measurement of Experiment 2 after the Tier 1 fixes. The
  published 6.51 / 7.16 ms figures predate the TimeAnchor freshness read (M2),
  the removal of the implicit organization fallback (M5), and denial anchoring
  (M10), so they no longer describe the shipped build.
- **Evidence run:** `results/20260801_130810/`
- **Build under test:** chaincode **legalcc v1.19, sequence 9**; backend at
  `prototype-fixes` HEAD; freshness check **enabled**
  (`disableFreshnessCheckForMeasurement = false`).
- **Reproduce:** `bash run.sh` then `python3 analyze.py results/<stamp>`

## Headline

| Arm | n | P50 | 95 % CI (bootstrap) | mean | SD |
|---|---|---|---|---|---|
| Fabric `CheckAccess`, bracket 1 | 100 | 12.63 ms | [12.50, 13.30] | 13.19 | 2.81 |
| PostgreSQL ACL (`db_only`) | 100 | **8.89 ms** | [8.51, 9.28] | 9.53 | 3.17 |
| Fabric `CheckAccess`, bracket 2 | 100 | 11.28 ms | [10.65, 11.77] | 11.82 | 2.62 |
| Fabric `RegisterDocument` | 100 | 2088.58 ms | [2087.43, 2090.20] | 2091.34 | 10.68 |

Fabric pooled across both brackets (n = 200): **P50 12.23 ms [11.64, 12.52]**.

- Mann-Whitney (pooled Fabric vs `db_only`): **p = 3.1 × 10⁻¹⁹** — a
  statistically clear difference, in the direction of Fabric being *slower*.
- Mean difference **+2.98 ms**, 90 % CI [2.36, 3.59].
- TOST against RQ2's pre-specified ±50 ms margin: **p < 1e-15 → equivalent
  within the interactivity margin.**

## What this changes about the paper's claim

The published claim is that the ledger check is *statistically
indistinguishable* from a database-only check (6.51 vs 7.16 ms, Mann-Whitney
p = 0.22, direction favouring Fabric). **That is no longer what the build
does.** On the current build the ledger check is measurably slower than the
database check, the difference is significant at any conventional threshold,
and the sign has flipped.

This is not a surprise and it is not a regression to be hidden: Experiment 17
already measured the TimeAnchor freshness read at **+0.78 ms P50 (+10.8 %)** and
recorded that it "should be read as a real cost rather than an equivalence."
The manuscript currently states both things at once — Experiment 17's real cost
and Experiment 2's equivalence — which is an internal inconsistency a reviewer
is entitled to flag. The equivalence phrasing has to go regardless of what a
cleaner re-run produces.

What survives unchanged is the claim that actually matters for RQ2: both paths
sit far inside the 50 ms interactivity budget, and the TOST supports equivalence
*at that margin*.

`RegisterDocument` is unchanged within noise (2088.6 ms vs 2084.0 ms
published). It is dominated by the 2 s BatchTimeout, so it is insensitive to
read-path changes, as expected.

## What was NOT measured, and what must not be claimed

**The absolute figures from this run are host-degraded and must not be put in
the paper as replacements for 6.51 / 7.16 ms.** The host was deep in swap
throughout: 9.0–7.1 GB of 11.4 GB swap in use, `available` memory under 1 GB,
7–17 % iowait, with a full desktop session (browser, IDE, two agent sessions)
competing for 7 GiB of RAM. `results/20260801_130810/host_conditions.txt`
records the state at each arm. The original campaign ran on a quiet host.

**The drift control failed.** The two Fabric brackets differ by 1.35 ms at P50
(Mann-Whitney p = 1.0 × 10⁻⁵), so the host moved measurably *during* a 5-minute
run. This is exactly why the run was bracketed rather than run as two arms in
sequence: the drift is reported instead of being silently absorbed into the
effect. The Fabric-vs-database difference (~3 ms) is larger than the drift
(1.35 ms) and both brackets sit entirely above the `db_only` arm with
non-overlapping CIs, so the *direction and existence* of the difference are
robust to the drift. Its *magnitude* is not.

**The +2.98 ms is not attributed.** At least three mechanisms are in play and
this run separates none of them:

1. the TimeAnchor freshness read — an extra ledger state read, measured at
   +0.78 ms on a quiet host (Experiment 17, v1.2 seq 3 vs v1.3 seq 4);
2. ledger and database growth — the database now holds 37,606 documents and
   52,129 audit rows, against a near-empty ledger at the original run;
   Experiment 12 independently measured CheckAccess rising from ~6.5 ms at 10³
   documents to ~8.5 ms at 10⁶;
3. host memory pressure amplifying the Fabric path more than the database path,
   which is plausible on its face — the ledger check crosses a gRPC boundary
   into a separate container and reads CouchDB twice, where the database check
   is one local PostgreSQL query — but is *not* demonstrated here.

Consistent with (3): against their own published baselines the database arm rose
+1.73 ms (7.16 → 8.89) while the Fabric arm rose ~4.2 ms (8.04 at Experiment
17 → 12.23). Do not present that decomposition as measured; it is arithmetic on
runs taken under different conditions, offered only as the reason a clean re-run
is required.

**The M5 removal is not expected to appear here at all, and was not isolated.**
The measured principal is the document owner, who holds an explicit grant issued
by `RegisterDocument`, and the chaincode checks the user-level ACL entry
*before* it ever reaches the removed organization fallback. M5 changes the
outcome for principals *without* a grant — measured end to end in Experiment 18
— not the latency of an allowed read. Measuring the owner is what keeps this
run like-for-like against the published figure.

## Required before these numbers enter the manuscript

A re-run of `run.sh` on a quiet host — desktop session closed, nothing else
competing for RAM, swap not in active use — with the bracket drift check
passing. Until then Experiment 2's headline numbers in the paper should be
treated as stale rather than replaced: substituting a swap-degraded 12.23 ms
for 6.51 ms would trade a stale number for a wrong one.

## Method

Sampling is deliberately identical to the original `measure-v2-latency.py`, so
the runs are comparable rather than merely adjacent: single sequential client
(concurrency 1), one HTTP connection per call, `time.perf_counter`, 120 samples
per operation, warmed window = samples 21–120 (first 20 discarded). Both arms
read **the same document**, created through the real REST upload flow with the
same client-side crypto as the frontend (a genuine on-chain
`RegisterDocument` transaction, not injected state).

The `db_only` arm runs the backend with `FABRIC_ENABLED=false` *and*
`DOCUMENT_MATERIAL_DB_FALLBACK=true`. The fallback must be on: with
`fabric.enabled=false` the `FabricGatewayService` bean is never created
(`@ConditionalOnProperty`), so `DocumentService` sees a null gateway and fails
closed unless the PostgreSQL-ACL fallback is enabled. That fallback path
(`accessRepository.findActiveEntry`) *is* the database-only access check being
measured, and it is how the original 7.16 ms figure was produced
(`results/EXPERIMENT_PROGRESS.md`, Task DB). The owner holds both an on-chain
grant and a `document_access` row, so the identical HTTP request is a ledger
check in one arm and a database lookup in the other.

Each arm gets a freshly restarted JVM, so the arms are matched on JIT state as
well as on data.

Statistics: bootstrap percentile 95 % CI on the median (10,000 resamples,
seed 7), matching `experiments/consolidated/build_table.py` so the intervals are
comparable to those already in the manuscript; Mann-Whitney U by normal
approximation with tie and continuity correction; TOST at the **pre-specified**
±50 ms RQ2 margin. No narrower margin is reported — choosing one after seeing
the data would repeat the inference error the reviewer objected to. P50 is the
central-pair median (consistent with the CI); P25/P75/P95/P99 in
`analysis.json` use the floor-index convention of the per-experiment summaries.

## Preliminary run, kept

`results/20260801_125844/` is an earlier unbracketed run of the Fabric arm only,
taken against the backend JVM that happened to be running at the time (up ~13 h,
started by a previous session). It gave CheckAccess warmed P50 **11.17 ms** and
RegisterDocument **2094.3 ms**.

It is kept rather than deleted because it is the run that exposed the problem:
11.17 ms against a published 6.51 ms is a shift far larger than the +0.78 ms the
only relevant code change accounts for, and that mismatch is what prompted
checking the host before believing the number. Its Fabric P50 also sits below
both brackets of the main run, which is further evidence the host was moving.
It has no matching `db_only` arm and must not be quoted.

## Environment notes

- `experiments/.venv` referenced by `experiments/consolidated/RESULTS.md` does
  not exist on this host. Nothing here needs it — `analyze.py` and `tost.py` are
  standard-library only.
- The original `experiments/measure-v2-latency.py` hardcodes an output path of
  `/home/angkon/Pangochain_AOOP`, which no longer exists. `measure.py` here
  takes `OUT` instead; the sampling logic is otherwise unchanged.
- The run leaves the backend in **fabric** mode (bracket 2 is last), matching
  the state it was found in.

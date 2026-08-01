# Experiment 2 re-run — function-level CheckAccess latency on the current build

- **Reviewer item:** re-measurement of Experiment 2 after the Tier 1 fixes. The
  published 6.51 / 7.16 ms figures predate the TimeAnchor freshness read (M2),
  the removal of the implicit organization fallback (M5), and denial anchoring
  (M10), so they no longer describe the shipped build.
- **Evidence run:** `results/20260801_155550/` (quiet host — **the citable run**)
- **Superseded runs:** `results/20260801_130810/` (host in swap),
  `results/20260801_125844/` (preliminary, fabric arm only). Both kept; see
  "Superseded runs" below.
- **Build under test:** chaincode **legalcc v1.19, sequence 9**; backend at
  `prototype-fixes` HEAD; freshness check **enabled**
  (`disableFreshnessCheckForMeasurement = false`).
- **Reproduce:** `bash run.sh` then `python3 analyze.py results/<stamp>`

## Headline

Warmed window (samples 21–120), n = 100 per arm.

| Arm | P50 | 95 % CI (bootstrap) | mean | SD | P95 | P99 |
|---|---|---|---|---|---|---|
| Fabric `CheckAccess`, bracket 1 | 11.30 ms | [10.86, 11.96] | 12.11 | 3.32 | 18.11 | 29.78 |
| **PostgreSQL ACL (`db_only`)** | **6.44 ms** | **[6.21, 6.70]** | 7.28 | 2.75 | 13.38 | 19.22 |
| Fabric `CheckAccess`, bracket 2 | 10.71 ms | [10.43, 11.07] | 11.19 | 2.19 | 14.75 | 21.55 |
| **Fabric pooled (n = 200)** | **10.99 ms** | **[10.71, 11.25]** | 11.65 | 2.85 | 17.30 | 28.84 |
| Fabric `RegisterDocument` | 2087.35 ms | [2086.39, 2088.19] | 2087.46 | 3.89 | 2094.83 | 2097.94 |

- Mann-Whitney (pooled Fabric vs `db_only`): **p = 1.0 × 10⁻³¹**.
- Mean difference **+4.37 ms**, 90 % CI [3.81, 4.93].
- TOST against RQ2's pre-specified ±50 ms margin: **p < 1e-15 → equivalent
  within the interactivity margin.**

Against the published figures:

| | published | now | change |
|---|---|---|---|
| Fabric `CheckAccess` P50 | 6.51 ms | 10.99 ms | **+4.48 ms** |
| PostgreSQL ACL P50 | 7.16 ms | 6.44 ms | −0.72 ms |
| Mann-Whitney p | 0.22 | 1.0 × 10⁻³¹ | — |
| `RegisterDocument` P50 | 2084.0 ms | 2087.4 ms | +3.4 ms (BatchTimeout-bound) |

## What this changes about the paper's claim

The published claim is that the ledger check is *statistically
indistinguishable* from a database-only check, with the direction slightly
favouring Fabric. **On the current build the ledger check is roughly 70 %
slower than the database check**, the difference is significant at any
conventional threshold, and the sign has flipped. The equivalence phrasing
cannot survive.

What survives is the claim that matters for RQ2: both paths sit far inside the
50 ms interactivity budget, and TOST supports equivalence *at that
pre-specified margin*. `RegisterDocument` is unchanged within noise, as
expected for a path dominated by the 2 s BatchTimeout.

The manuscript currently asserts both Experiment 17's measured freshness-read
cost ("should be read as a real cost rather than an equivalence") and
Experiment 2's equivalence. That internal inconsistency is now resolved in
favour of Experiment 17.

## The host was the confound, and ruling it out reversed a hypothesis

An earlier version of this file speculated that host memory pressure was
inflating the Fabric path more than the database path, because the Fabric path
crosses a gRPC boundary and reads CouchDB twice. **That was wrong, and the
quiet-host run refutes it.**

| | host in swap (130810) | quiet host (155550) |
|---|---|---|
| `available` memory | 908 MB | 2,278–2,465 MB |
| swap in use | 9.0 GB | 3.7 GB |
| Fabric P50 | 12.23 ms | 10.99 ms |
| `db_only` P50 | 8.89 ms | 6.44 ms |
| **arm difference (mean)** | **+2.98 ms** | **+4.37 ms** |

Relieving memory pressure made the *gap wider*, not narrower. Swap was
compressing the difference — it inflated the database arm proportionally more
— so the loaded run understated the effect rather than manufacturing it. The
speculation is recorded here rather than quietly deleted because it was stated
in the previous commit (769968b) and is now known to be false.

The database arm independently validates the host: at 6.44 ms it reproduces
the published 7.16 ms scale (slightly faster), so this host is comparable to
the one the original campaign ran on. The Fabric arm is the one that moved.

## What is NOT established: why the ledger path is +4.5 ms slower

This run measures the gap. It does **not** decompose it, and the decomposition
matters, because +4.48 ms is far more than the only change with a known price.

Candidate contributions, none isolated here:

1. **The TimeAnchor freshness read** — an extra ledger state read on every
   CheckAccess, measured at **+0.78 ms** on a quiet host in Experiment 17
   (v1.2 seq 3 control vs v1.3 seq 4 treatment). That accounts for under a
   fifth of the observed change.
2. **World-state growth.** The original figure was taken on a near-empty
   ledger. This ledger now holds the full campaign history plus the 2,000
   documents added by Experiment 12b. Experiment 12 independently measured
   CheckAccess rising ~0.6 ms from 10³ to 10⁶ documents, which does not
   obviously cover the remainder either.
3. **Something else not yet identified.** Roughly 3.7 ms is unaccounted for.

Stating a +4.48 ms regression with ~3.7 ms unexplained is precisely the shape
of claim this review objected to — asserted rather than measured. **The
decomposition should be measured before this goes in the paper.** The
mechanism to do it already exists and was used once: the chaincode constant
`disableFreshnessCheckForMeasurement` (types.go) removes the freshness read,
and Experiment 17 measured the delta by deploying control and treatment as
successive chaincode sequences. Repeating that on the current build and current
world state would split the gap cleanly into "freshness read" and "everything
else".

Until then, the honest manuscript statement is the measured gap plus an
explicit note that only +0.78 ms of it is attributed.

## The drift control: better, still not passing

The two Fabric brackets differ by **0.59 ms** at P50 (Mann-Whitney
p = 0.0145), so the run still fails its own drift check at α = 0.05 — but the
failure is much smaller than the swapped run's 1.35 ms, and the effect-to-drift
ratio improved from 2.2× to 7.4×. Bracket 2 is *faster* than bracket 1, so the
drift is continued warm-up (page cache and JIT across restarts), not
degradation. Both brackets sit entirely above `db_only` with non-overlapping
CIs, and `db_only` ran between them, so the difference cannot be an artefact of
a monotonic trend: interpolating the Fabric arm to the database arm's timestamp
still leaves a ~4.6 ms gap.

Host conditions were recorded at each arm and were consistent
(`available` 2,465 / 2,278 / 2,345 MB; load average 0.92 / 0.50 / 0.62), which
is why the residual drift is attributed to warm-up rather than load.

## Superseded runs, kept

- `results/20260801_130810/` — the full bracketed run with the host in swap
  (9.0 GB swap, <1 GB available, 7–17 % iowait). Its absolute figures
  (12.23 / 8.89 ms) must not be quoted. It is kept because it is the basis of
  the swap-vs-quiet comparison above, which is what refuted the amplification
  hypothesis.
- `results/20260801_125844/` — preliminary, Fabric arm only, against a
  13-hour-old JVM, no matching `db_only` arm. CheckAccess 11.17 ms. Kept
  because it is the run that exposed the problem: 11.17 ms against a published
  6.51 ms is a shift far larger than the only relevant code change accounts
  for, and that mismatch is what prompted checking the host before believing
  any number.

## Method

Sampling is deliberately identical to the original `measure-v2-latency.py`, so
the runs are comparable rather than merely adjacent: single sequential client
(concurrency 1), one HTTP connection per call, `time.perf_counter`, 120 samples
per operation, warmed window = samples 21–120 (first 20 discarded). All three
arms read **the same document**, created through the real REST upload flow with
the same client-side crypto as the frontend (a genuine on-chain
`RegisterDocument`, not injected state); `setup.mjs` aborts if the upload
returns no `fabricTxId`.

Arms are bracketed fabric → db_only → fabric rather than run in sequence, so
drift becomes a measured quantity instead of being absorbed into the effect.
Each arm gets a freshly restarted JVM, matching the arms on JIT state as well
as on data.

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

The measured principal is the document **owner**. Post-M5 the owner still
passes through the user-level ACL branch, because `RegisterDocument` issues the
uploader an explicit grant and that branch is checked *before* the removed
organization fallback. M5 changes the outcome for principals *without* a grant
— measured end to end in Experiment 18 — not the latency of an allowed read.
Measuring the owner is what keeps this like-for-like against the published
figure.

Statistics: bootstrap percentile 95 % CI on the median (10,000 resamples,
seed 7), matching `experiments/consolidated/build_table.py` so the intervals
are comparable to those already in the manuscript; Mann-Whitney U by normal
approximation with tie and continuity correction; TOST at the **pre-specified**
±50 ms RQ2 margin. No narrower margin is reported — choosing one after seeing
the data would repeat the inference error the reviewer objected to. P50 is the
central-pair median (consistent with the CI); P25/P75/P95/P99 use the
floor-index convention of the per-experiment summaries.

## Environment notes

- `experiments/.venv`, referenced by `experiments/consolidated/RESULTS.md`,
  does not exist on this host. Nothing here needs it — `analyze.py` and
  `tost.py` are standard-library only.
- The original `experiments/measure-v2-latency.py` hardcodes an output path of
  `/home/angkon/Pangochain_AOOP`, which no longer exists. `measure.py` here
  takes `OUT` instead; the sampling logic is otherwise unchanged.
- The run leaves the backend in **fabric** mode with the fail-closed default
  (bracket 2 is last), matching the state it was found in.

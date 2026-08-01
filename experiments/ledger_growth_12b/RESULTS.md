# Experiment 12b — per-document storage on the current build, and the new time-linear growth term

- **Reviewer item:** follow-up measurement tracked by the M5 commit (6011add),
  which flagged Experiment 12 for re-running because "every principal now needs
  an explicit grant".
- **Evidence run:** `results/20260801_132837/`
- **Build under test:** chaincode **legalcc v1.19, sequence 9**; backend at
  `prototype-fixes` HEAD, `fabric.time-anchor.enabled=true`,
  `interval-ms=60000` (the shipped defaults).
- **Reproduce:** `bash idle.sh results/<stamp> 20 60` then
  `bash load.sh results/<stamp> 2000 40` then
  `python3 analyze12b.py results/<stamp>`

## Two findings

### 1. Per-document storage did not change. The premise for this re-run was wrong.

| | published Exp 12 | measured now | delta |
|---|---|---|---|
| block store | 5,618 B/doc | **5,751 B/doc** | +2.4 % |
| CouchDB state | 1,389 B/doc | 2,177 B/doc (upper bound, see below) | — |

The block-store figure is the reliable one, and it is unchanged within noise.
**M5 added zero bytes per document.** The commit that prompted this re-run
removed a code branch and nothing else: `RegisterDocument` has written an
explicit owner grant into the ACL since the original chaincode commit
(909e716), and `ACL: map[string]*Grant{ownerID: ownerGrant}` is byte-identical
at 909e716 and at HEAD. There was never an implicit-fallback document with an
empty ACL to grow.

The concern in the M5 commit message — that removing the fallback makes the ACL
map grow — is real only for *deliberate intra-firm sharing that previously rode
the implicit fallback*. That is a per-grant cost on documents actually shared
inside a firm, not a change to the baseline per-document footprint, and it was
always the cost of an explicit grant. **Experiment 12's ~7 KB/doc/peer figure
stands and does not need restating.**

### 2. Ledger growth is no longer a function of document count alone.

With **zero** document activity, the ledger grew at a constant
**7.84 MB/day/peer** of block store (90.7 B/s, R² = 1.0000 over 20 minutes),
adding exactly **1.00 blocks/min** (R² = 1.0000) at **5,470 B/block**.

That is the TimeAnchor heartbeat added for reviewer M2. `TimeAnchorHeartbeat`
issues one `UpdateTimeAnchor` **submit** per `fabric.time-anchor.interval-ms`
(default 60,000 ms), and a submit is an ordered transaction that lands in a
block forever. The other two scheduled workers were ruled out as contributors:
`AuditAnchorBackfillWorker.drain` returns early on an empty batch and
`AnchorReconciliationWorker.drain` iterates an empty list, so neither writes
when idle — consistent with the observed rate of exactly one block per minute
matching exactly one heartbeat per minute.

Experiment 12 modelled growth as linear in document count alone. The correct
model on this build is **a·documents + b·time**, and Experiment 12 never
measured `b` because `b` did not exist when it ran.

Scale of the time term, at the shipped 60 s interval:

| horizon | block store per peer | in "documents equivalent" |
|---|---|---|
| 1 day | 7.84 MB | ~1,363 documents |
| 1 year | ~2.86 GB | ~498,000 documents |
| 10 years | ~28.6 GB | ~5.0 M documents |

The manuscript says one million documents occupy roughly 7 GB per peer. On a
ten-year retention horizon — modest for privileged legal material — the
heartbeat alone contributes ~28.6 GB per peer, four times that, **for an
archive that never receives another document**. Across the three-org network
that is ~86 GB. It remains commodity-hardware territory, which is the paper's
actual claim, but "storage grows linearly with documents" is no longer a
complete description of the system's cost.

This is a cost of the M2 fix, not a defect: an anchor that is not refreshed is
not an anchor. It is also directly tunable — the interval is configuration, so
a 5-minute heartbeat costs a fifth as much, traded against a proportionally
looser backdating bound. Experiment 17's staleness sweep is the other half of
that trade-off and the two should be presented together.

## What must not be claimed

**No idle CouchDB growth rate is reported.** CouchDB compacts: at 13:42 the
state DB dropped from 3.99 MB to 3.13 MB mid-run. The series is a sawtooth, so
a fitted slope is not a growth rate — the naive fit gives *negative*
13 MB/day at R² = 0.043, which is an artefact of where the window happens to
fall relative to a compaction. `analyze12b.py` detects the non-monotonicity and
refuses to report a rate rather than printing the number. Only the block store,
which is append-only and never reclaims, gives a durable rate.

**The 2,177 B/doc CouchDB figure is an upper bound, not a steady state.** It
comes from a 1.9-minute burst with no compaction inside the window, so it
includes revision overhead that compaction later reclaims. It is higher than
the published 1,389 B/doc almost certainly for that reason rather than because
the world-state entry grew. Do not quote it as a like-for-like increase. A
steady-state CouchDB figure needs a window spanning several compaction cycles,
which this run does not provide.

**The 10⁶ extrapolation was not re-validated.** This run registered 2,000
documents on the existing ledger, not 1,000,000 on a fresh one. It re-measures
the per-document *constant* on the current build; it does not re-establish
linearity across three orders of magnitude. Experiment 12 established that, and
nothing here challenges it — but if a reviewer asks whether the 10⁶ point still
holds, the honest answer is that only the constant was re-checked.

**No latency was re-measured here.** Experiment 12 also reported CheckAccess
and GetDocumentHistory versus world-state size. Those are latency figures and
this host is in swap (see `experiments/function_latency_exp2/RESULTS.md`), so
re-measuring them now would produce the same untrustworthy absolutes. The
world-state size did grow by 2,000 documents during this run, which is
immaterial against the 10⁶ Experiment 12 already covers.

**Throughput here is not a throughput result.** The preload sustained 18.9 TPS
against Experiment 12's 70–76 TPS. That is the swapping host, not a regression;
byte counts are unaffected by how fast the bytes arrive, which is why this
experiment was chosen for a loaded host. Do not read 18.9 TPS as a measurement
of anything.

## Method

Phase A samples ledger size every 60 s for 20 minutes with nothing registering
a document, so every new block is a heartbeat. Phase B registers 2,000
documents through the fabric-gateway SDK — the same path and the same
transaction shape as Experiment 12's preload (64-char hash, 46-char CID) — and
brackets it with snapshots. Phase A's background rate is subtracted over the
Phase B window, because heartbeat blocks keep accruing during the load and
would otherwise be charged to the documents (10,524 B of the 11.5 MB block-store
delta, small here only because the load window was short).

Measurement points are identical to Experiment 12's `disk_row`: `du -sb` on
`/var/hyperledger/production/ledgersData/chains` in `peer0.firma.pangochain.com`
and on `/opt/couchdb/data` in `couchdb.firma`, plus `peer channel getinfo`
height. Same peer, same paths, so the numbers are directly comparable.

DocIDs are prefixed `LG12B-<runId>-` rather than Experiment 12's `LG-<seq>`.
Experiment 12 ran against a wiped ledger; this ran against the live one, where a
collision would make `RegisterDocument` return "already registered" and turn the
preload into a no-op that still looks successful. The preloader counts
duplicates separately and exits non-zero if any occur. This run: 2,000
requested, 2,000 committed, 0 duplicates, 0 retries, 0 failures.

## Effect on the manuscript

Section `sec:exp_ledgergrowth` (~line 3180 of `bra_submission/main.tex`) and the
Fig. 12 caption state storage growth as ~7 KB/document with no time term. The
per-document number is confirmed and needs no change. What is missing is the
heartbeat term, which should be stated alongside it, with the interval named as
the tunable it is. That edit does not depend on host conditions and is not
blocked, unlike the Experiment 2 numbers.

The ledger was left with 2,000 additional benchmark documents
(`LG12B-70744510-*`) and the network in its found state.

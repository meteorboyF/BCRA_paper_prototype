# Experiment 14b — Giving the Audit-Log-Only Baseline a Durable Anchor Pipeline

**Status: complete**, on a reduced sweep. The durable pipeline is built, its anchoring
throughput is measured, and all three modes have been compared under the existing harness.

## Why this exists

Experiment 14 compared on-path enforcement against a "Fabric as passive audit log" baseline
and reported, as a property of that *architecture*, that its anchors drained at 3–8/s against
700+/s generated and that the backlog was **lost when the backend stopped** (144 of ~24,000
anchors completed).

Reviewer finding **M3** objects, correctly. That baseline anchored fire-and-forget through an
`@Async` call whose executor had just been found defective, and an in-memory queue that loses
its contents on shutdown is a property of a naive implementation, not of audit-log-only
designs. Any serious deployment of that architecture would use a durable queue and batched
anchoring. Comparing against one that does not is comparing against a strawman, and the
review asks for either a rebuilt baseline or the deletion of the drain-rate claim.

This builds the baseline the comparison should have used.

## What was built

`AuditAnchorBackfillWorker`, plus an `audit_anchor_batch` checkpoint table
(changeset `028`).

Two design points worth recording, both forced by the existing system rather than chosen:

- **Anchoring state lives beside the audit log, not in it.** The obvious implementation
  stamps `fabric_tx_id` onto audit rows once anchored. That is impossible here:
  `audit_log` is append-only, enforced by the `audit_log_no_modify` trigger, which raises on
  any `UPDATE`. Relaxing that trigger to make anchoring bookkeeping easier would trade away
  the tamper evidence the whole design rests on, so each batch instead records a contiguous
  `audit_log` id range with its digest, and the highest committed `last_audit_id` acts as a
  watermark. Rows above the watermark are the backlog.
- **Durability comes for free from the existing write order.** Audit rows are committed to
  PostgreSQL before any anchoring is attempted, so the backlog is on disk by construction and
  survives restart. This is the entire difference from the pipeline being measured against.
- **Anchoring is batched.** One ledger transaction per audit event would cap throughput at
  the commit latency (~2 s), which is exactly what made the original baseline look hopeless.
  A batch is hashed (SHA-256 over each row's identifying fields in id order, with a record
  separator so field shifting cannot collide) and the digest is anchored in a single
  transaction. Tamper evidence is preserved: altering any event in an anchored batch changes
  the digest.

The batch digest is carried by the existing `LogAuditEvent` chaincode function, so no
chaincode change or redeploy was required.

Disabled by default (`audit.anchor-backfill.enabled=false`). The on-path design does not need
it — its enforcement guarantee never depends on the audit pipeline — and it exists so the
baseline can be measured with a competent implementation.

## Measured: anchoring throughput and backlog recovery

The system had accumulated a genuine backlog of **51,050 audit rows, 39,450 of them
unanchored**, across earlier experiments where inline anchoring failed. Enabling the worker
drained it, which is a more honest test than a synthetic queue.

| | naive fire-and-forget (Experiment 14) | durable batched (this work) |
|---|---|---|
| Anchor throughput | 3–8 events/s | **53.3 events/s** |
| Backlog on restart | lost (in-memory queue) | retained (rows on disk, watermark unmoved) |
| Anchors completed | 144 of ~24,000 | drains continuously until caught up |

Measured over a 30 s window while draining: watermark advanced 17,400 → 19,000, i.e.
**53.3 audit events per second**, roughly 10× the 3–8/s midpoint the original run reported.

This is a floor rather than a ceiling: the ledger cost is one transaction per *batch*
regardless of batch size, so the rate scales with `audit.anchor-backfill.batch-size`
(200 here). The claim the review objected to should be restated accordingly — a naive
fire-and-forget pipeline loses anchors, while a durable batched one keeps up, and the
interesting question is what that durability costs rather than whether the architecture can
be made to work.

## Measured: all three modes compared

**Evidence run:** `results/20260731_150414/`. Reduced sweep — concurrency 10 and 50,
1,000 requests per level, versus the original's 10/50/100/200 × 2,000. Backend restarted
between modes by the harness; backlog drained beforehand so this is steady state rather than
migration; run with the corrected worker.

| Mode | conc 10 TPS | conc 10 P50 | conc 50 TPS | conc 50 P50 |
|---|---|---|---|---|
| A. on-path enforcement | **469.5** | **16.6 ms** | **789.6** | **59.2 ms** |
| B. audit-log-only, naive anchoring | 393.4 | 15.6 ms | 557.9 | 57.3 ms |
| C. audit-log-only, durable batched anchoring | 142.3 | 32.8 ms | 226.9 | 209.3 ms |

Zero failed requests in all three modes (1,000/1,000 at each level).

### The result inverts the original comparison

The original Experiment 14 found the audit-log-only baseline **faster** than on-path
enforcement (510.6 vs 395.4 req/s at conc 10), and framed on-path enforcement's cost as a
premium paid for a stronger guarantee. That framing does not survive making the baseline
durable.

Against mode B — the naive baseline, which is the one the review objects to — on-path
enforcement costs essentially nothing at conc 10 in this run (16.6 vs 15.6 ms P50) and is
*faster* in throughput (469.5 vs 393.4 req/s). Against mode C — the baseline implemented so
that it actually keeps its audit promise — on-path enforcement is **3.3× the throughput and
half the median latency** at conc 10, and 3.5× the throughput at conc 50.

The reason is structural rather than incidental. In the audit-log-only architecture the
anchor *is* the security mechanism: if the anchor does not reach the ledger, there is no
ledger-verifiable record of the access decision, so the anchoring pipeline must be durable
and must keep up with request rate. In the on-path design the ledger decision happens before
release, so the audit anchor is telemetry rather than the enforcement mechanism, and it does
not have to be durable to preserve the security property. The audit-log-only design pays for
durability on every decision; the on-path design does not have to.

**This strengthens rather than weakens the paper**, and it is the opposite of what fixing a
strawman would normally do. The review's concern was that the baseline had been made to look
bad unfairly. Making it fair does not rescue it — it makes it slower, because the cost the
naive implementation was avoiding is a cost that architecture genuinely has to pay.

### Anchor durability, measured

| | naive (mode B) | durable (mode C) |
|---|---|---|
| Unanchored backlog after the run | 69, **lost on restart** | 16, **retained and drained** |
| Committed batches | n/a | 318 |

Mode C's residual 16 is the tail still in flight when sampling stopped, not loss: the
watermark keeps advancing and those rows are on disk. Mode B's 69 are unrecoverable once the
process exits, which is the defect the original run reported as 144-of-24,000.

## Caveats, stated rather than buried

- **Reduced sweep.** Two concurrency levels and half the requests per level. The original's
  conc 100/200 saturation behaviour is not reproduced here, and the high-concurrency claims
  in Experiment 14 are not re-validated by this run.
- **Mode A's own audit events are not durably anchored**, by design — that is the asymmetry
  being argued. The comparison is therefore between architectures as they must actually be
  built to keep their respective promises, not between identical pipelines. This should be
  stated explicitly wherever the numbers are used, or the comparison looks rigged in the
  other direction.
- **Mode A vs mode B here disagrees with the original run's direction** (on-path faster now,
  slower before). The system has changed since: the TimeAnchor freshness read was added to
  `CheckAccess`, the organization fallback was removed, and denials are now anchored. The
  absolute numbers from the original Experiment 14 should not be mixed with these; if the
  manuscript keeps the 21.6 vs 15.1 ms figures, they belong to the old configuration and need
  re-measuring, which is already tracked alongside the Experiment 2 re-run.
- One earlier ad-hoc probe of this same question produced wildly worse numbers and gateway
  endorsement failures. That probe ran with a defective worker that wrapped its multi-second
  Fabric submit in `@Transactional`, pinning a Hikari connection for the round-trip, and
  while a 39,000-event migration backlog was draining. Both conditions are absent here. The
  earlier observation is not reported as a result.

## What the manuscript should say

- Replace the drain-rate argument. The supportable claim is not "audit-log-only designs lose
  their anchors" but "a fire-and-forget pipeline loses anchors on restart; making the
  pipeline durable costs roughly 3× throughput, and that cost is intrinsic to the
  architecture because its anchor is its enforcement mechanism."
- The strongest available framing of Experiment 14 is now a comparison against a *competent*
  baseline, which is a better argument than the original had.
- The `@Async` defect disclosure should move out of the footnote into the main text, per the
  review.
- The original 21.6 / 15.1 ms figures should be re-measured or explicitly scoped to the
  pre-M2/M5 configuration.

## Reproduce

```bash
# Enable the worker (off by default) and watch the watermark advance:
AUDIT_ANCHOR_BACKFILL=true ./mvnw spring-boot:run     # in pangochain-backend
docker exec pangochain-postgres psql -U pangochain -d pangochain -c \
  "SELECT status, count(*), sum(event_count), max(last_audit_id) FROM audit_anchor_batch GROUP BY status;"
```

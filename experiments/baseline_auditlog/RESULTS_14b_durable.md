# Experiment 14b — Giving the Audit-Log-Only Baseline a Durable Anchor Pipeline

**Status: partially complete.** The durable pipeline is built and its anchoring throughput is
measured. The latency/throughput re-comparison of the two modes is **not** done — see
Not measured.

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

## Not measured

**The latency and throughput re-comparison of the two modes.** This is the second half of
what M3 asks for and it is not done. An attempt to measure release-path latency while the
worker was draining timed out: 180 requests did not complete within five minutes, against a
baseline of roughly 8 ms per request. During the same period the backend's Fabric gateway
began returning `FAILED_PRECONDITION: no combination of peers can be derived which satisfy
the endorsement policy`, while an identical invoke through the peer CLI succeeded — so the
network was healthy and the failures were gateway-side, under the worker's sustained
concurrent submit load.

That observation is suggestive but **must not be reported as the cost of durable anchoring**,
for two reasons. First, it conflates steady-state cost with the cost of draining a 39,000-event
backlog at full rate, which is a migration condition rather than an operating one. Second, the
worker as first written wrapped its multi-second Fabric submit in `@Transactional`, pinning a
Hikari connection for the whole round-trip — the precise anti-pattern `application.yml` warns
about for open-in-view. That defect has been removed, but every observation above was taken
with it present, so the contention seen is partly self-inflicted and the numbers are not
trustworthy.

A fair re-comparison needs: the fixed worker, a drained backlog so the system is in steady
state, and all three modes measured under the existing `run.sh` harness (on-path,
audit-log-only naive, audit-log-only durable) rather than an ad-hoc probe.

## What the manuscript can and cannot say now

- The drain-rate argument as written is **not** defensible and should be replaced. The
  supportable claim is narrower: a fire-and-forget pipeline loses anchors on restart, whereas
  a durable batched pipeline sustains ~53 events/s and recovers its backlog.
- The latency comparison (21.6 vs 15.1 ms P50 at conc 10) is untouched by this work and, as
  the review notes, that part was sound.
- The `@Async` defect disclosure should move out of the Experiment 14 footnote and into the
  main text, per the review.
- No claim should yet be made about what durable anchoring costs the release path.

## Reproduce

```bash
# Enable the worker (off by default) and watch the watermark advance:
AUDIT_ANCHOR_BACKFILL=true ./mvnw spring-boot:run     # in pangochain-backend
docker exec pangochain-postgres psql -U pangochain -d pangochain -c \
  "SELECT status, count(*), sum(event_count), max(last_audit_id) FROM audit_anchor_batch GROUP BY status;"
```

# Experiment 14 — Fabric-as-Passive-Audit-Log Baseline: Results Report

- **IMPROVEMENTS.md item:** 3.5a (architectural baseline: the design we argue against)
- **Evidence run:** `experiments/baseline_auditlog/results/20260716_122821/`
- **Figure:** `fig14_baseline.png` / `.pdf`
- **Raw data:** `levels.csv`, `samples.csv` (16,000 requests), `summary.json`,
  `backend_default.log`, `backend_audit-log-only.log`, `environment.json`, `run.log`
- **Prototype changes:** `DocumentService.java` (guarded `audit-log-only`
  profile block, default OFF) and `AsyncConfig.java` (prerequisite bug fix,
  see below)

## The two modes

Same gateway workload (`GET /api/documents/{id}/ciphertext`, closed-loop,
conc 10/50/100/200 × 2,000 requests, reference 3-org network):

- **onpath** (default profile): ledger `CheckAccess` evaluated on the
  release path before any ciphertext is served — this work's design.
- **auditlog** (Spring profile `audit-log-only`): PostgreSQL ACL decides;
  the decision is recorded via the existing `@Async` audit pipeline, which
  anchors a `LogAuditEvent` to Fabric off the request path — the
  "blockchain as passive audit log" architecture.

Profile isolation was verified: **zero** `ACL_AUDIT_LOG_ONLY` events fired
in onpath mode; every baseline-mode decision row present was recorded by
the profile path.

## Results (16,000 requests, zero failures in both modes)

| Conc | On-path TPS | On-path P50/P95 | Audit-log TPS | Audit-log P50/P95 | On-path premium (P50) |
|---|---|---|---|---|---|
| 10 | 395.4 | 21.6 / 42.5 ms | 510.6 | 15.1 / 36.1 ms | **+6.5 ms** (−23% TPS) |
| 50 | 676.9 | 70.0 / 115.0 ms | 751.1 | 63.3 / 106.1 ms | **+6.7 ms** (−10%) |
| 100 | 757.7 | 126.1 / 200.3 ms | 764.3 | 117.1 / 253.9 ms | **+9.1 ms** (−1%) |
| 200 | 721.1 | 245.5 / 530.6 ms | 767.8 | 193.4 / 587.0 ms | +52 ms (−6%; P95 *lower* than baseline) |

### Headline

**On-path ledger enforcement costs ≈ 6.5–9 ms P50 per document release**
(up to moderate saturation) — independently consistent with Exp 2's
function-level isolation (6.51 ms CheckAccess, 7.16 vs 6.51 ms two-layer
figure). Throughput cost at high concurrency is ≤ 10%, and at conc 200 the
on-path P95 is actually *below* the baseline's (both saturate the same
host). The end-to-end price of enforcing, rather than merely logging,
access decisions is single-digit milliseconds.

### The baseline's hidden cost (quantified)

The passive design's audit anchors are fire-and-forget. During the ~40 s
benchmark window the anchor pipeline completed only **144 of ~24,000**
generated anchor transactions (44/8,000 `ACL_AUDIT_LOG_ONLY` + 100/8,000+
`DOC_VIEWED`); the rest sat in the in-memory async queue and were **lost
when the backend stopped**. Drain rate ≈ 3–8 anchors/s (8–16 pool threads
each waiting ~2 s block commits) vs. 700+ generated/s at gateway
saturation. A production passive-audit-log system therefore needs batched
anchoring and durable queues just to keep its audit promise — while the
on-path design's *enforcement* guarantee never depends on that pipeline.
(In on-path mode the same lag applies only to the telemetry-grade
`DOC_VIEWED` anchor; upload anchors are synchronous via `RegisterDocument`
and unaffected.)

## Prerequisite bug fix: unbounded async executor (full disclosure)

The first benchmark attempts produced a ~14 req/s ceiling with 2 s-quantized
latencies in **both** modes. Thread dumps (`jstack`) showed the cause:

1. `AuditService.log` is `@Async`, but the app had no explicit async
   executor. `@EnableWebSocketMessageBroker` registers several
   `TaskExecutor` beans, so Spring's async support found no unique
   candidate and **silently fell back to `SimpleAsyncTaskExecutor` — a new
   thread per task, unbounded**.
2. Every download's audit anchor spawned a thread that parked ~2 s in
   `GatewayClient.commitStatus` (BatchTimeout). Under load: 1,600+ threads
   observed, whose post-commit DB inserts arrived in 2 s waves against the
   30-connection Hikari pool; request threads (JWT user lookup needs a
   connection) queued behind the waves.
3. Sequential requests were unaffected (~40–85 ms) — a pure concurrency
   pathology, masked in ordinary use.

Fix: `AsyncConfig.java` — a bounded `ThreadPoolTaskExecutor` (8–16
threads, 50k bounded queue, logged rejection) as the `AsyncConfigurer`
executor. Effect: gateway throughput rose from **14 → 721–768 req/s**.
This is a prerequisite defect fix (resource management), not a change to
any ACL or enforcement logic; both modes were measured on the fixed
executor.

### Does this invalidate Exp 1's published numbers? (assessed: NO — footnote)

Exp 1's workload (`exp1-round.js`) is 20% `POST /documents/upload` + 80%
`GET /documents/{id}/wrapped-key`:

- `getWrappedKey` fires **no audit event** — it never touches the async
  pipeline.
- `upload`'s `DOC_REGISTERED` anchor passes the **non-null `fabricTxId`**
  from the on-path `RegisterDocument` submit, so `AuditService.log` skips
  the Fabric submit entirely; its async task is a millisecond DB insert
  (a short-lived thread per call — wasteful, but no 2 s parks, no thread
  accumulation, no connection-pool waves).

The pathological path requires an audit event with `fabricTxId == null`
under sustained load — i.e., `downloadCiphertext`'s `DOC_VIEWED` — which
Exp 1 never exercises. Exp 9 (fail-closed) does use the ciphertext
endpoint, but its claims are about outage *denial semantics*, not
throughput, and during the outage Fabric submits fail fast (no 2 s parks).
**Recommendation: footnote the discovered defect + fix in the revised
manuscript (it post-dates the Exp 1 runs and does not affect their
workload); no rerun required.** If reviewers want belt-and-braces, rerun
Exp 1's sweep on the fixed executor and report both.

## Reproduce

```bash
bash experiments/baseline_auditlog/run.sh      # both modes, ~10 min incl. backend starts
```

Requires the reference 3-org network (started automatically if absent),
postgres + IPFS from the root compose, and Java 21. The runner starts the
backend twice (`SPRING_PROFILES_ACTIVE=""` then `audit-log-only`), creates
bench data via `setup-bench-data.py` (firm UUID resolved from the DB), and
self-checks profile isolation via audit-event counts.

### Harness fix log (for provenance)

Attempts 1–5 failed for reasons unrelated to the measured system, all
fixed: a `set -e` function-return footgun in `run.sh` (silent death, twice),
missing root `.env` for the bare-mvnw backend launch (DB auth), a
machine-specific firm UUID in `setup-bench-data.py` (now env-overridable),
and loadgen data loss on crash (now per-level incremental CSV writes with
NaN-safe stats). `summary.json`'s `acl_audit_log_only_fabric_anchored`
counts all-time rows, not the run window (query lacks a time filter);
window-correct counts are in this report.

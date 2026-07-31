package com.pangochain.backend.audit;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.pangochain.backend.blockchain.FabricException;
import com.pangochain.backend.blockchain.FabricGatewayService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;

/**
 * Anchors audit events that the inline pipeline could not reach the ledger with.
 *
 * Why this exists: the audit-log-only baseline of Experiment 14 anchored fire-and-forget
 * through an @Async call. When generation outran the anchor pipeline, the surplus sat in an
 * in-memory queue and was lost on shutdown - the original run completed 144 of roughly
 * 24,000 anchors. That was then reported as a cost of the audit-log-only *architecture*,
 * which reviewer finding M3 correctly objects to: it is a property of a naive
 * implementation, not of the design. Any serious passive-audit-log deployment would use a
 * durable queue and batched anchoring, so comparing against one that does not is comparing
 * against a strawman.
 *
 * This worker gives the baseline the implementation it deserves. Audit rows are written to
 * PostgreSQL synchronously and durably before any anchoring is attempted, so the backlog
 * survives restart by construction. Anchoring state is tracked in audit_anchor_batch rather
 * than on the audit rows themselves, because audit_log is append-only at the database level
 * and relaxing that trigger to record anchoring status would trade away the tamper evidence
 * the whole design rests on.
 *
 * Anchoring is batched. One ledger transaction per audit event would cap throughput at the
 * commit latency (~2 s), which is precisely the bottleneck that made the original baseline
 * look hopeless. Instead a batch of events is hashed and the digest is anchored in a single
 * transaction, which is how checkpointed audit anchoring is normally built. The per-event
 * ledger cost becomes one transaction per batch rather than per event, while tamper evidence
 * is preserved: altering any event in an anchored batch changes the digest.
 *
 * Disabled by default. Experiment 14b enables it to measure what durability costs, so that
 * the comparison against on-path enforcement is against a competent baseline.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class AuditAnchorBackfillWorker {

    private final AuditLogRepository auditLogRepository;
    private final AuditAnchorBatchRepository batchRepository;
    private final ObjectMapper objectMapper;

    @Autowired(required = false)
    private FabricGatewayService fabricGatewayService;

    @Value("${audit.anchor-backfill.enabled:false}")
    private boolean enabled;

    @Value("${audit.anchor-backfill.batch-size:200}")
    private int batchSize;

    @Value("${audit.anchor-backfill.actor-org:PangoChain}")
    private String actorOrg;

    /**
     * Deliberately NOT @Transactional. The Fabric submit inside takes seconds, and wrapping
     * it in a transaction pins a Hikari connection for that whole round-trip - the same
     * anti-pattern application.yml calls out for open-in-view. Reads and the single batch
     * insert each get their own short transaction from the repository instead.
     */
    @Scheduled(fixedDelayString = "${audit.anchor-backfill.interval-ms:2000}")
    public void drain() {
        if (!enabled || fabricGatewayService == null) return;

        Long watermark = batchRepository.findWatermark();
        long from = watermark == null ? 0L : watermark;

        List<AuditLog> pending =
                auditLogRepository.findByIdGreaterThanOrderByIdAsc(from, PageRequest.of(0, batchSize));
        if (pending.isEmpty()) return;

        String digest;
        try {
            digest = digestOf(pending);
        } catch (Exception e) {
            log.error("Failed to digest audit batch above watermark {}, leaving it for retry", from, e);
            return;
        }

        long firstId = pending.get(0).getId();
        long lastId = pending.get(pending.size() - 1).getId();

        AuditAnchorBatch batch = AuditAnchorBatch.builder()
                .firstAuditId(firstId)
                .lastAuditId(lastId)
                .eventCount(pending.size())
                .digest(digest)
                .status(AuditAnchorBatch.Status.PENDING)
                .attempts(1)
                .build();

        String batchMeta = toJson(Map.of(
                "digest", digest,
                "count", pending.size(),
                "firstAuditId", firstId,
                "lastAuditId", lastId));

        try {
            // Reuses LogAuditEvent rather than adding a chaincode function: what has to reach
            // the ledger is the batch digest, and this carries it without a redeploy.
            String txId = fabricGatewayService.submitTransaction(
                    "LogAuditEvent", "AUDIT_BATCH_ANCHOR", "system", actorOrg,
                    firstId + "-" + lastId, batchMeta, "");
            batch.setStatus(AuditAnchorBatch.Status.COMMITTED);
            batch.setFabricTxId(txId);
            batch.setCommittedAt(Instant.now());
            batchRepository.save(batch);
            log.info("Anchored {} audit events (ids {}-{}) in batch tx {}",
                    pending.size(), firstId, lastId, txId);
        } catch (FabricException e) {
            // Nothing is lost. The watermark does not advance, so this range is retried on the
            // next tick. That is the whole difference from the fire-and-forget pipeline being
            // measured against, where the surplus lived only in an in-memory queue.
            batch.setLastError(e.getMessage());
            batchRepository.save(batch);
            log.warn("Audit batch anchoring failed for ids {}-{}, will retry: {}",
                    firstId, lastId, e.getMessage());
        }
    }

    /** SHA-256 over the batch's identifying fields, in id order. */
    private String digestOf(List<AuditLog> entries) throws Exception {
        MessageDigest sha = MessageDigest.getInstance("SHA-256");
        for (AuditLog e : entries) {
            String canonical = String.join("|",
                    String.valueOf(e.getId()),
                    n(e.getEventType()),
                    e.getActorId() == null ? "" : e.getActorId().toString(),
                    n(e.getResourceType()),
                    n(e.getResourceId()),
                    e.getTimestamp() == null ? "" : e.getTimestamp().toString(),
                    n(e.getMetadataJson()));
            sha.update(canonical.getBytes(StandardCharsets.UTF_8));
            sha.update((byte) 0x1e); // record separator, so field-shifting cannot collide
        }
        return HexFormat.of().formatHex(sha.digest());
    }

    private static String n(String s) { return s == null ? "" : s; }

    private String toJson(Object o) {
        try { return objectMapper.writeValueAsString(o); } catch (Exception e) { return "{}"; }
    }
}

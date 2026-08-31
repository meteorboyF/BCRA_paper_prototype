package com.pangochain.backend.access;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.pangochain.backend.audit.AuditService;
import com.pangochain.backend.blockchain.FabricException;
import com.pangochain.backend.blockchain.FabricGatewayService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;

/**
 * Drains the {@link PendingAnchor} outbox on a fixed schedule.
 *
 * This is the fix for bcra_peer_review.md M1 (Experiment 16): before this worker existed,
 * {@code RevokeAccess} caught a Fabric submit failure, logged it, and returned 204 — the
 * ledger grant stayed ACTIVE forever with no reconciliation once the orderers recovered.
 * Now a failed inline submit leaves a PENDING row instead of being dropped, and this worker
 * retries it with capped exponential backoff until it commits. The result is a *bounded,
 * measured* divergence window instead of a silent, permanent one — see Experiment 16b.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class AnchorReconciliationWorker {

    private static final int MAX_BATCH = 25;

    private final PendingAnchorRepository pendingAnchorRepository;
    private final AuditService auditService;
    private final ObjectMapper objectMapper;

    @Autowired(required = false)
    private FabricGatewayService fabricGatewayService;

    @Value("${access.anchor-retry.base-backoff-seconds:5}")
    private long baseBackoffSeconds;

    /**
     * Cap on the retry interval. Deliberately short (1 minute, not the 5 minutes a generic
     * outbox would use): the divergence window is outage duration *plus* this reconciliation
     * lag, and the lag is the only part we control. A long cap would leave a revoked user
     * authorized for minutes after Fabric is already healthy again. Retries are cheap while
     * the resilience4j breaker is open — it fast-fails them — so frequent retries cost little.
     */
    @Value("${access.anchor-retry.max-backoff-seconds:60}")
    private long maxBackoffSeconds;

    @Scheduled(fixedDelay = 5000)
    public void drain() {
        if (fabricGatewayService == null) return; // Fabric disabled — nothing to reconcile against
        List<PendingAnchor> due = pendingAnchorRepository.findByStatusAndNextAttemptAtBefore(
                PendingAnchor.Status.PENDING, Instant.now(),
                PageRequest.of(0, MAX_BATCH, Sort.by("createdAt")));
        for (PendingAnchor anchor : due) {
            // FIFO guard: never replay an anchor while an older PENDING sibling exists for the
            // same (doc, user). A grant queued before a revoke that committed after it would
            // re-authorize the revoked user; draining in creation order per pair makes the
            // reconciled ledger history match the caller's intent order. The batch above is
            // already sorted, so the older sibling is normally attempted first within the same
            // pass and this check only fires when it failed again moments ago.
            boolean olderSiblingPending = pendingAnchorRepository
                    .existsByStatusAndDocIdAndTargetUserIdAndCreatedAtBefore(
                            PendingAnchor.Status.PENDING, anchor.getDocId(),
                            anchor.getTargetUserId(), anchor.getCreatedAt());
            if (olderSiblingPending) {
                log.debug("Anchor {} deferred: older pending anchor exists for doc={} user={}",
                        anchor.getId(), anchor.getDocId(), anchor.getTargetUserId());
                continue;
            }
            attempt(anchor);
        }
    }

    @Transactional
    void attempt(PendingAnchor anchor) {
        try {
            String txId = switch (anchor.getChaincodeFunction()) {
                case "RevokeAccess" -> fabricGatewayService.revokeAccess(
                        anchor.getDocId().toString(),
                        anchor.getTargetUserId().toString(),
                        anchor.getRevokerId().toString());
                case "GrantAccess" -> replayGrant(anchor);
                default -> throw new FabricException(
                        "No reconciliation handler for chaincode function: " + anchor.getChaincodeFunction());
            };

            Instant committedAt = Instant.now();
            anchor.setStatus(PendingAnchor.Status.COMMITTED);
            anchor.setFabricTxId(txId);
            anchor.setCommittedAt(committedAt);
            pendingAnchorRepository.save(anchor);

            long divergenceMs = Duration.between(anchor.getCreatedAt(), committedAt).toMillis();
            log.info("Anchor {} ({}) committed after {} retr{}, divergence window {}ms, txId={}",
                    anchor.getId(), anchor.getChaincodeFunction(), anchor.getAttempts(),
                    anchor.getAttempts() == 1 ? "y" : "ies", divergenceMs, txId);

            String auditEvent = "GrantAccess".equals(anchor.getChaincodeFunction())
                    ? "ACCESS_GRANTED_LEDGER_SYNCED" : "ACCESS_REVOKED_LEDGER_SYNCED";
            auditService.log(auditEvent, anchor.getRevokerId(), "DOCUMENT",
                    anchor.getDocId().toString(), txId,
                    toJson(Map.of(
                            "targetUser", anchor.getTargetUserId().toString(),
                            "pendingAnchorId", anchor.getId().toString(),
                            "retries", anchor.getAttempts(),
                            "divergenceWindowMs", divergenceMs)));
        } catch (FabricException e) {
            anchor.setAttempts(anchor.getAttempts() + 1);
            anchor.setLastError(e.getMessage());
            long backoffSeconds = Math.min(
                    baseBackoffSeconds * (1L << Math.min(anchor.getAttempts(), 10)),
                    maxBackoffSeconds);
            anchor.setNextAttemptAt(Instant.now().plusSeconds(backoffSeconds));
            pendingAnchorRepository.save(anchor);
            log.warn("Anchor {} ({}) retry {} failed, next attempt in {}s: {}",
                    anchor.getId(), anchor.getChaincodeFunction(), anchor.getAttempts(),
                    backoffSeconds, e.getMessage());
        }
    }

    /**
     * Replays a queued GrantAccess from the anchor's JSON payload. GrantAccess overwrites the
     * document's ACL entry for the target subject, so replay after an already-successful but
     * unrecorded submit is idempotent.
     */
    private String replayGrant(PendingAnchor anchor) throws FabricException {
        try {
            Map<String, String> p = objectMapper.readValue(anchor.getPayload(),
                    objectMapper.getTypeFactory().constructMapType(Map.class, String.class, String.class));
            return fabricGatewayService.grantAccess(
                    anchor.getDocId().toString(),
                    anchor.getTargetUserId().toString(),
                    p.get("granteeMsp"),
                    p.get("capability"),
                    p.getOrDefault("expiresAt", ""),
                    p.get("wrappedKeyRef"),
                    anchor.getRevokerId().toString(),
                    p.getOrDefault("recipientKeyHash", ""));
        } catch (FabricException e) {
            throw e;
        } catch (Exception e) {
            throw new FabricException("Unreadable GrantAccess payload for anchor " + anchor.getId(), e);
        }
    }

    private String toJson(Object obj) {
        try {
            return objectMapper.writeValueAsString(obj);
        } catch (Exception e) {
            return "{}";
        }
    }
}

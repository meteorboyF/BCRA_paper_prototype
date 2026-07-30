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
                PendingAnchor.Status.PENDING, Instant.now(), PageRequest.of(0, MAX_BATCH));
        for (PendingAnchor anchor : due) {
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

            auditService.log("ACCESS_REVOKED_LEDGER_SYNCED", anchor.getRevokerId(), "DOCUMENT",
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

    private String toJson(Object obj) {
        try {
            return objectMapper.writeValueAsString(obj);
        } catch (Exception e) {
            return "{}";
        }
    }
}

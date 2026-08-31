package com.pangochain.backend.access;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface PendingAnchorRepository extends JpaRepository<PendingAnchor, UUID> {

    List<PendingAnchor> findByStatusAndNextAttemptAtBefore(
            PendingAnchor.Status status, Instant cutoff, Pageable pageable);

    /**
     * FIFO guard for the reconciliation worker: true if an older PENDING anchor exists for
     * the same (document, user). Draining strictly in creation order per pair preserves the
     * caller's intent order — a grant queued before a revoke can never commit after it.
     */
    boolean existsByStatusAndDocIdAndTargetUserIdAndCreatedAtBefore(
            PendingAnchor.Status status, UUID docId, UUID targetUserId, Instant createdAt);
}

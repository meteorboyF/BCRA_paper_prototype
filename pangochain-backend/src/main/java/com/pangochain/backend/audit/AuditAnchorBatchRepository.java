package com.pangochain.backend.audit;

import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AuditAnchorBatchRepository extends JpaRepository<AuditAnchorBatch, Long> {

    /** The anchoring watermark: highest audit id covered by a committed batch, or null. */
    @Query("SELECT MAX(b.lastAuditId) FROM AuditAnchorBatch b WHERE b.status = 'COMMITTED'")
    Long findWatermark();

    long countByStatus(AuditAnchorBatch.Status status);
}

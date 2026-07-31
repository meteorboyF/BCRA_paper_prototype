package com.pangochain.backend.audit;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

/**
 * A checkpoint anchoring a contiguous range of audit_log ids to the ledger.
 *
 * audit_log is append-only, so anchoring state cannot live on the audit rows; it lives here
 * instead. The highest COMMITTED last_audit_id is the watermark - audit rows above it are
 * the durable anchoring backlog. See AuditAnchorBackfillWorker for why this exists.
 */
@Entity
@Table(name = "audit_anchor_batch")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AuditAnchorBatch {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "first_audit_id", nullable = false)
    private Long firstAuditId;

    @Column(name = "last_audit_id", nullable = false)
    private Long lastAuditId;

    @Column(name = "event_count", nullable = false)
    private int eventCount;

    /** SHA-256 over the batch's audit rows, in id order. */
    @Column(nullable = false)
    private String digest;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Status status;

    @Column(nullable = false)
    @Builder.Default
    private int attempts = 0;

    @Column(name = "fabric_tx_id")
    private String fabricTxId;

    @Column(name = "last_error", columnDefinition = "TEXT")
    private String lastError;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "committed_at")
    private Instant committedAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = Instant.now();
    }

    public enum Status { PENDING, COMMITTED, FAILED }
}

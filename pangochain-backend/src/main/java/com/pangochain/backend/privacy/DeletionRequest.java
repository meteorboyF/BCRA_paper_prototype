package com.pangochain.backend.privacy;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

/** A GDPR erasure request and its review status. */
@Entity
@Table(name = "deletion_requests")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class DeletionRequest {

    public enum Status { PENDING, IN_REVIEW, COMPLETED, DENIED }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private Status status = Status.PENDING;

    @Column(columnDefinition = "TEXT")
    private String reason;

    @Column(columnDefinition = "TEXT")
    private String resolution;

    @Column(name = "processed_by")
    private UUID processedBy;

    @Column(name = "processed_at")
    private Instant processedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void prePersist() { if (createdAt == null) createdAt = Instant.now(); }
}

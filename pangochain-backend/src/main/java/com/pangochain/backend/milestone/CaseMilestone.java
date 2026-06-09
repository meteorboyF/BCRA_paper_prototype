package com.pangochain.backend.milestone;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

/** A lawyer-managed milestone in a case's progress timeline (client-visible). */
@Entity
@Table(name = "case_milestones")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class CaseMilestone {

    public enum Status { PENDING, IN_PROGRESS, COMPLETED }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "case_id", nullable = false)
    private UUID caseId;

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private Status status = Status.PENDING;

    @Column(name = "target_date")
    private Instant targetDate;

    @Column(name = "completed_at")
    private Instant completedAt;

    @Column(name = "sort_order", nullable = false)
    @Builder.Default
    private int sortOrder = 0;

    @Column(name = "created_by")
    private UUID createdBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void prePersist() { if (createdAt == null) createdAt = Instant.now(); }
}

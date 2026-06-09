package com.pangochain.backend.deadline;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

/** A tracked legal deadline (custom, statute of limitations, filing, court date) for a case. */
@Entity
@Table(name = "case_deadlines")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class CaseDeadline {

    public enum Type { CUSTOM, STATUTE_OF_LIMITATIONS, FILING, COURT, DISCOVERY }

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
    @Column(name = "deadline_type", nullable = false)
    @Builder.Default
    private Type deadlineType = Type.CUSTOM;

    @Column(name = "deadline_date", nullable = false)
    private Instant deadlineDate;

    @Column(name = "linked_doc_id")
    private UUID linkedDocId;

    @Column(nullable = false)
    @Builder.Default
    private boolean completed = false;

    @Column(name = "completed_at")
    private Instant completedAt;

    @Column(name = "created_by")
    private UUID createdBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void prePersist() { if (createdAt == null) createdAt = Instant.now(); }
}

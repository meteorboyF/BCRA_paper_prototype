package com.pangochain.backend.billing;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

/** A billable unit of work on a case (optionally tied to a document). Amounts in integer cents. */
@Entity
@Table(name = "time_entries")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class TimeEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "case_id", nullable = false)
    private UUID caseId;

    @Column(name = "user_id")
    private UUID userId;

    @Column(nullable = false)
    private String description;

    @Column(nullable = false)
    @Builder.Default
    private int minutes = 0;

    @Column(name = "rate_cents", nullable = false)
    @Builder.Default
    private int rateCents = 0;

    @Column(name = "linked_doc_id")
    private UUID linkedDocId;

    @Column(name = "entry_date", nullable = false)
    private Instant entryDate;

    @Column(nullable = false)
    @Builder.Default
    private boolean invoiced = false;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = Instant.now();
        if (entryDate == null) entryDate = createdAt;
    }
}

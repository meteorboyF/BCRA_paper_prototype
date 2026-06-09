package com.pangochain.backend.cases.conflict;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

/** Audit record of a conflict-of-interest check: who ran it, what was searched, and the result. */
@Entity
@Table(name = "conflict_check_log")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ConflictCheckLog {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "firm_id")
    private UUID firmId;

    @Column(name = "requested_by")
    private UUID requestedBy;

    @Column(name = "query_terms", columnDefinition = "TEXT")
    private String queryTerms;

    @Column(name = "match_count", nullable = false)
    @Builder.Default
    private int matchCount = 0;

    @Column(name = "matched_case_ids", columnDefinition = "TEXT")
    private String matchedCaseIds;

    @Column(nullable = false)
    @Builder.Default
    private boolean acknowledged = false;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void prePersist() { if (createdAt == null) createdAt = Instant.now(); }
}

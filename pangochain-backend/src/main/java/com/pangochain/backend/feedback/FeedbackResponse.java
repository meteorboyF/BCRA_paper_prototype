package com.pangochain.backend.feedback;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

/** A client satisfaction rating (1–5) with optional free-text and context. */
@Entity
@Table(name = "feedback_responses")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class FeedbackResponse {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "client_id", nullable = false)
    private UUID clientId;

    @Column(name = "case_id")
    private UUID caseId;

    @Column(nullable = false)
    private int rating;

    @Column(columnDefinition = "TEXT")
    private String comment;

    @Column(nullable = false)
    @Builder.Default
    private String context = "GENERAL";

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void prePersist() { if (createdAt == null) createdAt = Instant.now(); }
}

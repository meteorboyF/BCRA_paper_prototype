package com.pangochain.backend.classification;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

/** A record of one category suggestion (and, when known, the accepted category). */
@Entity
@Table(name = "document_classification_log")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class DocumentClassificationLog {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "doc_id")
    private UUID docId;

    @Column(name = "file_name")
    private String fileName;

    @Column(name = "suggested_category")
    private String suggestedCategory;

    @Column(nullable = false)
    @Builder.Default
    private int confidence = 0;

    @Column(name = "accepted_category")
    private String acceptedCategory;

    @Column(name = "requested_by")
    private UUID requestedBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void prePersist() { if (createdAt == null) createdAt = Instant.now(); }
}

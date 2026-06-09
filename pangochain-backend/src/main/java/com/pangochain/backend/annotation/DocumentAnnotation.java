package com.pangochain.backend.annotation;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

/** A collaborative comment on a document, optionally a reply (parentId) and optionally pinned to a
 *  page/position. Bound to a document version_hash so it stays anchored across new versions. */
@Entity
@Table(name = "document_annotations")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class DocumentAnnotation {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "document_id", nullable = false)
    private UUID documentId;

    @Column(name = "version_hash")
    private String versionHash;

    @Column(name = "parent_id")
    private UUID parentId;

    @Column
    private Integer page;

    @Column(name = "position_json", columnDefinition = "text")
    private String positionJson;

    @Column(nullable = false, columnDefinition = "text")
    private String body;

    @Column(name = "author_id")
    private UUID authorId;

    @Column(nullable = false)
    @Builder.Default
    private String status = "OPEN";

    @Column(name = "resolved_by")
    private UUID resolvedBy;

    @Column(name = "resolved_at")
    private Instant resolvedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = Instant.now();
    }
}

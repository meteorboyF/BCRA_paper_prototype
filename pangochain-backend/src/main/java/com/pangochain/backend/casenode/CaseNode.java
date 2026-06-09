package com.pangochain.backend.casenode;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

/**
 * A node in a case's "journey" tree: a finding, note, piece of evidence, research point,
 * or a hearing/filing milestone. {@code parentId} forms the tree; {@code mergeIntoId} is an
 * optional convergence edge (rendered dashed) toward a hearing/filing node.
 */
@Entity
@Table(name = "case_nodes")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class CaseNode {

    public enum Type { ROOT, FINDING, EVIDENCE, RESEARCH, LOOPHOLE, HEARING, FILING }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "case_id", nullable = false)
    private UUID caseId;

    @Column(name = "parent_id")
    private UUID parentId;

    @Column(name = "merge_into_id")
    private UUID mergeIntoId;

    @Column(name = "author_id")
    private UUID authorId;

    @Enumerated(EnumType.STRING)
    @Column(name = "node_type", nullable = false)
    private Type nodeType;

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "linked_doc_id")
    private UUID linkedDocId;

    @Column(name = "node_date", nullable = false)
    private Instant nodeDate;

    /** Set when this node has been operationally consolidated into its merge-into target. */
    @Column(nullable = false)
    @Builder.Default
    private boolean merged = false;

    @Column(name = "merged_at")
    private Instant mergedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = Instant.now();
        if (nodeDate == null) nodeDate = createdAt;
    }
}

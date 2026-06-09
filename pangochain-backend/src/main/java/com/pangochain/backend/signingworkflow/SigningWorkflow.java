package com.pangochain.backend.signingworkflow;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

/** An ordered multi-party signing ceremony on a document. */
@Entity
@Table(name = "signing_workflows")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class SigningWorkflow {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "document_id", nullable = false)
    private UUID documentId;

    @Column(name = "case_id")
    private UUID caseId;

    @Column(nullable = false)
    private String title;

    @Column(name = "document_hash_b64", nullable = false, columnDefinition = "text")
    private String documentHashB64;

    @Column(name = "initiated_by")
    private UUID initiatedBy;

    @Column(nullable = false)
    @Builder.Default
    private String status = "PENDING";

    @Column(name = "fabric_tx_id")
    private String fabricTxId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "completed_at")
    private Instant completedAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = Instant.now();
    }
}

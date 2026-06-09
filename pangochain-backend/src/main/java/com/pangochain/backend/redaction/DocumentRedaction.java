package com.pangochain.backend.redaction;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

/** Records that a redacted copy (child CID) was produced from an original document (parent CID). */
@Entity
@Table(name = "document_redactions")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class DocumentRedaction {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "original_doc_id", nullable = false)
    private UUID originalDocId;

    @Column(name = "redacted_doc_id", nullable = false)
    private UUID redactedDocId;

    @Column(name = "original_cid")
    private String originalCid;

    @Column(name = "redacted_cid")
    private String redactedCid;

    @Column(name = "redaction_count", nullable = false)
    @Builder.Default
    private int redactionCount = 0;

    @Column(name = "redacting_user_id")
    private UUID redactingUserId;

    @Column(name = "fabric_tx_id")
    private String fabricTxId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = Instant.now();
    }
}

package com.pangochain.backend.template;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

/** A record that a specific template version was used to generate a document on a case. The
 *  param_hash binds the exact parameter set; the document_id links the encrypted instrument. */
@Entity
@Table(name = "template_generations")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class TemplateGeneration {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "template_id", nullable = false)
    private UUID templateId;

    @Column(name = "template_key", nullable = false)
    private String templateKey;

    @Column(name = "template_version", nullable = false)
    private int templateVersion;

    @Column(name = "case_id", nullable = false)
    private UUID caseId;

    @Column(name = "document_id")
    private UUID documentId;

    @Column(name = "param_hash", nullable = false)
    private String paramHash;

    @Column(name = "generated_by")
    private UUID generatedBy;

    @Column(name = "fabric_tx_id")
    private String fabricTxId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = Instant.now();
    }
}

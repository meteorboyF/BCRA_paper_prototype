package com.pangochain.backend.document;

import com.pangochain.backend.cases.Case;
import com.pangochain.backend.user.User;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "documents")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Document {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "case_id", nullable = false)
    private Case legalCase;

    @Column(name = "file_name", nullable = false)
    private String fileName;

    @Column(name = "ipfs_cid", nullable = false, length = 128)
    private String ipfsCid;

    @Column(name = "document_hash_sha256", nullable = false, length = 64)
    private String documentHashSha256;

    @Column(name = "fabric_tx_id", length = 128)
    private String fabricTxId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_id", nullable = false)
    private User owner;

    @Column(nullable = false)
    @Builder.Default
    private int version = 1;

    @Column(name = "previous_version_id")
    private UUID previousVersionId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private DocStatus status = DocStatus.ACTIVE;

    @Column(name = "key_rotation_pending", nullable = false)
    @Builder.Default
    private boolean keyRotationPending = false;

    @Column(name = "category", nullable = false, length = 100)
    @Builder.Default
    private String category = "GENERAL";

    @Column(name = "confidential", nullable = false)
    @Builder.Default
    private boolean confidential = false;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void prePersist() {
        createdAt = Instant.now();
        if (status == null) status = DocStatus.ACTIVE;
        if (version == 0) version = 1;
    }
}

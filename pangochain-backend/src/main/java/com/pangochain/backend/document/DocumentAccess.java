package com.pangochain.backend.document;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "document_access")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class DocumentAccess {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "doc_id", nullable = false)
    private UUID docId;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Capability capability;

    @Column(name = "granted_by")
    private UUID grantedBy;

    @Column(name = "granted_at", nullable = false, updatable = false)
    private Instant grantedAt;

    @Column(name = "expires_at")
    private Instant expiresAt;

    @Column(name = "revoked_at")
    private Instant revokedAt;

    @Column(name = "revoked_by")
    private UUID revokedBy;

    // Base64-encoded ECIES-wrapped AES-256 document key
    @Column(name = "wrapped_key_token", nullable = false, columnDefinition = "TEXT")
    private String wrappedKeyToken;

    // True when key rotation has rendered this token untrustworthy.
    // Old token is preserved for audit purposes but must not be used for decryption.
    @Column(name = "token_obsolete", nullable = false)
    @Builder.Default
    private boolean tokenObsolete = false;

    @PrePersist
    void prePersist() { grantedAt = Instant.now(); }

    public boolean isActive() {
        return revokedAt == null && (expiresAt == null || expiresAt.isAfter(Instant.now()));
    }

    public enum Capability { owner, write, read }
}

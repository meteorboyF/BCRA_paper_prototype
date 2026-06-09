package com.pangochain.backend.auth;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

/**
 * A single-use TOTP recovery code. Only the PBKDF2-SHA256 hash (+ per-code salt) is stored;
 * the plaintext is shown to the user exactly once, at generation time.
 */
@Entity
@Table(name = "user_recovery_codes")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class UserRecoveryCode {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "code_hash", nullable = false)
    private String codeHash;

    @Column(nullable = false)
    private String salt;

    @Column(nullable = false)
    @Builder.Default
    private boolean used = false;

    @Column(name = "used_at")
    private Instant usedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void prePersist() { if (createdAt == null) createdAt = Instant.now(); }
}

package com.pangochain.backend.user;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "users")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class User implements UserDetails {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    @Column(nullable = false)
    private String salt;

    @Column(name = "full_name", nullable = false)
    private String fullName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private UserRole role;

    // EAGER: the authenticated principal is loaded once per request in the JWT filter and
    // its firm (name/id/mspId) is needed across many controllers. With open-in-view=false the
    // session is closed before controllers run, so a LAZY firm would throw
    // LazyInitializationException. The firm row is tiny, so eager loading is cheap and correct.
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "firm_id")
    private Firm firm;

    @Column(name = "fabric_identity_id")
    private String fabricIdentityId;

    // ECIES P-256 public key in JWK format — for document key wrapping
    @Column(name = "public_key_ecies", columnDefinition = "TEXT")
    private String publicKeyEcies;

    // ECDSA P-256 public key in JWK format — for document signature verification
    @Column(name = "signing_public_key", columnDefinition = "TEXT")
    private String signingPublicKey;

    @Column(name = "mfa_secret")
    private String mfaSecret;

    @Column(name = "mfa_enabled", nullable = false)
    @Builder.Default
    private boolean mfaEnabled = false;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private AccountStatus status = AccountStatus.PENDING_APPROVAL;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "last_login_at")
    private Instant lastLoginAt;

    @PrePersist
    void prePersist() {
        createdAt = Instant.now();
        if (status == null) status = AccountStatus.PENDING_APPROVAL;
    }

    public boolean isLegalProfessional() {
        return role != null && switch (role) {
            case CLIENT_PRIMARY, CLIENT_SECONDARY, CLIENT_CORP_ADMIN -> false;
            default -> true;
        };
    }

    public boolean isClient() {
        return !isLegalProfessional();
    }

    public boolean isPartnerOrAbove() {
        return role != null && switch (role) {
            case MANAGING_PARTNER, PARTNER_SENIOR, PARTNER_JUNIOR -> true;
            default -> false;
        };
    }

    public boolean requiresMfaEnrollment() {
        return isPartnerOrAbove() || role == UserRole.IT_ADMIN;
    }

    // ── UserDetails ────────────────────────────────────────────────────────────
    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return List.of(new SimpleGrantedAuthority("ROLE_" + role.name()));
    }

    @Override
    public String getUsername() { return email; }

    @Override
    public String getPassword() { return passwordHash; }

    @Override
    public boolean isAccountNonExpired() { return true; }

    @Override
    public boolean isAccountNonLocked() { return status != AccountStatus.SUSPENDED; }

    @Override
    public boolean isCredentialsNonExpired() { return true; }

    @Override
    public boolean isEnabled() { return status == AccountStatus.ACTIVE; }
}

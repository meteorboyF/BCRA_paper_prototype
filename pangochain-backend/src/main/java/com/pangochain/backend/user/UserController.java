package com.pangochain.backend.user;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import com.pangochain.backend.document.DocumentAccessRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class UserController {

    private final UserRepository userRepository;
    private final DocumentAccessRepository accessRepository;

    public record SetPublicKeysRequest(@NotBlank String publicKeyJwk, String signingPublicKeyJwk) {}

    /**
     * Upsert the current user's public keys. Used by first-login key provisioning so that
     * accounts created server-side (e.g. seeded demo users) become E2E-capable the first
     * time they log in through the browser — the browser generates the keypairs, keeps the
     * PBKDF2-wrapped private keys in localStorage, and registers the public keys here.
     */
    @Transactional
    @PutMapping("/me/public-keys")
    public ResponseEntity<Void> setMyPublicKeys(
            @Valid @RequestBody SetPublicKeysRequest req,
            @AuthenticationPrincipal UserDetails principal) {
        User user = userRepository.findByEmail(principal.getUsername())
                .orElseThrow(() -> new IllegalStateException("User not found"));
        user.setPublicKeyEcies(req.publicKeyJwk());
        if (req.signingPublicKeyJwk() != null && !req.signingPublicKeyJwk().isBlank()) {
            user.setSigningPublicKey(req.signingPublicKeyJwk());
        }
        userRepository.save(user);
        return ResponseEntity.noContent().build();
    }

    /** Returns the ECIES P-256 public key (JWK) for a user — needed before granting document access. */
    @GetMapping("/{id}/public-key")
    public ResponseEntity<Map<String, String>> getPublicKey(@PathVariable UUID id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        if (user.getPublicKeyEcies() == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(Map.of("publicKeyJwk", user.getPublicKeyEcies(), "userId", id.toString()));
    }

    /** List the caller's firm members (excluding self) — for the direct-message picker. */
    @GetMapping("/firm-directory")
    public ResponseEntity<java.util.List<Map<String, Object>>> firmDirectory(
            @AuthenticationPrincipal UserDetails principal) {
        User me = userRepository.findByEmail(principal.getUsername())
                .orElseThrow(() -> new IllegalStateException("User not found"));
        if (me.getFirm() == null) return ResponseEntity.ok(java.util.List.of());
        java.util.List<Map<String, Object>> directory = userRepository.findByFirm_Id(me.getFirm().getId()).stream()
                .filter(u -> !u.getId().equals(me.getId()))
                .map(u -> Map.<String, Object>of(
                        "id", u.getId().toString(),
                        "fullName", u.getFullName(),
                        "email", u.getEmail(),
                        "role", u.getRole().name(),
                        "hasPublicKey", u.getPublicKeyEcies() != null))
                .toList();
        return ResponseEntity.ok(directory);
    }

    /** Look up a user by email — for the access-grant form. */
    @GetMapping("/by-email")
    public ResponseEntity<Map<String, Object>> findByEmail(@RequestParam String email) {
        return userRepository.findByEmail(email)
                .map(u -> ResponseEntity.ok(Map.<String, Object>of(
                        "id", u.getId().toString(),
                        "email", u.getEmail(),
                        "fullName", u.getFullName(),
                        "role", u.getRole().name(),
                        "hasPublicKey", u.getPublicKeyEcies() != null
                )))
                .orElse(ResponseEntity.notFound().build());
    }

    /** Access-grant suggestions: same-firm users below the caller's role who do not already have access. */
    @GetMapping("/access-candidates")
    public ResponseEntity<java.util.List<Map<String, Object>>> accessCandidates(
            @RequestParam UUID docId,
            @RequestParam(required = false, defaultValue = "") String q,
            @AuthenticationPrincipal UserDetails principal) {
        User me = userRepository.findByEmail(principal.getUsername())
                .orElseThrow(() -> new IllegalStateException("User not found"));
        if (me.getFirm() == null) return ResponseEntity.ok(java.util.List.of());
        String needle = q == null ? "" : q.trim().toLowerCase();
        java.util.List<Map<String, Object>> out = userRepository.findByFirm_Id(me.getFirm().getId()).stream()
                .filter(u -> !u.getId().equals(me.getId()))
                .filter(u -> rank(u.getRole()) < rank(me.getRole()))
                .filter(u -> accessRepository.findActiveEntry(docId, u.getId()).isEmpty())
                .filter(u -> needle.isBlank()
                        || u.getEmail().toLowerCase().contains(needle)
                        || u.getFullName().toLowerCase().contains(needle))
                .limit(8)
                .map(u -> Map.<String, Object>of(
                        "id", u.getId().toString(),
                        "fullName", u.getFullName(),
                        "email", u.getEmail(),
                        "role", u.getRole().name(),
                        "hasPublicKey", u.getPublicKeyEcies() != null))
                .toList();
        return ResponseEntity.ok(out);
    }

    private static int rank(UserRole role) {
        return switch (role) {
            case MANAGING_PARTNER, IT_ADMIN -> 100;
            case PARTNER_SENIOR -> 90;
            case PARTNER_JUNIOR -> 80;
            case ASSOCIATE_SENIOR -> 70;
            case ASSOCIATE_JUNIOR -> 60;
            case PARALEGAL, SECRETARY -> 50;
            case CLIENT_CORP_ADMIN -> 40;
            case CLIENT_PRIMARY -> 30;
            case CLIENT_SECONDARY -> 20;
            case REGULATOR -> 10;
        };
    }
}

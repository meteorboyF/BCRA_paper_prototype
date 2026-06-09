package com.pangochain.backend.admin;

import com.pangochain.backend.audit.AuditService;
import com.pangochain.backend.user.AccountStatus;
import com.pangochain.backend.user.User;
import com.pangochain.backend.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.security.MessageDigest;
import java.util.Base64;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('MANAGING_PARTNER','IT_ADMIN')")
public class AdminController {

    private final UserRepository userRepository;
    private final AuditService auditService;

    @GetMapping("/users")
    public ResponseEntity<Page<UserSummary>> listUsers(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        PageRequest pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        Page<UserSummary> result = userRepository.findAll(pageable).map(UserSummary::from);
        return ResponseEntity.ok(result);
    }

    @PostMapping("/users/{id}/activate")
    public ResponseEntity<Map<String, String>> activate(@PathVariable UUID id,
            @AuthenticationPrincipal User actor) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + id));
        user.setStatus(AccountStatus.ACTIVE);
        userRepository.save(user);
        auditService.log("USER_ACTIVATED", actor.getId(), "USER", id.toString(), null,
                "{\"newStatus\":\"ACTIVE\"}");
        return ResponseEntity.ok(Map.of("status", "ACTIVE", "userId", id.toString()));
    }

    @PostMapping("/users/{id}/suspend")
    public ResponseEntity<Map<String, String>> suspend(@PathVariable UUID id,
            @AuthenticationPrincipal User actor) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + id));
        user.setStatus(AccountStatus.SUSPENDED);
        userRepository.save(user);
        auditService.log("USER_SUSPENDED", actor.getId(), "USER", id.toString(), null,
                "{\"newStatus\":\"SUSPENDED\"}");
        return ResponseEntity.ok(Map.of("status", "SUSPENDED", "userId", id.toString()));
    }

    /** Returns public key fingerprints (SHA-256 of the JWK string) for a user's ECIES and ECDSA keys. */
    @GetMapping("/users/{id}/key-status")
    public ResponseEntity<Map<String, Object>> keyStatus(@PathVariable UUID id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("User not found: " + id));
        return ResponseEntity.ok(Map.of(
                "userId", id.toString(),
                "eciesKeyPresent", user.getPublicKeyEcies() != null,
                "eciesKeyFingerprint", fingerprint(user.getPublicKeyEcies()),
                "signingKeyPresent", user.getSigningPublicKey() != null,
                "signingKeyFingerprint", fingerprint(user.getSigningPublicKey())
        ));
    }

    private String fingerprint(String jwk) {
        if (jwk == null) return "none";
        try {
            byte[] hash = MessageDigest.getInstance("SHA-256").digest(jwk.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(hash).substring(0, 16) + "...";
        } catch (Exception e) { return "error"; }
    }

    public record UserSummary(
            UUID id, String email, String fullName, String role,
            String status, String firmName, boolean mfaEnabled
    ) {
        static UserSummary from(User u) {
            return new UserSummary(
                    u.getId(), u.getEmail(), u.getFullName(),
                    u.getRole().name(), u.getStatus().name(),
                    u.getFirm() != null ? u.getFirm().getName() : null,
                    u.isMfaEnabled()
            );
        }
    }
}

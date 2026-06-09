package com.pangochain.backend.auth;

import com.pangochain.backend.auth.dto.AuthResponse;
import com.pangochain.backend.auth.dto.LoginRequest;
import com.pangochain.backend.auth.dto.RefreshRequest;
import com.pangochain.backend.auth.dto.RegisterRequest;
import com.pangochain.backend.user.User;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(authService.register(request));
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }

    @PostMapping("/refresh")
    public ResponseEntity<AuthResponse> refresh(@Valid @RequestBody RefreshRequest request) {
        return ResponseEntity.ok(authService.refresh(request));
    }

    @PreAuthorize("isAuthenticated()")
    @PostMapping("/logout")
    public ResponseEntity<Map<String, String>> logout(@AuthenticationPrincipal User user) {
        // Stateless JWT — client simply discards tokens.
        // Phase 2 will add a token denylist for immediate invalidation.
        return ResponseEntity.ok(Map.of("message", "Logged out successfully"));
    }

    @PreAuthorize("isAuthenticated()")
    @GetMapping("/me")
    public ResponseEntity<Map<String, Object>> me(@AuthenticationPrincipal User user) {
        return ResponseEntity.ok(Map.of(
                "id", user.getId(),
                "email", user.getEmail(),
                "fullName", user.getFullName(),
                "role", user.getRole(),
                "status", user.getStatus(),
                "firmId", user.getFirm() != null ? user.getFirm().getId() : null,
                "mfaEnabled", user.isMfaEnabled(),
                "publicKeyEcies", user.getPublicKeyEcies() != null ? user.getPublicKeyEcies() : ""
        ));
    }
}

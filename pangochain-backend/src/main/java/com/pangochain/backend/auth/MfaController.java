package com.pangochain.backend.auth;

import com.pangochain.backend.audit.AuditService;
import com.pangochain.backend.auth.dto.AuthResponse;
import com.pangochain.backend.user.User;
import com.pangochain.backend.user.UserRepository;
import com.warrenstrange.googleauth.GoogleAuthenticator;
import com.warrenstrange.googleauth.GoogleAuthenticatorKey;
import com.warrenstrange.googleauth.GoogleAuthenticatorQRGenerator;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * MFA/TOTP endpoints.
 *
 * Setup flow  : POST /api/auth/mfa/setup   → returns otpauth:// URI for QR scan
 * Verify flow : POST /api/auth/mfa/verify  → validates 6-digit code, enables MFA
 *
 * Required for MANAGING_PARTNER and IT_ADMIN roles on login.
 */
@RestController
@RequestMapping("/api/auth/mfa")
@RequiredArgsConstructor
@Slf4j
public class MfaController {

    private final UserRepository userRepository;
    private final AuditService auditService;
    private final AuthService authService;
    private final RecoveryCodeService recoveryCodeService;
    private final JwtTokenProvider jwtTokenProvider;

    private static final GoogleAuthenticator gAuth = new GoogleAuthenticator();

    private static final String ISSUER = "PangoChain";

    /**
     * POST /api/auth/mfa/setup
     * Generates a new TOTP secret for the authenticated user and returns the
     * otpauth:// QR URI for Google Authenticator / Authy.
     * The secret is NOT yet activated — the user must call /verify to confirm enrollment.
     */
    @PostMapping("/setup")
    public ResponseEntity<Map<String, String>> setup(
            @AuthenticationPrincipal User principal,
            @RequestBody(required = false) MfaSetupRequest req) {
        User user = resolveMfaSetupUser(principal, req != null ? req.setupToken() : null);

        GoogleAuthenticatorKey credentials = gAuth.createCredentials();
        String secret = credentials.getKey();

        // Persist secret (not yet enabled — confirmed on /verify)
        user.setMfaSecret(secret);
        userRepository.save(user);

        String qrUri = GoogleAuthenticatorQRGenerator.getOtpAuthTotpURL(
                ISSUER, user.getEmail(), credentials);

        log.info("MFA setup initiated for user={}", user.getEmail());
        return ResponseEntity.ok(Map.of(
                "secret", secret,
                "qrUri", qrUri
        ));
    }

    /**
     * POST /api/auth/mfa/verify
     * Verifies a 6-digit TOTP code and activates MFA for the account.
     * Also used during login when mfaRequired=true.
     */
    @PostMapping("/verify")
    public ResponseEntity<Map<String, Object>> verify(
            @AuthenticationPrincipal User principal,
            @Valid @RequestBody MfaVerifyRequest req) {

        User user = resolveMfaSetupUser(principal, req.setupToken());

        String secret = user.getMfaSecret();
        if (secret == null || secret.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "MFA not set up — call /mfa/setup first");
        }

        int code;
        try {
            code = Integer.parseInt(req.code());
        } catch (NumberFormatException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid TOTP code format");
        }

        boolean valid = gAuth.authorize(secret, code);
        if (!valid) {
            auditService.log("MFA_VERIFY_FAILED", user.getId(), "USER", user.getId().toString(), null, null);
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid or expired TOTP code");
        }

        // Activate MFA on first successful verify
        boolean newlyEnabled = false;
        if (!user.isMfaEnabled()) {
            user.setMfaEnabled(true);
            userRepository.save(user);
            newlyEnabled = true;
            log.info("MFA enabled for user={}", user.getEmail());
        }

        auditService.log("MFA_VERIFY_SUCCESS", user.getId(), "USER", user.getId().toString(), null, null);

        Map<String, Object> body = new HashMap<>();
        body.put("mfaEnabled", true);
        body.put("message", "MFA verified successfully");
        // Issue single-use recovery codes once, at enrolment. Shown to the user exactly here.
        if (newlyEnabled) {
            body.put("recoveryCodes", recoveryCodeService.regenerate(user.getId()));
            auditService.log("RECOVERY_CODES_GENERATED", user.getId(), "USER", user.getId().toString(), null, null);
        }

        if (req.setupToken() != null && !req.setupToken().isBlank()) {
            user.setLastLoginAt(Instant.now());
            userRepository.save(user);
            auditService.log("USER_LOGIN", user.getId(), "USER", user.getId().toString(), null, "mfa-setup");
            body.put("accessToken", jwtTokenProvider.generateAccessToken(user.getId(), user.getEmail(), user.getRole().name()));
            body.put("refreshToken", jwtTokenProvider.generateRefreshToken(user.getId(), user.getEmail(), user.getRole().name()));
            body.put("userId", user.getId());
            body.put("email", user.getEmail());
            body.put("fullName", user.getFullName());
            body.put("role", user.getRole());
            body.put("firmId", user.getFirm() != null ? user.getFirm().getId().toString() : null);
            body.put("mfaRequired", false);
        }
        return ResponseEntity.ok(body);
    }

    /**
     * POST /api/auth/mfa/recovery-codes
     * Regenerate the authenticated user's recovery codes (invalidating the old set). Returns
     * the fresh plaintext codes once. Requires MFA to already be enabled.
     */
    @PostMapping("/recovery-codes")
    public ResponseEntity<Map<String, Object>> regenerateRecoveryCodes(@AuthenticationPrincipal User user) {
        if (user == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        if (!user.isMfaEnabled()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Enable MFA before generating recovery codes");
        }
        auditService.log("RECOVERY_CODES_GENERATED", user.getId(), "USER", user.getId().toString(), null, "regenerated");
        return ResponseEntity.ok(Map.of("recoveryCodes", recoveryCodeService.regenerate(user.getId())));
    }

    /** GET /api/auth/mfa/recovery-codes/remaining — how many unused codes the user has left. */
    @GetMapping("/recovery-codes/remaining")
    public ResponseEntity<Map<String, Object>> remainingRecoveryCodes(@AuthenticationPrincipal User user) {
        if (user == null) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        return ResponseEntity.ok(Map.of("remaining", recoveryCodeService.remaining(user.getId())));
    }

    /**
     * POST /api/auth/mfa/recovery
     * Login fallback: accepts a challenge token + a single-use recovery code. On success it
     * consumes the code, completes login for one session, and resets MFA so the user must
     * re-enrol (a fresh secret + new recovery codes).
     */
    @PostMapping("/recovery")
    public ResponseEntity<AuthResponse> recoveryLogin(@Valid @RequestBody RecoveryLoginRequest req) {
        return ResponseEntity.ok(authService.completeRecoveryChallenge(req.challengeToken(), req.recoveryCode()));
    }

    /**
     * POST /api/auth/mfa/challenge
     * Accepts a short-lived challenge token + 6-digit TOTP code.
     * Returns full access + refresh tokens on success.
     * This is NOT a protected route — the challenge token itself proves partial authentication.
     */
    @PostMapping("/challenge")
    public ResponseEntity<AuthResponse> challenge(@Valid @RequestBody MfaChallengeRequest req) {
        AuthResponse response = authService.completeMfaChallenge(req.challengeToken(), req.totpCode());
        return ResponseEntity.ok(response);
    }

    public record MfaVerifyRequest(
            @NotBlank @Size(min = 6, max = 6) @Pattern(regexp = "\\d{6}") String code,
            String setupToken
    ) {}

    public record MfaSetupRequest(String setupToken) {}

    public record MfaChallengeRequest(
            @NotBlank String challengeToken,
            @NotBlank @Size(min = 6, max = 6) @Pattern(regexp = "\\d{6}") String totpCode
    ) {}

    public record RecoveryLoginRequest(
            @NotBlank String challengeToken,
            @NotBlank @Size(max = 64) String recoveryCode
    ) {}

    private User resolveMfaSetupUser(User principal, String setupToken) {
        if (principal != null) return principal;
        if (setupToken == null || setupToken.isBlank()) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        try {
            if (!jwtTokenProvider.isMfaSetupToken(setupToken)) {
                throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid setup token");
            }
            UUID userId = jwtTokenProvider.extractUserId(setupToken);
            return userRepository.findById(userId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));
        } catch (ResponseStatusException e) {
            throw e;
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid or expired setup token");
        }
    }
}

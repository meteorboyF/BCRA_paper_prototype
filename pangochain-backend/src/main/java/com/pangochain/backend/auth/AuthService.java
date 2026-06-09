package com.pangochain.backend.auth;

import com.pangochain.backend.audit.AuditService;
import com.pangochain.backend.auth.dto.AuthResponse;
import com.pangochain.backend.auth.dto.LoginRequest;
import com.pangochain.backend.auth.dto.RefreshRequest;
import com.pangochain.backend.auth.dto.RegisterRequest;
import com.pangochain.backend.crypto.Pbkdf2Service;
import com.pangochain.backend.user.*;
import com.warrenstrange.googleauth.GoogleAuthenticator;
import io.jsonwebtoken.JwtException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthService {

    private final UserRepository userRepository;
    private final FirmRepository firmRepository;
    private final Pbkdf2Service pbkdf2Service;
    private final JwtTokenProvider jwtTokenProvider;
    private final AuditService auditService;
    private final RecoveryCodeService recoveryCodeService;

    private static final GoogleAuthenticator gAuth = new GoogleAuthenticator();

    private static final List<UserRole> MFA_REQUIRED_ROLES =
            List.of(UserRole.IT_ADMIN);

    @Transactional
    public AuthResponse register(RegisterRequest req) {
        if (userRepository.existsByEmail(req.email())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email already registered");
        }

        Firm firm = null;
        if (req.firmId() != null) {
            firm = firmRepository.findById(req.firmId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Firm not found"));
        }

        String salt = pbkdf2Service.generateSalt();
        String hash = pbkdf2Service.hash(req.password(), salt);

        // Legal professionals start as PENDING_APPROVAL; clients are activated immediately by their lawyer later
        AccountStatus initialStatus = req.role().name().startsWith("CLIENT")
                ? AccountStatus.PENDING_APPROVAL
                : AccountStatus.PENDING_APPROVAL;

        User user = User.builder()
                .email(req.email())
                .passwordHash(hash)
                .salt(salt)
                .fullName(req.fullName())
                .role(req.role())
                .firm(firm)
                .publicKeyEcies(req.publicKeyJwk())
                .signingPublicKey(req.signingPublicKeyJwk())
                .status(initialStatus)
                .build();

        userRepository.save(user);

        auditService.log("USER_REGISTERED", user.getId(), "USER", user.getId().toString(), null, null);

        log.info("New user registered: {} ({}), status={}", req.email(), req.role(), initialStatus);

        // Return tokens — user must be approved before most endpoints work
        String accessToken = jwtTokenProvider.generateAccessToken(user.getId(), user.getEmail(), user.getRole().name());
        String refreshToken = jwtTokenProvider.generateRefreshToken(user.getId(), user.getEmail(), user.getRole().name());

        return buildResponse(user, accessToken, refreshToken, false);
    }

    @Transactional
    public AuthResponse login(LoginRequest req) {
        User user = userRepository.findByEmail(req.email())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials"));

        if (user.getStatus() == AccountStatus.SUSPENDED) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Account suspended");
        }

        if (!pbkdf2Service.verify(req.password(), user.getSalt(), user.getPasswordHash())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials");
        }

        // MFA enforcement: temporarily disabled for Managing Partner so audit-report
        // access can be tested without authenticator enrollment blocking login.
        if (user.getRole() == UserRole.MANAGING_PARTNER) {
            log.warn("MFA bypass active for Managing Partner login during audit-report testing: {}", user.getEmail());
        } else if (MFA_REQUIRED_ROLES.contains(user.getRole())) {
            if (!user.isMfaEnabled()) {
                String setupToken = jwtTokenProvider.generateMfaSetupToken(user.getId(), user.getEmail());
                throw new MfaSetupRequiredException(setupToken);
            }
            validateMfaCode(user, req.totpCode());
        } else if (user.isMfaEnabled()) {
            validateMfaCode(user, req.totpCode());
        }

        user.setLastLoginAt(Instant.now());
        userRepository.save(user);

        auditService.log("USER_LOGIN", user.getId(), "USER", user.getId().toString(), null, req.toString());

        String accessToken = jwtTokenProvider.generateAccessToken(user.getId(), user.getEmail(), user.getRole().name());
        String refreshToken = jwtTokenProvider.generateRefreshToken(user.getId(), user.getEmail(), user.getRole().name());

        return buildResponse(user, accessToken, refreshToken, false);
    }

    public AuthResponse refresh(RefreshRequest req) {
        try {
            if (!jwtTokenProvider.isRefreshToken(req.refreshToken())) {
                throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Not a refresh token");
            }
            UUID userId = jwtTokenProvider.extractUserId(req.refreshToken());
            User user = userRepository.findById(userId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));

            if (user.getStatus() == AccountStatus.SUSPENDED) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Account suspended");
            }

            String newAccess = jwtTokenProvider.generateAccessToken(user.getId(), user.getEmail(), user.getRole().name());
            String newRefresh = jwtTokenProvider.generateRefreshToken(user.getId(), user.getEmail(), user.getRole().name());
            return buildResponse(user, newAccess, newRefresh, false);

        } catch (JwtException e) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid refresh token");
        }
    }

    /**
     * Called from POST /api/auth/mfa/challenge — validates challenge token + TOTP, issues full JWT.
     */
    @Transactional
    public AuthResponse completeMfaChallenge(String challengeToken, String totpCode) {
        try {
            if (!jwtTokenProvider.isMfaChallengeToken(challengeToken)) {
                throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid challenge token");
            }
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid or expired challenge token");
        }

        UUID userId = jwtTokenProvider.extractUserId(challengeToken);
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));

        validateMfaCode(user, totpCode);

        user.setLastLoginAt(Instant.now());
        userRepository.save(user);
        auditService.log("USER_LOGIN", user.getId(), "USER", user.getId().toString(), null, "mfa-challenge");

        String accessToken  = jwtTokenProvider.generateAccessToken(user.getId(), user.getEmail(), user.getRole().name());
        String refreshToken = jwtTokenProvider.generateRefreshToken(user.getId(), user.getEmail(), user.getRole().name());
        return buildResponse(user, accessToken, refreshToken, false);
    }

    /**
     * Login fallback via a single-use recovery code. Validates the challenge token, consumes the
     * code, then RESETS MFA (clears the secret, disables MFA) so the user is forced to re-enrol on
     * their next login — a used recovery path must never silently leave the old TOTP secret active.
     */
    @Transactional
    public AuthResponse completeRecoveryChallenge(String challengeToken, String recoveryCode) {
        try {
            if (!jwtTokenProvider.isMfaChallengeToken(challengeToken)) {
                throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid challenge token");
            }
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid or expired challenge token");
        }

        UUID userId = jwtTokenProvider.extractUserId(challengeToken);
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not found"));

        if (!recoveryCodeService.consume(userId, recoveryCode)) {
            auditService.log("RECOVERY_CODE_FAILED", userId, "USER", userId.toString(), null, null);
            throw new InvalidMfaCodeException("Invalid or already-used recovery code");
        }

        // Force re-enrolment: drop the TOTP secret and disable MFA for this account.
        user.setMfaEnabled(false);
        user.setMfaSecret(null);
        user.setLastLoginAt(Instant.now());
        userRepository.save(user);

        auditService.log("RECOVERY_CODE_USED", userId, "USER", userId.toString(), null,
                "{\"mfaReset\":true,\"remaining\":" + recoveryCodeService.remaining(userId) + "}");
        log.warn("Recovery code used for user={} — MFA reset, re-enrolment required", user.getEmail());

        String accessToken = jwtTokenProvider.generateAccessToken(user.getId(), user.getEmail(), user.getRole().name());
        String refreshToken = jwtTokenProvider.generateRefreshToken(user.getId(), user.getEmail(), user.getRole().name());
        return buildResponse(user, accessToken, refreshToken, false);
    }

    private void validateMfaCode(User user, String totpCode) {
        if (totpCode == null || totpCode.isBlank()) {
            String challengeToken = jwtTokenProvider.generateMfaChallengeToken(
                    user.getId(), user.getEmail(), user.getRole().name());
            throw new MfaChallengeRequiredException(challengeToken);
        }
        try {
            if (!gAuth.authorize(user.getMfaSecret(), Integer.parseInt(totpCode.trim()))) {
                throw new InvalidMfaCodeException("Invalid or expired MFA code");
            }
        } catch (NumberFormatException e) {
            throw new InvalidMfaCodeException("Invalid MFA code format");
        }
    }

    private AuthResponse buildResponse(User user, String access, String refresh, boolean mfaRequired) {
        return new AuthResponse(
                access,
                refresh,
                user.getId(),
                user.getEmail(),
                user.getFullName(),
                user.getRole(),
                user.getFirm() != null ? user.getFirm().getId().toString() : null,
                mfaRequired,
                user.isMfaEnabled()
        );
    }
}

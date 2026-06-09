package com.pangochain.backend.auth;

import io.jsonwebtoken.*;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;

@Component
@RequiredArgsConstructor
@Slf4j
public class JwtTokenProvider {

    @Value("${jwt.secret}")
    private String jwtSecret;

    @Value("${jwt.access-token-expiry}")
    private long accessTokenExpirySeconds;

    @Value("${jwt.refresh-token-expiry}")
    private long refreshTokenExpirySeconds;

    private SecretKey signingKey;

    @PostConstruct
    void init() {
        signingKey = Keys.hmacShaKeyFor(jwtSecret.getBytes(StandardCharsets.UTF_8));
    }

    public String generateAccessToken(UUID userId, String email, String role) {
        return buildToken(userId, email, role, accessTokenExpirySeconds, "access");
    }

    public String generateRefreshToken(UUID userId, String email, String role) {
        return buildToken(userId, email, role, refreshTokenExpirySeconds, "refresh");
    }

    /** Short-lived token for MFA enrollment flow (10 min). Cannot be used on protected routes. */
    public String generateMfaSetupToken(UUID userId, String email) {
        return buildToken(userId, email, null, 600, "mfa_setup");
    }

    /** Short-lived token for MFA code submission (5 min). Cannot be used on protected routes. */
    public String generateMfaChallengeToken(UUID userId, String email, String role) {
        return buildToken(userId, email, role, 300, "mfa_challenge");
    }

    public boolean isMfaChallengeToken(String token) {
        return "mfa_challenge".equals(validateAndParseClaims(token).get("type", String.class));
    }

    public boolean isMfaSetupToken(String token) {
        return "mfa_setup".equals(validateAndParseClaims(token).get("type", String.class));
    }

    private String buildToken(UUID userId, String email, String role, long expirySeconds, String tokenType) {
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(userId.toString())
                .claim("email", email)
                .claim("role", role)
                .claim("type", tokenType)
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plusSeconds(expirySeconds)))
                .signWith(signingKey)
                .compact();
    }

    public Claims validateAndParseClaims(String token) {
        return Jwts.parser()
                .verifyWith(signingKey)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    public UUID extractUserId(String token) {
        return UUID.fromString(validateAndParseClaims(token).getSubject());
    }

    public String extractEmail(String token) {
        return validateAndParseClaims(token).get("email", String.class);
    }

    public String extractRole(String token) {
        return validateAndParseClaims(token).get("role", String.class);
    }

    public boolean isAccessToken(String token) {
        return "access".equals(validateAndParseClaims(token).get("type", String.class));
    }

    public boolean isRefreshToken(String token) {
        return "refresh".equals(validateAndParseClaims(token).get("type", String.class));
    }
}

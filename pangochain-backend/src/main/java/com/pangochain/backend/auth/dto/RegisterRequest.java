package com.pangochain.backend.auth.dto;

import com.pangochain.backend.user.UserRole;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.UUID;

public record RegisterRequest(
        @Email @NotBlank String email,
        @NotBlank @Size(min = 8, message = "Password must be at least 8 characters") String password,
        @NotBlank String fullName,
        @NotNull UserRole role,
        UUID firmId,
        // ECIES P-256 public key (JWK JSON string) — for document key wrapping
        @NotBlank String publicKeyJwk,
        // ECDSA P-256 public key (JWK JSON string) — for document signature verification
        String signingPublicKeyJwk
) {}

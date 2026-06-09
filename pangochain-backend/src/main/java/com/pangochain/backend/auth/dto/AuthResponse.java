package com.pangochain.backend.auth.dto;

import com.pangochain.backend.user.UserRole;

import java.util.UUID;

public record AuthResponse(
        String accessToken,
        String refreshToken,
        UUID userId,
        String email,
        String fullName,
        UserRole role,
        String firmId,
        boolean mfaRequired,
        boolean mfaEnabled
) {}

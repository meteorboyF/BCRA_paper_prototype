package com.pangochain.backend.access;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class GrantAccessRequest {
    @NotBlank private String docId;
    @NotBlank private String granteeId;
    /** "read" | "write" | "owner" */
    @NotBlank private String capability;
    /** ECIES-wrapped AES doc key, encrypted with grantee's public key — done in browser */
    @NotBlank private String wrappedKeyToken;
    /** Optional expiry epoch milliseconds */
    private Long expiresAtEpochMs;
}

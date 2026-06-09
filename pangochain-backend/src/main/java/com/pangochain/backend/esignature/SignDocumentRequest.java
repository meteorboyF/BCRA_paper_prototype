package com.pangochain.backend.esignature;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

/**
 * Browser sends: documentId (path param), documentHashB64 (SHA-256 of plaintext, base64),
 * signatureB64 (ECDSA P-256 signature over documentHashB64 bytes, IEEE P1363 format, base64).
 */
public record SignDocumentRequest(
        @NotBlank @Pattern(regexp = "[A-Za-z0-9+/=]+") String documentHashB64,
        @NotBlank @Pattern(regexp = "[A-Za-z0-9+/=]+") String signatureB64
) {}

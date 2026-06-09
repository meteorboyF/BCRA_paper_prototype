package com.pangochain.backend.document.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class DocumentUploadRequest {

    @NotBlank
    private String caseId;

    @NotBlank
    private String fileName;

    /** Base64-encoded AES-256-GCM ciphertext produced in browser */
    @NotBlank
    private String ciphertextBase64;

    /** Base64-encoded 12-byte GCM IV */
    @NotBlank
    private String ivBase64;

    /** SHA-256 hex digest of the original plaintext (for on-chain anchoring) */
    @NotBlank
    private String documentHashSha256;

    /** ECIES-wrapped document key for the uploading user (owner) */
    @NotBlank
    private String wrappedKeyTokenForOwner;

    /**
     * Optional: the document this upload supersedes. When set, the new document is linked
     * as the next version in the chain (version = previous + 1) instead of starting at v1.
     */
    private String previousVersionId;

    /** Optional document category (accepted/overridden from the AI classification suggestion). */
    private String category;

    /** Optional confidential flag. */
    private Boolean confidential;
}

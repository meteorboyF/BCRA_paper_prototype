package com.pangochain.backend.message;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class SendMessageRequest {
    @NotBlank private String recipientId;
    private String caseId;
    /** AES-256-GCM ciphertext (base64) — produced in browser */
    @NotBlank private String encryptedPayload;
    /** ECIES-wrapped AES key for the recipient */
    @NotBlank private String wrappedKeyToken;
}

package com.pangochain.backend.message;

import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.UUID;

@Data
@Builder
public class MessageDto {
    private UUID id;
    private UUID senderId;
    private String senderEmail;
    private String senderName;
    private UUID recipientId;
    private String recipientEmail;
    private UUID caseId;
    private String encryptedPayload;
    private String wrappedKeyToken;
    private Instant readAt;
    private Instant createdAt;
}

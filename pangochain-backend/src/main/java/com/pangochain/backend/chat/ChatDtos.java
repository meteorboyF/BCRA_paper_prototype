package com.pangochain.backend.chat;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.UUID;

/** Request/response payloads for the chat API. */
public final class ChatDtos {

    private ChatDtos() {}

    public record ConversationDto(
            UUID id,
            String type,
            String title,
            UUID caseId,
            int memberCount,
            String lastMessagePreview,
            Instant lastMessageAt
    ) {}

    public record ChatMessageDto(
            UUID id,
            UUID conversationId,
            UUID senderId,
            String senderName,
            String body,
            Instant createdAt
    ) {}

    public record SendChatRequest(
            @NotBlank @Size(max = 4000) String body
    ) {}
}

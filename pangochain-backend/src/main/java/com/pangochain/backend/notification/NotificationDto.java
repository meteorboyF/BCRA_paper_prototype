package com.pangochain.backend.notification;

import java.time.Instant;
import java.util.UUID;

/** Lightweight notification payload for REST + STOMP push. */
public record NotificationDto(
        UUID id,
        String type,
        String message,
        boolean read,
        Instant createdAt
) {
    public static NotificationDto from(Notification n) {
        return new NotificationDto(n.getId(), n.getType(), n.getMessage(), n.isRead(), n.getCreatedAt());
    }
}

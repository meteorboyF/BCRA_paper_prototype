package com.pangochain.backend.reminder;

import java.time.Instant;
import java.util.UUID;

public record ReminderDto(
        UUID id,
        UUID caseId,
        String caseTitle,
        String senderName,
        String senderEmail,
        String title,
        String body,
        Instant dueAt,
        boolean read,
        String priority,
        Instant createdAt
) {
    static ReminderDto from(Reminder r) {
        return new ReminderDto(
                r.getId(),
                r.getLegalCase() != null ? r.getLegalCase().getId() : null,
                r.getLegalCase() != null ? r.getLegalCase().getTitle() : null,
                r.getSender().getFullName(),
                r.getSender().getEmail(),
                r.getTitle(),
                r.getBody(),
                r.getDueAt(),
                r.isRead(),
                r.getPriority(),
                r.getCreatedAt()
        );
    }
}

package com.pangochain.backend.reminder;

import java.time.Instant;
import java.util.UUID;

public record ReminderCreateRequest(
        UUID recipientId,
        UUID caseId,
        String title,
        String body,
        Instant dueAt,
        String priority
) {}

package com.pangochain.backend.deadline;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.UUID;

public final class DeadlineDtos {

    private DeadlineDtos() {}

    public record DeadlineDto(
            UUID id,
            UUID caseId,
            String title,
            String description,
            String deadlineType,
            Instant deadlineDate,
            UUID linkedDocId,
            boolean completed,
            Instant completedAt,
            Instant createdAt
    ) {}

    public record CreateDeadlineRequest(
            @NotBlank @Size(max = 200) String title,
            @Size(max = 4000) String description,
            String deadlineType,
            @NotNull Long deadlineDateEpochMs,
            UUID linkedDocId
    ) {}

    public record UpdateDeadlineRequest(
            @Size(max = 200) String title,
            @Size(max = 4000) String description,
            String deadlineType,
            Long deadlineDateEpochMs,
            Boolean completed
    ) {}
}

package com.pangochain.backend.milestone;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.UUID;

public final class MilestoneDtos {

    private MilestoneDtos() {}

    public record MilestoneDto(
            UUID id,
            UUID caseId,
            String title,
            String description,
            String status,
            Instant targetDate,
            Instant completedAt,
            int sortOrder,
            Instant createdAt
    ) {}

    public record CreateMilestoneRequest(
            @NotBlank @Size(max = 200) String title,
            @Size(max = 4000) String description,
            String status,
            Long targetDateEpochMs,
            Integer sortOrder
    ) {}

    public record UpdateMilestoneRequest(
            @Size(max = 200) String title,
            @Size(max = 4000) String description,
            String status,
            Long targetDateEpochMs,
            Integer sortOrder
    ) {}
}

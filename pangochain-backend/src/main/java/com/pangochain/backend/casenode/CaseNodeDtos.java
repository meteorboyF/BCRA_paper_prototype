package com.pangochain.backend.casenode;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.UUID;

public final class CaseNodeDtos {

    private CaseNodeDtos() {}

    public record CaseNodeDto(
            UUID id,
            UUID caseId,
            UUID parentId,
            UUID mergeIntoId,
            UUID authorId,
            String authorName,
            String nodeType,
            String title,
            String description,
            UUID linkedDocId,
            Instant nodeDate,
            Instant createdAt,
            boolean merged,
            Instant mergedAt
    ) {}

    public record CreateNodeRequest(
            UUID parentId,
            UUID mergeIntoId,
            String nodeType,
            @NotBlank @Size(max = 300) String title,
            @Size(max = 8000) String description,
            UUID linkedDocId,
            Long nodeDateEpochMs
    ) {}
}

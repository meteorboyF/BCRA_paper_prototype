package com.pangochain.backend.annotation;

import jakarta.validation.constraints.NotBlank;

import java.time.Instant;
import java.util.UUID;

public final class AnnotationDtos {

    private AnnotationDtos() {}

    public record AnnotationDto(
            UUID id, UUID documentId, String versionHash, UUID parentId, Integer page,
            String positionJson, String body, UUID authorId, String authorName,
            String status, UUID resolvedBy, Instant resolvedAt, Instant createdAt) {}

    public record CreateAnnotationRequest(
            @NotBlank String body,
            String versionHash,
            UUID parentId,
            Integer page,
            String positionJson) {}
}

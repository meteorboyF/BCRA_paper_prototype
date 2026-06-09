package com.pangochain.backend.audit;

import java.time.Instant;
import java.util.UUID;

public record AuditLogDto(
        Long id,
        String eventType,
        UUID actorId,
        String actorName,
        String actorEmail,
        String resourceType,
        String resourceId,
        String resourceName,
        String fabricTxId,
        Instant timestamp,
        String metadataJson
) {}

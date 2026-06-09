package com.pangochain.backend.redaction;

import jakarta.validation.constraints.NotNull;

import java.time.Instant;
import java.util.UUID;

public final class RedactionDtos {

    private RedactionDtos() {}

    public record RecordRedactionRequest(
            @NotNull UUID redactedDocId,
            int redactionCount) {}

    public record RedactionDto(
            UUID id, UUID originalDocId, UUID redactedDocId, String originalCid, String redactedCid,
            int redactionCount, UUID redactingUserId, String fabricTxId, Instant createdAt) {}
}

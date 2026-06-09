package com.pangochain.backend.signingworkflow;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class SigningDtos {

    private SigningDtos() {}

    public record SignerDto(
            UUID id, UUID signerId, String signerName, String signerEmail, int signOrder,
            String status, Instant signedAt, String fabricTxId, boolean isYourTurn) {}

    public record WorkflowDto(
            UUID id, UUID documentId, UUID caseId, String title, String documentHashB64,
            UUID initiatedBy, String status, String fabricTxId, Instant createdAt, Instant completedAt,
            List<SignerDto> signers) {}

    public record InitiateRequest(
            @NotNull UUID documentId,
            UUID caseId,
            @NotBlank String title,
            /** Ordered signer user IDs — index is the signing order. */
            @NotEmpty List<UUID> signerIds) {}

    public record SignRequest(
            @NotBlank String signatureB64) {}
}

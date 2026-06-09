package com.pangochain.backend.settlement;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

import java.time.Instant;
import java.util.UUID;

public final class SettlementDtos {

    private SettlementDtos() {}

    public record OfferDto(
            UUID id, UUID caseId, String title, long monetaryValueCents, String currency,
            String nonMonetaryTerms, String analysis, String status,
            Instant respondedAt, UUID respondedBy, UUID createdBy, Instant createdAt) {}

    public record CreateOfferRequest(
            @NotBlank String title,
            long monetaryValueCents,
            String currency,
            String nonMonetaryTerms,
            String analysis) {}

    public record RespondRequest(
            @Pattern(regexp = "ACCEPTED|REJECTED", message = "response must be ACCEPTED or REJECTED")
            String response) {}
}

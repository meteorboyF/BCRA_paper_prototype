package com.pangochain.backend.billing;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class BillingDtos {

    private BillingDtos() {}

    public record TimeEntryDto(
            UUID id, UUID caseId, UUID userId, String userEmail, String description,
            int minutes, int rateCents, long amountCents, UUID linkedDocId,
            Instant entryDate, boolean invoiced) {}

    public record InvoiceDto(
            UUID id, UUID caseId, String invoiceNumber, String status,
            long amountCents, int minutesTotal, Instant issuedAt) {}

    public record CreateTimeEntryRequest(
            @NotBlank String description,
            @Positive int minutes,
            int rateCents,
            UUID linkedDocId,
            Long entryDateEpochMs) {}

    /** Billing summary for a case: totals + the time entries + issued invoices. */
    public record BillingSummary(
            UUID caseId,
            int totalMinutes,
            long totalAmountCents,
            long unbilledAmountCents,
            List<TimeEntryDto> entries,
            List<InvoiceDto> invoices) {}
}

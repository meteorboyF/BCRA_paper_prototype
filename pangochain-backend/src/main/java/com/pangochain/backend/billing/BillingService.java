package com.pangochain.backend.billing;

import com.pangochain.backend.audit.AuditService;
import com.pangochain.backend.billing.BillingDtos.*;
import com.pangochain.backend.user.User;
import com.pangochain.backend.user.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class BillingService {

    private final TimeEntryRepository timeEntryRepository;
    private final InvoiceRepository invoiceRepository;
    private final UserRepository userRepository;
    private final AuditService auditService;

    private static long amount(TimeEntry e) {
        return Math.round(e.getMinutes() / 60.0 * e.getRateCents());
    }

    @Transactional
    public TimeEntryDto addTimeEntry(UUID caseId, CreateTimeEntryRequest req, User author) {
        TimeEntry e = timeEntryRepository.save(TimeEntry.builder()
                .caseId(caseId)
                .userId(author.getId())
                .description(req.description())
                .minutes(req.minutes())
                .rateCents(req.rateCents())
                .linkedDocId(req.linkedDocId())
                .entryDate(req.entryDateEpochMs() != null ? Instant.ofEpochMilli(req.entryDateEpochMs()) : Instant.now())
                .build());
        auditService.log("TIME_ENTRY_ADDED", author.getId(), "CASE", caseId.toString(), null,
                "{\"minutes\":" + req.minutes() + ",\"rateCents\":" + req.rateCents() + "}");
        return toDto(e);
    }

    @Transactional
    public void deleteTimeEntry(UUID caseId, UUID entryId, User actor) {
        TimeEntry e = timeEntryRepository.findById(entryId)
                .orElseThrow(() -> new IllegalArgumentException("Time entry not found"));
        if (!e.getCaseId().equals(caseId)) throw new IllegalArgumentException("Entry not in this case");
        timeEntryRepository.delete(e);
        auditService.log("TIME_ENTRY_DELETED", actor.getId(), "CASE", caseId.toString(), null, null);
    }

    /** Issue an invoice that snapshots all currently-unbilled time entries on the case. */
    @Transactional
    public InvoiceDto generateInvoice(UUID caseId, User actor) {
        List<TimeEntry> unbilled = timeEntryRepository.findByCaseIdAndInvoicedFalse(caseId);
        if (unbilled.isEmpty()) throw new IllegalStateException("No unbilled time entries to invoice");
        long amountCents = unbilled.stream().mapToLong(BillingService::amount).sum();
        int minutes = unbilled.stream().mapToInt(TimeEntry::getMinutes).sum();
        long seq = invoiceRepository.countByCaseId(caseId) + 1;

        Invoice inv = invoiceRepository.save(Invoice.builder()
                .caseId(caseId)
                .invoiceNumber("INV-" + caseId.toString().substring(0, 8).toUpperCase() + "-" + seq)
                .status("SENT")
                .amountCents(amountCents)
                .minutesTotal(minutes)
                .createdBy(actor.getId())
                .build());

        unbilled.forEach(e -> e.setInvoiced(true));
        timeEntryRepository.saveAll(unbilled);

        auditService.log("INVOICE_CREATED", actor.getId(), "CASE", caseId.toString(), null,
                "{\"invoice\":\"" + inv.getInvoiceNumber() + "\",\"amountCents\":" + amountCents + "}");
        return toInvoiceDto(inv);
    }

    @Transactional(readOnly = true)
    public BillingSummary summary(UUID caseId) {
        List<TimeEntry> entries = timeEntryRepository.findByCaseIdOrderByEntryDateDesc(caseId);
        List<Invoice> invoices = invoiceRepository.findByCaseIdOrderByIssuedAtDesc(caseId);
        int totalMinutes = entries.stream().mapToInt(TimeEntry::getMinutes).sum();
        long totalAmount = entries.stream().mapToLong(BillingService::amount).sum();
        long unbilled = entries.stream().filter(e -> !e.isInvoiced()).mapToLong(BillingService::amount).sum();
        return new BillingSummary(caseId, totalMinutes, totalAmount, unbilled,
                entries.stream().map(this::toDto).toList(),
                invoices.stream().map(this::toInvoiceDto).toList());
    }

    private TimeEntryDto toDto(TimeEntry e) {
        String email = e.getUserId() != null
                ? userRepository.findById(e.getUserId()).map(User::getEmail).orElse("unknown") : "system";
        return new TimeEntryDto(e.getId(), e.getCaseId(), e.getUserId(), email, e.getDescription(),
                e.getMinutes(), e.getRateCents(), amount(e), e.getLinkedDocId(), e.getEntryDate(), e.isInvoiced());
    }

    private InvoiceDto toInvoiceDto(Invoice i) {
        return new InvoiceDto(i.getId(), i.getCaseId(), i.getInvoiceNumber(), i.getStatus(),
                i.getAmountCents(), i.getMinutesTotal(), i.getIssuedAt());
    }
}

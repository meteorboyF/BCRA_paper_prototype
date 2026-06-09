package com.pangochain.backend.billing;

import com.pangochain.backend.billing.BillingDtos.BillingSummary;
import com.pangochain.backend.billing.BillingDtos.CreateTimeEntryRequest;
import com.pangochain.backend.billing.BillingDtos.InvoiceDto;
import com.pangochain.backend.billing.BillingDtos.TimeEntryDto;
import com.pangochain.backend.user.User;
import com.pangochain.backend.user.UserRepository;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/** Billing & time tracking for legal staff (clients read via the expense portal). */
@RestController
@RequestMapping("/api/cases/{caseId}/billing")
@RequiredArgsConstructor
public class BillingController {

    private static final String LEGAL_STAFF =
            "hasAnyRole('MANAGING_PARTNER','PARTNER_SENIOR','PARTNER_JUNIOR','ASSOCIATE_SENIOR','ASSOCIATE_JUNIOR','PARALEGAL')";

    private final BillingService billingService;
    private final UserRepository userRepository;

    @PreAuthorize("isAuthenticated()")
    @GetMapping
    public ResponseEntity<BillingSummary> summary(@PathVariable UUID caseId) {
        return ResponseEntity.ok(billingService.summary(caseId));
    }

    @PreAuthorize(LEGAL_STAFF)
    @PostMapping("/time-entries")
    public ResponseEntity<TimeEntryDto> addEntry(
            @PathVariable UUID caseId,
            @Valid @RequestBody CreateTimeEntryRequest req,
            @AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.ok(billingService.addTimeEntry(caseId, req, resolve(principal)));
    }

    @PreAuthorize(LEGAL_STAFF)
    @DeleteMapping("/time-entries/{entryId}")
    public ResponseEntity<Void> deleteEntry(
            @PathVariable UUID caseId,
            @PathVariable UUID entryId,
            @AuthenticationPrincipal UserDetails principal) {
        billingService.deleteTimeEntry(caseId, entryId, resolve(principal));
        return ResponseEntity.noContent().build();
    }

    @PreAuthorize(LEGAL_STAFF)
    @PostMapping("/invoices")
    public ResponseEntity<InvoiceDto> generateInvoice(
            @PathVariable UUID caseId,
            @AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.ok(billingService.generateInvoice(caseId, resolve(principal)));
    }

    private User resolve(UserDetails principal) {
        return userRepository.findByEmail(principal.getUsername())
                .orElseThrow(() -> new IllegalStateException("User not found"));
    }
}

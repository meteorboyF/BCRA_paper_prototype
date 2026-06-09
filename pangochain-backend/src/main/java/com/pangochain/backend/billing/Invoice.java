package com.pangochain.backend.billing;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

/** A snapshot invoice for a case, aggregating time entries at issue time. */
@Entity
@Table(name = "invoices")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Invoice {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "case_id", nullable = false)
    private UUID caseId;

    @Column(name = "invoice_number", nullable = false)
    private String invoiceNumber;

    @Column(nullable = false)
    @Builder.Default
    private String status = "SENT";

    @Column(name = "amount_cents", nullable = false)
    @Builder.Default
    private long amountCents = 0;

    @Column(name = "minutes_total", nullable = false)
    @Builder.Default
    private int minutesTotal = 0;

    @Column(name = "created_by")
    private UUID createdBy;

    @Column(name = "issued_at", nullable = false, updatable = false)
    private Instant issuedAt;

    @PrePersist
    void prePersist() { if (issuedAt == null) issuedAt = Instant.now(); }
}

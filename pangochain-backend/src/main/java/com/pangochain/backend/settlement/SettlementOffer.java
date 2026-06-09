package com.pangochain.backend.settlement;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

/** A structured settlement offer on a case. The client marks one ACCEPTED or REJECTED. */
@Entity
@Table(name = "settlement_offers")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class SettlementOffer {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "case_id", nullable = false)
    private UUID caseId;

    @Column(nullable = false)
    private String title;

    @Column(name = "monetary_value_cents", nullable = false)
    @Builder.Default
    private long monetaryValueCents = 0;

    @Column(nullable = false)
    @Builder.Default
    private String currency = "USD";

    @Column(name = "non_monetary_terms", columnDefinition = "text")
    private String nonMonetaryTerms;

    @Column(columnDefinition = "text")
    private String analysis;

    @Column(nullable = false)
    @Builder.Default
    private String status = "PROPOSED";

    @Column(name = "responded_at")
    private Instant respondedAt;

    @Column(name = "responded_by")
    private UUID respondedBy;

    @Column(name = "created_by")
    private UUID createdBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = Instant.now();
    }
}

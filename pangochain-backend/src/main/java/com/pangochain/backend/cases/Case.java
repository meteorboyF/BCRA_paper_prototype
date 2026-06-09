package com.pangochain.backend.cases;

import com.pangochain.backend.user.Firm;
import com.pangochain.backend.user.User;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "cases")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Case {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "case_type")
    private String caseType;

    /** Structured party names — used by the conflict-of-interest checker. */
    @Column(name = "client_name")
    private String clientName;

    @Column(name = "opposing_party")
    private String opposingParty;

    @Column(name = "related_parties", columnDefinition = "TEXT")
    private String relatedParties;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "firm_id", nullable = false)
    private Firm firm;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by", nullable = false)
    private User createdBy;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private CaseStatus status = CaseStatus.ACTIVE;

    @Column(name = "fabric_tx_id")
    private String fabricTxId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "closed_at")
    private Instant closedAt;

    @PrePersist
    void prePersist() {
        createdAt = Instant.now();
        if (status == null) status = CaseStatus.ACTIVE;
    }
}

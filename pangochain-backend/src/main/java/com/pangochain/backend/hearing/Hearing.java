package com.pangochain.backend.hearing;

import com.pangochain.backend.cases.Case;
import com.pangochain.backend.user.User;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "hearings")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Hearing {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "case_id")
    private Case legalCase;

    @Column(nullable = false, length = 500)
    private String title;

    @Column(name = "hearing_date", nullable = false)
    private Instant hearingDate;

    @Column(length = 500)
    private String location;

    @Column(name = "court_name", length = 500)
    private String courtName;

    @Column(name = "hearing_type", length = 100)
    @Builder.Default
    private String hearingType = "COURT_HEARING";

    @Column(columnDefinition = "TEXT")
    private String notes;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by")
    private User createdBy;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;
}

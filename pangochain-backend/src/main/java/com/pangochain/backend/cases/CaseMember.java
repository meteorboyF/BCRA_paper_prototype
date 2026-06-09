package com.pangochain.backend.cases;

import com.pangochain.backend.user.User;
import jakarta.persistence.*;
import lombok.*;
import lombok.Data;

import java.io.Serializable;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "case_members")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
@IdClass(CaseMember.CaseMemberId.class)
public class CaseMember {

    @Id
    @Column(name = "case_id")
    private UUID caseId;

    @Id
    @Column(name = "user_id")
    private UUID userId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "case_id", insertable = false, updatable = false)
    private Case legalCase;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", insertable = false, updatable = false)
    private User user;

    @Column(name = "role_in_case")
    private String roleInCase;

    @Column(name = "added_by")
    private UUID addedBy;

    @Column(name = "added_at", nullable = false, updatable = false)
    private Instant addedAt;

    @PrePersist
    void prePersist() { addedAt = Instant.now(); }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CaseMemberId implements Serializable {
        private UUID caseId;
        private UUID userId;
    }
}

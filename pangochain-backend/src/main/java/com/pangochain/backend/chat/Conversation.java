package com.pangochain.backend.chat;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

/**
 * A chat channel. CASE channels are auto-provisioned per case (team + client);
 * FIRM channels are one per firm (all lawyers). DIRECT is a 1:1 chat.
 */
@Entity
@Table(name = "conversations")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Conversation {

    public enum Type { CASE, FIRM, DIRECT }

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Type type;

    @Column(name = "firm_id")
    private UUID firmId;

    @Column(name = "case_id")
    private UUID caseId;

    @Column
    private String title;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void prePersist() { if (createdAt == null) createdAt = Instant.now(); }
}

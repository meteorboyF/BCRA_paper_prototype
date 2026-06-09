package com.pangochain.backend.chat;

import jakarta.persistence.*;
import lombok.*;

import java.io.Serializable;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "conversation_members")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
@IdClass(ConversationMember.Id.class)
public class ConversationMember {

    @jakarta.persistence.Id
    @Column(name = "conversation_id")
    private UUID conversationId;

    @jakarta.persistence.Id
    @Column(name = "user_id")
    private UUID userId;

    @Column(name = "last_read_at")
    private Instant lastReadAt;

    @Column(name = "added_at", nullable = false, updatable = false)
    private Instant addedAt;

    @PrePersist
    void prePersist() { if (addedAt == null) addedAt = Instant.now(); }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Id implements Serializable {
        private UUID conversationId;
        private UUID userId;
    }
}

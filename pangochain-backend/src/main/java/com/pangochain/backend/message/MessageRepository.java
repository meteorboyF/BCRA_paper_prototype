package com.pangochain.backend.message;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface MessageRepository extends JpaRepository<Message, UUID> {

    @Query("""
        SELECT m FROM Message m WHERE
        (m.senderId = :userId OR m.recipientId = :userId)
        ORDER BY m.createdAt DESC
        """)
    Page<Message> findConversations(@Param("userId") UUID userId, Pageable pageable);

    List<Message> findByRecipientIdAndReadAtIsNullOrderByCreatedAtDesc(UUID recipientId);

    long countByRecipientIdAndReadAtIsNull(UUID recipientId);

    @Modifying
    @Query("UPDATE Message m SET m.readAt = :now WHERE m.recipientId = :userId AND m.readAt IS NULL")
    int markAllRead(@Param("userId") UUID userId, @Param("now") Instant now);

    @Modifying
    @Query("UPDATE Message m SET m.readAt = :now WHERE m.id = :id AND m.readAt IS NULL")
    int markOneRead(@Param("id") UUID id, @Param("now") Instant now);

    /** Returns one message per conversation partner, ordered by most recent. */
    @Query("""
        SELECT m FROM Message m WHERE
        m.id IN (
            SELECT MAX(m2.id) FROM Message m2
            WHERE m2.senderId = :userId OR m2.recipientId = :userId
            GROUP BY CASE WHEN m2.senderId = :userId THEN m2.recipientId ELSE m2.senderId END
        )
        ORDER BY m.createdAt DESC
        """)
    List<Message> findConversationSummaries(@Param("userId") UUID userId);

    /** All messages between two users, ordered by time. */
    @Query("""
        SELECT m FROM Message m WHERE
        (m.senderId = :a AND m.recipientId = :b)
        OR (m.senderId = :b AND m.recipientId = :a)
        ORDER BY m.createdAt ASC
        """)
    List<Message> findThread(@Param("a") UUID userA, @Param("b") UUID userB);
}

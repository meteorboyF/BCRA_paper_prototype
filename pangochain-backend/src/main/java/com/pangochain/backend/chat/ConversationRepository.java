package com.pangochain.backend.chat;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ConversationRepository extends JpaRepository<Conversation, UUID> {

    Optional<Conversation> findByCaseId(UUID caseId);

    Optional<Conversation> findByTypeAndFirmId(Conversation.Type type, UUID firmId);

    List<Conversation> findByIdIn(List<UUID> ids);

    /** Existing DIRECT (1:1) conversation that has both users as members, if any. */
    @Query("SELECT c FROM Conversation c WHERE c.type = :type "
            + "AND c.id IN (SELECT m1.conversationId FROM ConversationMember m1 WHERE m1.userId = :a) "
            + "AND c.id IN (SELECT m2.conversationId FROM ConversationMember m2 WHERE m2.userId = :b)")
    List<Conversation> findDirectBetween(@Param("type") Conversation.Type type,
                                         @Param("a") UUID a, @Param("b") UUID b);
}

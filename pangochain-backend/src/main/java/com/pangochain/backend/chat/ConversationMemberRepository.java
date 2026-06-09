package com.pangochain.backend.chat;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ConversationMemberRepository
        extends JpaRepository<ConversationMember, ConversationMember.Id> {

    List<ConversationMember> findByUserId(UUID userId);

    List<ConversationMember> findByConversationId(UUID conversationId);

    boolean existsByConversationIdAndUserId(UUID conversationId, UUID userId);
}

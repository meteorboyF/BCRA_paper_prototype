package com.pangochain.backend.ai;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface AiConversationRepository extends JpaRepository<AiConversation, Long> {
    List<AiConversation> findTop20ByLegalCaseIdAndUserIdOrderByCreatedAtAsc(UUID caseId, UUID userId);
}

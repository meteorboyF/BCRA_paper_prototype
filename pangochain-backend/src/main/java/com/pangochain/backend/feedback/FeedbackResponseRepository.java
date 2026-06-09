package com.pangochain.backend.feedback;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface FeedbackResponseRepository extends JpaRepository<FeedbackResponse, UUID> {
    List<FeedbackResponse> findByClientIdOrderByCreatedAtDesc(UUID clientId);
    List<FeedbackResponse> findAllByOrderByCreatedAtDesc();
}

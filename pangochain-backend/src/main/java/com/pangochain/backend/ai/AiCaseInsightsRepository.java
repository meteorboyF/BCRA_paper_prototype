package com.pangochain.backend.ai;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface AiCaseInsightsRepository extends JpaRepository<AiCaseInsights, Long> {
    Optional<AiCaseInsights> findByCaseIdAndInsightType(UUID caseId, String insightType);
}

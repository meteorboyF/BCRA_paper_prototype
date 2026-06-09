package com.pangochain.backend.template;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface TemplateGenerationRepository extends JpaRepository<TemplateGeneration, UUID> {
    List<TemplateGeneration> findByCaseIdOrderByCreatedAtDesc(UUID caseId);
}

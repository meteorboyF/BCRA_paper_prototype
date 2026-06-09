package com.pangochain.backend.signingworkflow;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface SigningWorkflowRepository extends JpaRepository<SigningWorkflow, UUID> {
    List<SigningWorkflow> findByDocumentIdOrderByCreatedAtDesc(UUID documentId);
}

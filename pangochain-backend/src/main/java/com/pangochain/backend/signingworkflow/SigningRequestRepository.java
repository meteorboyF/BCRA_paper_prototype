package com.pangochain.backend.signingworkflow;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface SigningRequestRepository extends JpaRepository<SigningRequest, UUID> {
    List<SigningRequest> findByWorkflowIdOrderBySignOrderAsc(UUID workflowId);
    List<SigningRequest> findBySignerIdAndStatus(UUID signerId, String status);
}

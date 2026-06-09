package com.pangochain.backend.privacy;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface DeletionRequestRepository extends JpaRepository<DeletionRequest, UUID> {
    List<DeletionRequest> findByUserIdOrderByCreatedAtDesc(UUID userId);
    List<DeletionRequest> findAllByOrderByCreatedAtDesc();
}

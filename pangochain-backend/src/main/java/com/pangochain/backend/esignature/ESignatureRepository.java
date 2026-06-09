package com.pangochain.backend.esignature;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ESignatureRepository extends JpaRepository<ESignature, UUID> {
    List<ESignature> findByDocumentId(UUID documentId);
    List<ESignature> findBySignerId(UUID signerId);
    boolean existsByDocumentIdAndSignerId(UUID documentId, UUID signerId);
    long countBySignerId(UUID signerId);
}

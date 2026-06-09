package com.pangochain.backend.annotation;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface DocumentAnnotationRepository extends JpaRepository<DocumentAnnotation, UUID> {
    List<DocumentAnnotation> findByDocumentIdOrderByCreatedAtAsc(UUID documentId);
}

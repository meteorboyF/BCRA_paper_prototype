package com.pangochain.backend.redaction;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface DocumentRedactionRepository extends JpaRepository<DocumentRedaction, UUID> {
    List<DocumentRedaction> findByOriginalDocIdOrderByCreatedAtDesc(UUID originalDocId);
}

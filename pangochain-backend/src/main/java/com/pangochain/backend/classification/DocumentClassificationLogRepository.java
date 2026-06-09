package com.pangochain.backend.classification;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface DocumentClassificationLogRepository extends JpaRepository<DocumentClassificationLog, UUID> {
}

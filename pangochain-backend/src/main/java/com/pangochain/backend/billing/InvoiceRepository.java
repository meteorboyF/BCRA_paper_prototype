package com.pangochain.backend.billing;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface InvoiceRepository extends JpaRepository<Invoice, UUID> {
    List<Invoice> findByCaseIdOrderByIssuedAtDesc(UUID caseId);
    long countByCaseId(UUID caseId);
}

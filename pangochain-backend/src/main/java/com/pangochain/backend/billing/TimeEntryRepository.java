package com.pangochain.backend.billing;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface TimeEntryRepository extends JpaRepository<TimeEntry, UUID> {
    List<TimeEntry> findByCaseIdOrderByEntryDateDesc(UUID caseId);
    List<TimeEntry> findByCaseIdAndInvoicedFalse(UUID caseId);
}

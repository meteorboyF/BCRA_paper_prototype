package com.pangochain.backend.caseevent;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.UUID;

public interface CaseEventRepository extends JpaRepository<CaseEvent, UUID> {
    // LEFT JOIN FETCH actor so the timeline controller can read actor.getFullName()
    // after the session closes (open-in-view=false).
    @Query("SELECT e FROM CaseEvent e LEFT JOIN FETCH e.actor WHERE e.legalCase.id = :caseId ORDER BY e.createdAt DESC")
    List<CaseEvent> findByLegalCaseIdOrderByCreatedAtDesc(UUID caseId);
}

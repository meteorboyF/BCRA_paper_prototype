package com.pangochain.backend.deadline;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.domain.Pageable;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface CaseDeadlineRepository extends JpaRepository<CaseDeadline, UUID> {

    List<CaseDeadline> findByCaseIdOrderByDeadlineDateAsc(UUID caseId);

    @Query("""
           SELECT d FROM CaseDeadline d
           JOIN com.pangochain.backend.cases.Case c ON c.id = d.caseId
           WHERE c.firm.id = :firmId
             AND d.completed = false
             AND d.deadlineDate > :now
           ORDER BY d.deadlineDate ASC
           """)
    List<CaseDeadline> findUpcomingByFirm(UUID firmId, Instant now, Pageable pageable);
}

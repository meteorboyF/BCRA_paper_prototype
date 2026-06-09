package com.pangochain.backend.hearing;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface HearingRepository extends JpaRepository<Hearing, UUID> {

    // JOIN FETCH legalCase + createdBy so HearingDto.from can read them after the
    // session closes (open-in-view=false). Avoids LazyInitializationException + N+1.
    @Query("SELECT h FROM Hearing h JOIN FETCH h.legalCase LEFT JOIN FETCH h.createdBy " +
           "WHERE h.legalCase.id = :caseId ORDER BY h.hearingDate ASC")
    List<Hearing> findByLegalCaseIdOrderByHearingDateAsc(UUID caseId);

    @Query("SELECT h FROM Hearing h JOIN FETCH h.legalCase LEFT JOIN FETCH h.createdBy " +
           "WHERE h.legalCase.firm.id = :firmId AND h.hearingDate > :now ORDER BY h.hearingDate ASC")
    List<Hearing> findUpcomingByFirm(UUID firmId, Instant now);

    @Query("""
           SELECT h FROM Hearing h
           JOIN FETCH h.legalCase c
           LEFT JOIN FETCH h.createdBy
           JOIN CaseMember cm ON cm.caseId = c.id
           WHERE cm.userId = :clientId AND h.hearingDate > :now
           ORDER BY h.hearingDate ASC
           """)
    List<Hearing> findUpcomingForClient(UUID clientId, Instant now);

    Optional<Hearing> findFirstByLegalCaseIdAndHearingDateAfterOrderByHearingDateAsc(UUID caseId, Instant now);
}

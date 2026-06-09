package com.pangochain.backend.cases;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface CaseRepository extends JpaRepository<Case, UUID> {

    Page<Case> findByFirmId(UUID firmId, Pageable pageable);

    Page<Case> findByFirmIdAndStatus(UUID firmId, CaseStatus status, Pageable pageable);

    @Query("""
        SELECT c FROM Case c WHERE c.firm.id = :firmId
        AND c.status = :status
        AND (LOWER(c.title) LIKE LOWER(CONCAT('%', :q, '%'))
             OR LOWER(COALESCE(c.caseType, '')) LIKE LOWER(CONCAT('%', :q, '%'))
             OR LOWER(COALESCE(c.clientName, '')) LIKE LOWER(CONCAT('%', :q, '%')))
        """)
    Page<Case> searchByFirmAndStatus(@Param("firmId") UUID firmId,
                                      @Param("status") CaseStatus status,
                                      @Param("q") String q,
                                      Pageable pageable);

    @Query("""
        SELECT c FROM Case c WHERE c.firm.id = :firmId
        AND (LOWER(c.title) LIKE LOWER(CONCAT('%', :q, '%'))
             OR LOWER(COALESCE(c.caseType, '')) LIKE LOWER(CONCAT('%', :q, '%'))
             OR LOWER(COALESCE(c.clientName, '')) LIKE LOWER(CONCAT('%', :q, '%')))
        """)
    Page<Case> searchByFirm(@Param("firmId") UUID firmId,
                             @Param("q") String q,
                             Pageable pageable);

    default Page<Case> searchByFirm(UUID firmId, CaseStatus status, String q, Pageable pageable) {
        return status != null
                ? searchByFirmAndStatus(firmId, status, q, pageable)
                : searchByFirm(firmId, q, pageable);
    }

    @Query("""
        SELECT c FROM Case c
        JOIN CaseMember cm ON cm.caseId = c.id
        WHERE cm.userId = :userId
        ORDER BY c.createdAt DESC
        """)
    List<Case> findByMember(@Param("userId") UUID userId);

    long countByFirmIdAndStatus(UUID firmId, CaseStatus status);

    /** All cases in a firm — used by the conflict-of-interest scan. */
    List<Case> findByFirmId(UUID firmId);

    @Query(value = "SELECT COUNT(*) FROM case_clients WHERE case_id = :caseId AND client_id = :userId", nativeQuery = true)
    int countClientMembership(@Param("caseId") UUID caseId, @Param("userId") UUID userId);

    @Query(value = "SELECT COUNT(*) FROM case_members WHERE case_id = :caseId AND user_id = :userId", nativeQuery = true)
    int countTeamMembership(@Param("caseId") UUID caseId, @Param("userId") UUID userId);
}

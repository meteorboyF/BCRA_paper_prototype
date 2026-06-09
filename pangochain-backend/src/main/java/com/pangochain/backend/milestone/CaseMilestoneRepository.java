package com.pangochain.backend.milestone;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface CaseMilestoneRepository extends JpaRepository<CaseMilestone, UUID> {

    List<CaseMilestone> findByCaseIdOrderBySortOrderAscCreatedAtAsc(UUID caseId);
}

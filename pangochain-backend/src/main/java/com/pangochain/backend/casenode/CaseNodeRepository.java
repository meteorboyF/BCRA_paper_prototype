package com.pangochain.backend.casenode;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface CaseNodeRepository extends JpaRepository<CaseNode, UUID> {

    List<CaseNode> findByCaseIdOrderByNodeDateAsc(UUID caseId);

    boolean existsByCaseIdAndNodeType(UUID caseId, CaseNode.Type nodeType);

    /** All branch nodes that converge into the given hearing/filing node. */
    List<CaseNode> findByMergeIntoId(UUID mergeIntoId);
}

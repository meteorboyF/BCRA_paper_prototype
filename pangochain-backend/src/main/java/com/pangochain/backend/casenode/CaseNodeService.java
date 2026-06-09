package com.pangochain.backend.casenode;

import com.pangochain.backend.audit.AuditService;
import com.pangochain.backend.casenode.CaseNodeDtos.CaseNodeDto;
import com.pangochain.backend.casenode.CaseNodeDtos.CreateNodeRequest;
import com.pangochain.backend.cases.Case;
import com.pangochain.backend.cases.CaseRepository;
import com.pangochain.backend.user.User;
import com.pangochain.backend.user.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class CaseNodeService {

    private final CaseNodeRepository nodeRepository;
    private final CaseRepository caseRepository;
    private final UserRepository userRepository;
    private final AuditService auditService;

    @Transactional
    public List<CaseNodeDto> list(UUID caseId) {
        Case legalCase = caseRepository.findById(caseId)
                .orElseThrow(() -> new IllegalArgumentException("Case not found"));
        // Auto-provision the ROOT node (the day the case was opened) on first view.
        if (!nodeRepository.existsByCaseIdAndNodeType(caseId, CaseNode.Type.ROOT)) {
            nodeRepository.save(CaseNode.builder()
                    .caseId(caseId)
                    .nodeType(CaseNode.Type.ROOT)
                    .title("Case opened")
                    .description(legalCase.getTitle())
                    .authorId(legalCase.getCreatedBy() != null ? legalCase.getCreatedBy().getId() : null)
                    .nodeDate(legalCase.getCreatedAt() != null ? legalCase.getCreatedAt() : Instant.now())
                    .build());
        }
        return nodeRepository.findByCaseIdOrderByNodeDateAsc(caseId).stream()
                .map(this::toDto).toList();
    }

    @Transactional
    public CaseNodeDto create(UUID caseId, CreateNodeRequest req, User author) {
        caseRepository.findById(caseId)
                .orElseThrow(() -> new IllegalArgumentException("Case not found"));
        CaseNode.Type type = req.nodeType() != null
                ? CaseNode.Type.valueOf(req.nodeType().toUpperCase()) : CaseNode.Type.FINDING;

        CaseNode node = nodeRepository.save(CaseNode.builder()
                .caseId(caseId)
                .parentId(req.parentId())
                .mergeIntoId(req.mergeIntoId())
                .authorId(author.getId())
                .nodeType(type)
                .title(req.title())
                .description(req.description())
                .linkedDocId(req.linkedDocId())
                .nodeDate(req.nodeDateEpochMs() != null ? Instant.ofEpochMilli(req.nodeDateEpochMs()) : Instant.now())
                .build());

        auditService.log("CASE_NODE_ADDED", author.getId(), "CASE", caseId.toString(), null,
                "{\"nodeType\":\"" + type + "\",\"title\":\"" + req.title().replace("\"", "'") + "\"}");
        return toDto(node);
    }

    /**
     * Operational merge: consolidate every branch node that converges into the given
     * hearing/filing node. Contributors are flagged {@code merged} (sealed into the bundle)
     * and the consolidation is recorded on the audit trail. Idempotent — re-running only
     * folds in contributors added since the last consolidation.
     */
    @Transactional
    public List<CaseNodeDto> consolidate(UUID caseId, UUID targetId, User actor) {
        caseRepository.findById(caseId)
                .orElseThrow(() -> new IllegalArgumentException("Case not found"));
        CaseNode target = nodeRepository.findById(targetId)
                .orElseThrow(() -> new IllegalArgumentException("Node not found"));
        if (!target.getCaseId().equals(caseId)) {
            throw new IllegalArgumentException("Node does not belong to this case");
        }
        if (target.getNodeType() != CaseNode.Type.HEARING && target.getNodeType() != CaseNode.Type.FILING) {
            throw new IllegalStateException("Only HEARING or FILING nodes can consolidate a branch");
        }

        List<CaseNode> contributors = nodeRepository.findByMergeIntoId(targetId);
        int newlyMerged = 0;
        Instant now = Instant.now();
        for (CaseNode c : contributors) {
            if (!c.isMerged()) {
                c.setMerged(true);
                c.setMergedAt(now);
                nodeRepository.save(c);
                newlyMerged++;
            }
        }

        auditService.log("CASE_NODES_MERGED", actor.getId(), "CASE", caseId.toString(), null,
                "{\"target\":\"" + target.getTitle().replace("\"", "'")
                        + "\",\"contributors\":" + contributors.size()
                        + ",\"newlyMerged\":" + newlyMerged + "}");
        log.info("Consolidated {} contributor(s) into {} ({}) — {} newly merged",
                contributors.size(), target.getTitle(), targetId, newlyMerged);

        return nodeRepository.findByCaseIdOrderByNodeDateAsc(caseId).stream()
                .map(this::toDto).toList();
    }

    private CaseNodeDto toDto(CaseNode n) {
        String authorName = n.getAuthorId() != null
                ? userRepository.findById(n.getAuthorId()).map(User::getFullName).orElse("Unknown")
                : "System";
        return new CaseNodeDto(
                n.getId(), n.getCaseId(), n.getParentId(), n.getMergeIntoId(),
                n.getAuthorId(), authorName, n.getNodeType().name(),
                n.getTitle(), n.getDescription(), n.getLinkedDocId(),
                n.getNodeDate(), n.getCreatedAt(), n.isMerged(), n.getMergedAt());
    }
}

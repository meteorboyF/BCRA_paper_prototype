package com.pangochain.backend.cases;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.pangochain.backend.audit.AuditService;
import com.pangochain.backend.blockchain.FabricException;
import com.pangochain.backend.blockchain.FabricGatewayService;
import org.springframework.beans.factory.annotation.Autowired;
import com.pangochain.backend.cases.dto.CaseCreateRequest;
import com.pangochain.backend.cases.dto.CaseDto;
import com.pangochain.backend.document.DocumentRepository;
import com.pangochain.backend.user.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class CaseService {

    private final CaseRepository caseRepository;
    private final DocumentRepository documentRepository;
    @Autowired(required = false)
    private FabricGatewayService fabricGatewayService;
    private final AuditService auditService;
    private final ObjectMapper objectMapper;

    @Transactional
    public CaseDto create(CaseCreateRequest req, User creator) {
        Case legalCase = Case.builder()
                .id(UUID.randomUUID())
                .title(req.getTitle())
                .description(req.getDescription())
                .caseType(req.getCaseType())
                .clientName(req.getClientName())
                .opposingParty(req.getOpposingParty())
                .relatedParties(req.getRelatedParties())
                .firm(creator.getFirm())
                .createdBy(creator)
                .status(CaseStatus.ACTIVE)
                .build();

        String fabricTxId = null;
        try {
            if (fabricGatewayService != null) {
                fabricTxId = fabricGatewayService.registerCase(
                        legalCase.getId().toString(),
                        creator.getFirm().getId().toString(),
                        req.getTitle(),
                        creator.getId().toString(),
                        Instant.now().toString());
                legalCase.setFabricTxId(fabricTxId);
            }
        } catch (FabricException e) {
            log.warn("Fabric case registration skipped: {}", e.getMessage());
        }

        legalCase = caseRepository.save(legalCase);

        auditService.log("CASE_REGISTERED", creator.getId(), "CASE",
                legalCase.getId().toString(), fabricTxId,
                toJson(Map.of("title", req.getTitle(), "caseType", req.getCaseType() != null ? req.getCaseType() : "")));

        return toDto(legalCase, 0L);
    }

    @Transactional(readOnly = true)
    public Page<CaseDto> listByFirm(UUID firmId, CaseStatus status, String q, int page, int size) {
        PageRequest pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<Case> cases = (q != null && !q.isBlank())
                ? caseRepository.searchByFirm(firmId, status, q, pageable)
                : (status != null ? caseRepository.findByFirmIdAndStatus(firmId, status, pageable)
                        : caseRepository.findByFirmId(firmId, pageable));
        return cases.map(c -> toDto(c, -1L));
    }

    @Transactional(readOnly = true)
    public CaseDto getById(UUID caseId) {
        Case c = caseRepository.findById(caseId)
                .orElseThrow(() -> new IllegalArgumentException("Case not found: " + caseId));
        long docCount = documentRepository.countByLegalCaseIdAndStatus(caseId, com.pangochain.backend.document.DocStatus.ACTIVE);
        return toDto(c, docCount);
    }

    @Transactional
    public CaseDto close(UUID caseId, User closer) {
        Case c = caseRepository.findById(caseId)
                .orElseThrow(() -> new IllegalArgumentException("Case not found: " + caseId));
        c.setStatus(CaseStatus.CLOSED);
        c.setClosedAt(Instant.now());
        c = caseRepository.save(c);
        auditService.log("CASE_CLOSED", closer.getId(), "CASE", caseId.toString(), null, null);
        return toDto(c, documentRepository.countByLegalCaseIdAndStatus(caseId, com.pangochain.backend.document.DocStatus.ACTIVE));
    }

    @Transactional
    public CaseDto updateStatus(UUID caseId, CaseStatus status, User updater) {
        Case c = caseRepository.findById(caseId)
                .orElseThrow(() -> new IllegalArgumentException("Case not found: " + caseId));
        CaseStatus previous = c.getStatus();
        c.setStatus(status);
        c.setClosedAt(status == CaseStatus.CLOSED ? Instant.now() : null);
        c = caseRepository.save(c);
        auditService.log("CASE_STATUS_UPDATED", updater.getId(), "CASE", caseId.toString(), c.getFabricTxId(),
                toJson(Map.of("from", previous.name(), "to", status.name())));
        return toDto(c, documentRepository.countByLegalCaseIdAndStatus(caseId, com.pangochain.backend.document.DocStatus.ACTIVE));
    }

    private CaseDto toDto(Case c, long docCount) {
        return CaseDto.builder()
                .id(c.getId())
                .title(c.getTitle())
                .description(c.getDescription())
                .caseType(c.getCaseType())
                .clientName(c.getClientName())
                .opposingParty(c.getOpposingParty())
                .relatedParties(c.getRelatedParties())
                .firmId(c.getFirm() != null ? c.getFirm().getId() : null)
                .firmName(c.getFirm() != null ? c.getFirm().getName() : null)
                .createdByEmail(c.getCreatedBy().getEmail())
                .status(c.getStatus().name())
                .fabricTxId(c.getFabricTxId())
                .documentCount(docCount)
                .createdAt(c.getCreatedAt())
                .closedAt(c.getClosedAt())
                .build();
    }

    public String getTimeline(UUID caseId) {
        caseRepository.findById(caseId)
                .orElseThrow(() -> new IllegalArgumentException("Case not found: " + caseId));
        if (fabricGatewayService == null) return "[]";
        try {
            String caseKey = "CASE:" + caseId;
            return fabricGatewayService.evaluateTransaction("GetDocumentHistory", caseKey);
        } catch (FabricException e) {
            log.warn("Could not fetch Fabric timeline for case={}: {}", caseId, e.getMessage());
            return "[]";
        }
    }

    private String toJson(Object obj) {
        try { return objectMapper.writeValueAsString(obj); } catch (Exception e) { return "{}"; }
    }
}

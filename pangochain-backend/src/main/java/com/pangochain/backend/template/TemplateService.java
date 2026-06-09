package com.pangochain.backend.template;

import com.pangochain.backend.audit.AuditService;
import com.pangochain.backend.template.TemplateDtos.*;
import com.pangochain.backend.user.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class TemplateService {

    private final DocumentTemplateRepository templateRepository;
    private final TemplateGenerationRepository generationRepository;
    private final AuditService auditService;

    @Transactional(readOnly = true)
    public List<TemplateDto> listTemplates() {
        return templateRepository.findByActiveTrueOrderByName().stream().map(this::toDto).toList();
    }

    @Transactional(readOnly = true)
    public TemplateDto getTemplate(UUID id) {
        return templateRepository.findById(id).map(this::toDto)
                .orElseThrow(() -> new IllegalArgumentException("Template not found"));
    }

    /**
     * Record that a template version was used to generate a document on a case. The actual document
     * is encrypted + uploaded client-side through the normal pipeline; this anchors the exact
     * template + parameter hash so the instrument is reproducible and audit-verifiable.
     */
    @Transactional
    public GenerationDto recordGeneration(RecordGenerationRequest req, User actor) {
        DocumentTemplate template = templateRepository.findById(req.templateId())
                .orElseThrow(() -> new IllegalArgumentException("Template not found"));

        TemplateGeneration gen = generationRepository.save(TemplateGeneration.builder()
                .templateId(template.getId())
                .templateKey(template.getTemplateKey())
                .templateVersion(template.getVersion())
                .caseId(req.caseId())
                .documentId(req.documentId())
                .paramHash(req.paramHash())
                .generatedBy(actor.getId())
                .build());

        auditService.log("TEMPLATE_GENERATED", actor.getId(), "CASE", req.caseId().toString(), null,
                String.format("{\"template\":\"%s\",\"version\":%d,\"paramHash\":\"%s\",\"documentId\":%s}",
                        template.getTemplateKey(), template.getVersion(), req.paramHash(),
                        req.documentId() != null ? "\"" + req.documentId() + "\"" : "null"));

        return toGenerationDto(gen);
    }

    @Transactional(readOnly = true)
    public List<GenerationDto> generationsForCase(UUID caseId) {
        return generationRepository.findByCaseIdOrderByCreatedAtDesc(caseId).stream()
                .map(this::toGenerationDto).toList();
    }

    private TemplateDto toDto(DocumentTemplate t) {
        return new TemplateDto(t.getId(), t.getTemplateKey(), t.getName(), t.getCategory(),
                t.getVersion(), t.getDescription(), t.getFieldsJson(), t.getBody());
    }

    private GenerationDto toGenerationDto(TemplateGeneration g) {
        return new GenerationDto(g.getId(), g.getTemplateId(), g.getTemplateKey(), g.getTemplateVersion(),
                g.getCaseId(), g.getDocumentId(), g.getParamHash(), g.getGeneratedBy(),
                g.getFabricTxId(), g.getCreatedAt());
    }
}

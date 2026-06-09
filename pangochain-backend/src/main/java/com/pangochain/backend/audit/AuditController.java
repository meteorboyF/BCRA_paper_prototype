package com.pangochain.backend.audit;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.pangochain.backend.document.DocumentRepository;
import com.pangochain.backend.user.User;
import com.pangochain.backend.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/audit")
@RequiredArgsConstructor
public class AuditController {

    private final AuditLogRepository auditLogRepository;
    private final UserRepository userRepository;
    private final DocumentRepository documentRepository;
    private final ObjectMapper objectMapper;

    @PreAuthorize("hasAnyRole('MANAGING_PARTNER','IT_ADMIN','REGULATOR')")
    @GetMapping
    public ResponseEntity<Page<AuditLogDto>> list(
            @RequestParam(required = false) String eventType,
            @RequestParam(required = false) String resourceId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        PageRequest pageable = PageRequest.of(page, size, Sort.by("timestamp").descending());
        Page<AuditLog> logs;
        if (eventType != null && !eventType.isBlank()) {
            logs = auditLogRepository.findByEventType(eventType, pageable);
        } else if (resourceId != null && !resourceId.isBlank()) {
            logs = auditLogRepository.findByResourceId(resourceId, pageable);
        } else {
            logs = auditLogRepository.findAll(pageable);
        }
        return ResponseEntity.ok(logs.map(this::toDto));
    }

    /**
     * GET /api/audit/regulator?caseId={id}&resourceId={id}&eventType={type}
     * Cross-firm audit access for REGULATOR role only.
     * Regulators can query audit trails for any case or resource across all firms.
     * Regulators CANNOT access wrapped key tokens or document ciphertext — audit metadata only.
     */
    @GetMapping("/regulator")
    @PreAuthorize("hasRole('REGULATOR')")
    public ResponseEntity<Page<AuditLogDto>> regulatorAudit(
            @RequestParam(required = false) String caseId,
            @RequestParam(required = false) String resourceId,
            @RequestParam(required = false) String eventType,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "100") int size) {

        PageRequest pageable = PageRequest.of(page, size, Sort.by("timestamp").descending());

        Page<AuditLog> logs;
        if (resourceId != null && eventType != null) {
            logs = auditLogRepository.findByResourceIdAndEventType(resourceId, eventType, pageable);
        } else if (resourceId != null) {
            logs = auditLogRepository.findByResourceId(resourceId, pageable);
        } else if (eventType != null) {
            logs = auditLogRepository.findByEventType(eventType, pageable);
        } else {
            logs = auditLogRepository.findAll(pageable);
        }
        return ResponseEntity.ok(logs.map(this::toDto));
    }

    private AuditLogDto toDto(AuditLog log) {
        User actor = log.getActorId() != null
                ? userRepository.findById(log.getActorId()).orElse(null)
                : null;

        String resourceName = resolveResourceName(log);
        return new AuditLogDto(
                log.getId(),
                log.getEventType(),
                log.getActorId(),
                actor != null ? actor.getFullName() : null,
                actor != null ? actor.getEmail() : null,
                log.getResourceType(),
                log.getResourceId(),
                resourceName,
                log.getFabricTxId(),
                log.getTimestamp(),
                log.getMetadataJson()
        );
    }

    private String resolveResourceName(AuditLog log) {
        if ("DOCUMENT".equalsIgnoreCase(log.getResourceType()) && log.getResourceId() != null) {
            try {
                return documentRepository.findById(UUID.fromString(log.getResourceId()))
                        .map(d -> d.getFileName())
                        .orElseGet(() -> metadataField(log.getMetadataJson(), "fileName"));
            } catch (IllegalArgumentException ignored) {
                return metadataField(log.getMetadataJson(), "fileName");
            }
        }
        return metadataField(log.getMetadataJson(), "fileName");
    }

    private String metadataField(String metadataJson, String field) {
        if (metadataJson == null || metadataJson.isBlank()) return null;
        try {
            JsonNode node = objectMapper.readTree(metadataJson);
            JsonNode value = node.get(field);
            return value != null && !value.isNull() ? value.asText() : null;
        } catch (Exception ignored) {
            return null;
        }
    }
}

package com.pangochain.backend.annotation;

import com.pangochain.backend.annotation.AnnotationDtos.*;
import com.pangochain.backend.audit.AuditService;
import com.pangochain.backend.document.DocumentService;
import com.pangochain.backend.user.User;
import com.pangochain.backend.user.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Collaborative document annotations: persisted in PostgreSQL and fanned out live over STOMP. */
@Service
@RequiredArgsConstructor
@Slf4j
public class AnnotationService {

    private final DocumentAnnotationRepository repository;
    private final DocumentService documentService;
    private final UserRepository userRepository;
    private final AuditService auditService;

    /** Optional so the app still works REST-only when the WebSocket broker isn't active. */
    @Autowired(required = false)
    private SimpMessagingTemplate messagingTemplate;

    private void requireAccess(UUID documentId, User user) {
        if (!documentService.hasDocumentAccess(documentId, user.getId()))
            throw new AccessDeniedException("You do not have access to this document");
    }

    @Transactional(readOnly = true)
    public List<AnnotationDto> list(UUID documentId, User user) {
        requireAccess(documentId, user);
        return repository.findByDocumentIdOrderByCreatedAtAsc(documentId).stream().map(this::toDto).toList();
    }

    @Transactional
    public AnnotationDto add(UUID documentId, CreateAnnotationRequest req, User author) {
        requireAccess(documentId, author);
        DocumentAnnotation a = repository.save(DocumentAnnotation.builder()
                .documentId(documentId)
                .versionHash(req.versionHash())
                .parentId(req.parentId())
                .page(req.page())
                .positionJson(req.positionJson())
                .body(req.body())
                .authorId(author.getId())
                .build());
        auditService.log("ANNOTATION_ADDED", author.getId(), "DOCUMENT", documentId.toString(), null,
                req.parentId() != null ? "{\"reply\":true}" : null);
        AnnotationDto dto = toDto(a);
        broadcast(documentId, dto);
        return dto;
    }

    @Transactional
    public AnnotationDto resolve(UUID annotationId, User actor) {
        DocumentAnnotation a = repository.findById(annotationId)
                .orElseThrow(() -> new IllegalArgumentException("Annotation not found"));
        requireAccess(a.getDocumentId(), actor);
        a.setStatus("RESOLVED");
        a.setResolvedBy(actor.getId());
        a.setResolvedAt(Instant.now());
        repository.save(a);
        auditService.log("ANNOTATION_RESOLVED", actor.getId(), "DOCUMENT", a.getDocumentId().toString(), null, null);
        AnnotationDto dto = toDto(a);
        broadcast(a.getDocumentId(), dto);
        return dto;
    }

    private void broadcast(UUID documentId, AnnotationDto dto) {
        if (messagingTemplate != null) {
            try {
                messagingTemplate.convertAndSend("/topic/documents/" + documentId + "/annotations", dto);
            } catch (Exception e) {
                log.warn("Annotation broadcast failed for doc {}: {}", documentId, e.getMessage());
            }
        }
    }

    private AnnotationDto toDto(DocumentAnnotation a) {
        String authorName = a.getAuthorId() != null
                ? userRepository.findById(a.getAuthorId()).map(User::getFullName).orElse("Unknown") : "System";
        return new AnnotationDto(a.getId(), a.getDocumentId(), a.getVersionHash(), a.getParentId(), a.getPage(),
                a.getPositionJson(), a.getBody(), a.getAuthorId(), authorName, a.getStatus(),
                a.getResolvedBy(), a.getResolvedAt(), a.getCreatedAt());
    }
}

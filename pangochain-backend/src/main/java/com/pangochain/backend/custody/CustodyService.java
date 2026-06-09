package com.pangochain.backend.custody;

import com.pangochain.backend.audit.AuditLog;
import com.pangochain.backend.audit.AuditLogRepository;
import com.pangochain.backend.document.Document;
import com.pangochain.backend.document.DocumentRepository;
import com.pangochain.backend.user.User;
import com.pangochain.backend.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

/**
 * Builds a document's chain-of-custody graph by merging the dual-store audit trail
 * (every upload, view, share, signature, version event for the document) into an ordered,
 * court-readable timeline. Each node carries the Fabric tx id where one exists.
 */
@Service
@RequiredArgsConstructor
public class CustodyService {

    public record CustodyEvent(
            String category, String eventType, String actorEmail,
            Instant timestamp, String fabricTxId, String detail) {}

    public record CustodyGraph(UUID docId, String fileName, List<CustodyEvent> events) {}

    private final AuditLogRepository auditLogRepository;
    private final DocumentRepository documentRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public CustodyGraph forDocument(UUID docId) {
        Document doc = documentRepository.findById(docId)
                .orElseThrow(() -> new IllegalArgumentException("Document not found"));

        List<CustodyEvent> events = auditLogRepository
                .findByResourceId(docId.toString(), PageRequest.of(0, 500))
                .getContent().stream()
                .map(this::toEvent)
                .sorted(Comparator.comparing(CustodyEvent::timestamp))
                .toList();

        return new CustodyGraph(docId, doc.getFileName(), events);
    }

    private CustodyEvent toEvent(AuditLog l) {
        String actor = l.getActorId() != null
                ? userRepository.findById(l.getActorId()).map(User::getEmail).orElse("unknown")
                : "system";
        return new CustodyEvent(category(l.getEventType()), l.getEventType(), actor,
                l.getTimestamp(), l.getFabricTxId(), l.getMetadataJson());
    }

    /** Group raw event types into the custody categories the visualiser colours by. */
    private static String category(String type) {
        if (type == null) return "OTHER";
        return switch (type) {
            case "DOC_REGISTERED" -> "UPLOAD";
            case "DOC_VIEWED" -> "ACCESS";
            case "ACCESS_GRANTED", "ACCESS_REVOKED" -> "SHARE";
            case "DOCUMENT_SIGNED" -> "SIGN";
            case "DOC_VERSION_RESTORED" -> "VERSION";
            case "KEY_ROTATION_REQUIRED", "KEY_ROTATION_COMPLETED" -> "ROTATION";
            default -> "OTHER";
        };
    }
}

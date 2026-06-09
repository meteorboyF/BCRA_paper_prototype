package com.pangochain.backend.redaction;

import com.pangochain.backend.audit.AuditService;
import com.pangochain.backend.document.Document;
import com.pangochain.backend.document.DocumentRepository;
import com.pangochain.backend.redaction.RedactionDtos.*;
import com.pangochain.backend.user.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/** Records the relationship between an original document and a browser-produced redacted copy. */
@Service
@RequiredArgsConstructor
@Slf4j
public class RedactionService {

    private final DocumentRedactionRepository redactionRepository;
    private final DocumentRepository documentRepository;
    private final AuditService auditService;

    @Transactional
    public RedactionDto record(UUID originalDocId, RecordRedactionRequest req, User actor) {
        Document original = documentRepository.findById(originalDocId)
                .orElseThrow(() -> new IllegalArgumentException("Original document not found"));
        Document redacted = documentRepository.findById(req.redactedDocId())
                .orElseThrow(() -> new IllegalArgumentException("Redacted document not found"));

        DocumentRedaction r = redactionRepository.save(DocumentRedaction.builder()
                .originalDocId(original.getId())
                .redactedDocId(redacted.getId())
                .originalCid(original.getIpfsCid())
                .redactedCid(redacted.getIpfsCid())
                .redactionCount(req.redactionCount())
                .redactingUserId(actor.getId())
                .build());

        // Anchor the parent->child CID pair (RecordRedaction equivalent via the generic ledger event).
        auditService.log("RECORD_REDACTION", actor.getId(), "DOCUMENT", original.getId().toString(), null,
                String.format("{\"originalCid\":\"%s\",\"redactedCid\":\"%s\",\"redactions\":%d}",
                        original.getIpfsCid(), redacted.getIpfsCid(), req.redactionCount()));

        return toDto(r);
    }

    @Transactional(readOnly = true)
    public List<RedactionDto> forDocument(UUID originalDocId) {
        return redactionRepository.findByOriginalDocIdOrderByCreatedAtDesc(originalDocId).stream()
                .map(this::toDto).toList();
    }

    private RedactionDto toDto(DocumentRedaction r) {
        return new RedactionDto(r.getId(), r.getOriginalDocId(), r.getRedactedDocId(), r.getOriginalCid(),
                r.getRedactedCid(), r.getRedactionCount(), r.getRedactingUserId(), r.getFabricTxId(), r.getCreatedAt());
    }
}

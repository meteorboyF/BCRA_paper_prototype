package com.pangochain.backend.blockchain;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.pangochain.backend.audit.AuditService;
import com.pangochain.backend.document.DocumentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

import java.util.UUID;

/**
 * Listens to chaincode events published by FabricGatewayService and
 * dispatches them to the appropriate application handlers.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class FabricEventHandler {

    private final AuditService auditService;
    private final ObjectMapper objectMapper;
    private final DocumentRepository documentRepository;

    @Async
    @EventListener
    public void onChaincodeEvent(FabricChaincodEvent event) {
        try {
            switch (event.getEventName()) {
                case "KEY_ROTATION_REQUIRED" -> handleKeyRotation(event);
                case "ACCESS_REVOKED"        -> handleAccessRevoked(event);
                case "DOC_REGISTERED"        -> handleDocRegistered(event);
                case "AUDIT_EVENT"           -> log.debug("Fabric audit event: {}", event.getPayloadJson());
                default                      -> log.trace("Unhandled chaincode event: {}", event.getEventName());
            }
        } catch (Exception e) {
            log.error("Error handling chaincode event '{}': {}", event.getEventName(), e.getMessage(), e);
        }
    }

    private void handleKeyRotation(FabricChaincodEvent event) throws Exception {
        JsonNode payload = objectMapper.readTree(event.getPayloadJson());
        String docId          = payload.path("docId").asText();
        String revokedSubject = payload.path("revokedSubject").asText();
        String revokerOrg     = payload.path("revokerOrg").asText();

        log.info("KEY_ROTATION_REQUIRED for doc={} revokedSubject={}", docId, revokedSubject);

        // Mark document as requiring key rotation so the owner's browser is prompted.
        // Note: actual re-encryption of the AES-256-GCM ciphertext must be performed by the
        // document owner's browser (the server never holds the plaintext document key).
        try {
            documentRepository.findById(UUID.fromString(docId)).ifPresent(doc -> {
                doc.setKeyRotationPending(true);
                documentRepository.save(doc);
                log.info("KEY_ROTATION_REQUIRED: flagged doc={} in DB", docId);
            });
        } catch (Exception e) {
            log.error("Failed to set key_rotation_pending for doc={}: {}", docId, e.getMessage());
        }

        auditService.log("KEY_ROTATION_TRIGGERED", "SYSTEM", revokerOrg,
                "DOCUMENT", docId, event.getTransactionId(),
                String.format("{\"revokedSubject\":\"%s\"}", revokedSubject), null);
    }

    private void handleAccessRevoked(FabricChaincodEvent event) throws Exception {
        JsonNode payload = objectMapper.readTree(event.getPayloadJson());
        String docId   = payload.path("docId").asText();
        String subject = payload.path("subject").asText();

        log.info("ACCESS_REVOKED for doc={} subject={}", docId, subject);
        auditService.log("ACCESS_REVOKED", "SYSTEM", "SYSTEM",
                "DOCUMENT", docId, event.getTransactionId(),
                String.format("{\"subject\":\"%s\"}", subject), null);
    }

    private void handleDocRegistered(FabricChaincodEvent event) throws Exception {
        JsonNode payload = objectMapper.readTree(event.getPayloadJson());
        log.info("DOC_REGISTERED on chain: docId={} caseId={}",
                payload.path("docId").asText(), payload.path("caseId").asText());
    }
}

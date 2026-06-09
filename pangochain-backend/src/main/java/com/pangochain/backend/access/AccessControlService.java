package com.pangochain.backend.access;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.pangochain.backend.audit.AuditService;
import com.pangochain.backend.blockchain.FabricException;
import com.pangochain.backend.blockchain.FabricGatewayService;
import org.springframework.beans.factory.annotation.Autowired;
import com.pangochain.backend.document.Document;
import com.pangochain.backend.document.DocumentAccess;
import com.pangochain.backend.document.DocumentAccessRepository;
import com.pangochain.backend.document.DocumentRepository;
import com.pangochain.backend.notification.NotificationService;
import com.pangochain.backend.user.User;
import com.pangochain.backend.user.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class AccessControlService {

    private final DocumentAccessRepository accessRepository;
    private final DocumentRepository documentRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;
    @Autowired(required = false)
    private FabricGatewayService fabricGatewayService;
    private final AuditService auditService;
    private final ObjectMapper objectMapper;

    /**
     * Phase 4: Grant access — ECIES-wrapped key arrives from the browser.
     * 1. Verify granter has owner/write capability
     * 2. Call GrantAccess chaincode (records on ledger)
     * 3. Persist DocumentAccess row
     * 4. Notify grantee
     */
    @Transactional
    public AccessDto grant(GrantAccessRequest req, User granter) {
        UUID docId = UUID.fromString(req.getDocId());
        UUID granteeId = UUID.fromString(req.getGranteeId());

        // Verify granter has owner capability
        DocumentAccess granterAccess = accessRepository.findActiveEntry(docId, granter.getId())
                .orElseThrow(() -> new IllegalStateException("You do not have access to this document"));
        if (granterAccess.getCapability() == DocumentAccess.Capability.read) {
            throw new IllegalStateException("Read-only users cannot grant access");
        }

        // Capability-capped delegation: a granter may never grant a capability higher than
        // their own (owner > write > read). This bounds the per-case delegation chain — e.g.
        // a 'write' delegate can pass on read/write but never owner.
        DocumentAccess.Capability requested = DocumentAccess.Capability.valueOf(req.getCapability().toLowerCase());
        if (rank(requested) > rank(granterAccess.getCapability())) {
            throw new IllegalStateException(
                    "Cannot grant '" + requested + "' — it exceeds your own '" + granterAccess.getCapability() + "' capability");
        }

        User grantee = userRepository.findById(granteeId)
                .orElseThrow(() -> new IllegalArgumentException("Grantee not found: " + req.getGranteeId()));

        // Determine expiry
        Instant expiresAt = req.getExpiresAtEpochMs() != null
                ? Instant.ofEpochMilli(req.getExpiresAtEpochMs()) : null;

        // Fabric GrantAccess
        String fabricTxId = null;
        try {
            if (fabricGatewayService == null) throw new FabricException("Fabric not enabled");
            String expiryStr = expiresAt != null ? expiresAt.toString() : "";
            fabricTxId = fabricGatewayService.grantAccess(
                    docId.toString(),
                    grantee.getId().toString(),
                    grantee.getFirm() != null ? grantee.getFirm().getMspId() : "FirmAMSP",
                    req.getCapability().toLowerCase(),
                    expiryStr,
                    req.getWrappedKeyToken(),
                    granter.getId().toString()
            );
        } catch (FabricException e) {
            log.warn("Fabric GrantAccess failed: {}", e.getMessage());
        }

        DocumentAccess.Capability cap = DocumentAccess.Capability.valueOf(req.getCapability().toLowerCase());
        DocumentAccess access = accessRepository.findActiveEntry(docId, granteeId)
                .orElseGet(() -> DocumentAccess.builder()
                        .docId(docId)
                        .userId(granteeId)
                        .build());
        access.setCapability(cap);
        access.setGrantedBy(granter.getId());
        access.setExpiresAt(expiresAt);
        access.setWrappedKeyToken(req.getWrappedKeyToken());
        access.setTokenObsolete(false);
        access = accessRepository.save(access);

        // Notify grantee (real-time push + persisted)
        notificationService.push(granteeId, "ACCESS_GRANTED",
                String.format("%s granted you %s access to a document",
                        granter.getFullName(), req.getCapability()));

        auditService.log("ACCESS_GRANTED", granter.getId(), "DOCUMENT",
                docId.toString(), fabricTxId,
                toJson(Map.of("grantee", grantee.getEmail(), "capability", req.getCapability())));

        return toDto(access, grantee.getEmail(), grantee.getFullName(), granter.getEmail());
    }

    /**
     * Phase 4: Revoke access. Also triggers key rotation notification.
     */
    @Transactional
    public void revoke(String docIdStr, String targetUserIdStr, User revoker) {
        UUID docId = UUID.fromString(docIdStr);
        UUID targetUserId = UUID.fromString(targetUserIdStr);

        DocumentAccess access = accessRepository.findActiveEntry(docId, targetUserId)
                .orElseThrow(() -> new IllegalArgumentException("No active access entry found"));

        access.setRevokedAt(Instant.now());
        access.setRevokedBy(revoker.getId());
        accessRepository.save(access);

        String fabricTxId = null;
        try {
            if (fabricGatewayService == null) throw new FabricException("Fabric not enabled");
            fabricTxId = fabricGatewayService.revokeAccess(docIdStr, targetUserIdStr, revoker.getId().toString());
        } catch (FabricException e) {
            log.warn("Fabric RevokeAccess failed: {}", e.getMessage());
        }

        // Mark all non-owner tokens on this document as OBSOLETE — they may have been
        // exposed to the revoked user and must not be trusted after key rotation.
        List<DocumentAccess> nonOwnerTokens = accessRepository.findActiveNonOwnerByDoc(docId, DocumentAccess.Capability.owner);
        for (DocumentAccess token : nonOwnerTokens) {
            token.setTokenObsolete(true);
            accessRepository.save(token);
        }

        // Flag the document so the owner's browser is prompted to rotate keys.
        Document doc = documentRepository.findById(docId).orElse(null);
        if (doc != null) {
            doc.setKeyRotationPending(true);
            documentRepository.save(doc);
        }

        // Notify revoked user
        notificationService.push(targetUserId, "ACCESS_REVOKED",
                "Your access to a document has been revoked by " + revoker.getFullName());

        // Notify document owner that key rotation is required
        if (doc != null) {
            notificationService.push(doc.getOwner().getId(), "KEY_ROTATION_REQUIRED",
                    "Key rotation required for document '" + doc.getFileName()
                            + "' — a user's access was revoked. Please re-encrypt and redistribute the document key.");
        }

        auditService.log("ACCESS_REVOKED", revoker.getId(), "DOCUMENT",
                docIdStr, fabricTxId,
                toJson(Map.of("targetUser", targetUserIdStr, "tokensMarkedObsolete", nonOwnerTokens.size())));

        log.info("KEY_ROTATION_REQUIRED: doc={} revokedUser={} obsoleteTokens={}", docIdStr, targetUserIdStr, nonOwnerTokens.size());
    }

    public List<AccessDto> listForDoc(UUID docId, User requester) {
        return accessRepository.findActiveByDoc(docId)
                .stream()
                .map(a -> {
                    User grantee = userRepository.findById(a.getUserId()).orElse(null);
                    String granteeEmail = grantee != null ? grantee.getEmail() : "unknown";
                    String granteeName = grantee != null ? grantee.getFullName() : "Unknown user";
                    String granterEmail = a.getGrantedBy() != null
                            ? userRepository.findById(a.getGrantedBy()).map(User::getEmail).orElse("system")
                            : "system";
                    return toDto(a, granteeEmail, granteeName, granterEmail);
                })
                .toList();
    }

    private AccessDto toDto(DocumentAccess a, String granteeEmail, String granteeName, String granterEmail) {
        return AccessDto.builder()
                .id(a.getId())
                .docId(a.getDocId())
                .userId(a.getUserId())
                .userEmail(granteeEmail)
                .userFullName(granteeName)
                .grantedByEmail(granterEmail)
                .capability(a.getCapability().name())
                .expiresAt(a.getExpiresAt())
                .grantedAt(a.getGrantedAt())
                .build();
    }

    private String toJson(Object obj) {
        try { return objectMapper.writeValueAsString(obj); } catch (Exception e) { return "{}"; }
    }

    /** Capability ranking for delegation checks: owner(3) > write(2) > read(1). */
    private static int rank(DocumentAccess.Capability cap) {
        return switch (cap) {
            case owner -> 3;
            case write -> 2;
            case read -> 1;
        };
    }
}

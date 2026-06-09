package com.pangochain.backend.signingworkflow;

import com.pangochain.backend.audit.AuditService;
import com.pangochain.backend.document.Document;
import com.pangochain.backend.document.DocumentRepository;
import com.pangochain.backend.esignature.EcdsaVerifier;
import com.pangochain.backend.notification.NotificationService;
import com.pangochain.backend.report.PdfBuilder;
import com.pangochain.backend.signingworkflow.SigningDtos.*;
import com.pangochain.backend.user.User;
import com.pangochain.backend.user.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.Base64;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

/**
 * Multi-party signing workflow. Each signatory signs a composite of the document hash, workflow id
 * and signer id, so a signature is bound to this ceremony and cannot be replayed elsewhere.
 * Signatures are applied in sign-order; completion anchors an aggregate proof on the ledger.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class SigningWorkflowService {

    private static final DateTimeFormatter TS = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm 'UTC'").withZone(ZoneOffset.UTC);

    private final SigningWorkflowRepository workflowRepository;
    private final SigningRequestRepository requestRepository;
    private final DocumentRepository documentRepository;
    private final UserRepository userRepository;
    private final AuditService auditService;
    private final NotificationService notificationService;

    /** SHA-256( documentHashB64 | workflowId | signerId ), base64 — the message each signer signs. */
    static String compositeHashB64(String documentHashB64, UUID workflowId, UUID signerId) {
        try {
            String composite = documentHashB64 + "|" + workflowId + "|" + signerId;
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(composite.getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(digest);
        } catch (Exception e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }

    @Transactional
    public WorkflowDto initiate(InitiateRequest req, User initiator) {
        Document doc = documentRepository.findById(req.documentId())
                .orElseThrow(() -> new IllegalArgumentException("Document not found"));
        // Canonical document hash = base64 of the stored hex SHA-256, so every signer attests the same value.
        String documentHashB64 = Base64.getEncoder().encodeToString(hexToBytes(doc.getDocumentHashSha256()));

        SigningWorkflow wf = workflowRepository.save(SigningWorkflow.builder()
                .documentId(req.documentId())
                .caseId(req.caseId())
                .title(req.title())
                .documentHashB64(documentHashB64)
                .initiatedBy(initiator.getId())
                .build());

        int order = 0;
        for (UUID signerId : req.signerIds()) {
            requestRepository.save(SigningRequest.builder()
                    .workflowId(wf.getId()).signerId(signerId).signOrder(order++).build());
        }

        auditService.log("SIGNING_WORKFLOW_INITIATED", initiator.getId(), "DOCUMENT", req.documentId().toString(), null,
                String.format("{\"workflow\":\"%s\",\"signers\":%d}", wf.getId(), req.signerIds().size()));

        notifyNextSigner(wf);
        return toDto(wf, initiator.getId());
    }

    @Transactional
    public WorkflowDto sign(UUID workflowId, SignRequest req, User signer) {
        SigningWorkflow wf = workflowRepository.findById(workflowId)
                .orElseThrow(() -> new IllegalArgumentException("Workflow not found"));
        if (!"PENDING".equals(wf.getStatus()))
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This workflow is already " + wf.getStatus().toLowerCase());

        List<SigningRequest> requests = requestRepository.findByWorkflowIdOrderBySignOrderAsc(workflowId);
        SigningRequest mine = requests.stream()
                .filter(r -> r.getSignerId().equals(signer.getId()))
                .findFirst()
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "You are not a signatory on this workflow"));
        if ("SIGNED".equals(mine.getStatus()))
            throw new ResponseStatusException(HttpStatus.CONFLICT, "You have already signed");

        // Enforce signing order: the next unsigned slot must be mine.
        SigningRequest next = requests.stream()
                .filter(r -> "PENDING".equals(r.getStatus()))
                .min(Comparator.comparingInt(SigningRequest::getSignOrder))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT, "No pending signatures"));
        if (!next.getId().equals(mine.getId()))
            throw new ResponseStatusException(HttpStatus.CONFLICT, "It is not your turn to sign yet");

        String pubKey = signer.getSigningPublicKey();
        if (pubKey == null || pubKey.isBlank())
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No signing public key registered — re-register to enable ECDSA signatures");

        String compositeB64 = compositeHashB64(wf.getDocumentHashB64(), wf.getId(), signer.getId());
        if (!EcdsaVerifier.verify(compositeB64, req.signatureB64(), pubKey)) {
            log.warn("Workflow ECDSA verification failed: workflow={} signer={}", workflowId, signer.getEmail());
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "ECDSA signature verification failed");
        }

        mine.setStatus("SIGNED");
        mine.setSignatureB64(req.signatureB64());
        mine.setSigningPublicKey(pubKey);
        mine.setSignedAt(Instant.now());
        requestRepository.save(mine);

        auditService.log("DOCUMENT_SIGNED", signer.getId(), "DOCUMENT", wf.getDocumentId().toString(), null,
                String.format("{\"workflow\":\"%s\",\"order\":%d,\"ecdsaVerified\":true}", wf.getId(), mine.getSignOrder()));

        boolean allSigned = requests.stream().allMatch(r -> "SIGNED".equals(r.getStatus()) || r.getId().equals(mine.getId()));
        if (allSigned) {
            wf.setStatus("COMPLETED");
            wf.setCompletedAt(Instant.now());
            workflowRepository.save(wf);
            auditService.log("SIGNING_COMPLETED", signer.getId(), "DOCUMENT", wf.getDocumentId().toString(), null,
                    String.format("{\"workflow\":\"%s\",\"signers\":%d}", wf.getId(), requests.size()));
            if (wf.getInitiatedBy() != null)
                notificationService.push(wf.getInitiatedBy(), "SIGNING_COMPLETED",
                        "All signatures collected for: " + wf.getTitle());
        } else {
            notifyNextSigner(wf);
        }
        return toDto(wf, signer.getId());
    }

    @Transactional(readOnly = true)
    public List<WorkflowDto> forDocument(UUID documentId, User viewer) {
        return workflowRepository.findByDocumentIdOrderByCreatedAtDesc(documentId).stream()
                .map(w -> toDto(w, viewer.getId())).toList();
    }

    @Transactional(readOnly = true)
    public byte[] certificate(UUID workflowId) {
        SigningWorkflow wf = workflowRepository.findById(workflowId)
                .orElseThrow(() -> new IllegalArgumentException("Workflow not found"));
        List<SigningRequest> requests = requestRepository.findByWorkflowIdOrderBySignOrderAsc(workflowId);

        try (PdfBuilder b = new PdfBuilder()) {
            b.title("Digital Signing Certificate")
             .subtitle(wf.getTitle())
             .subtitle("Workflow " + wf.getId() + "  ·  Status: " + wf.getStatus())
             .subtitle("Issued " + TS.format(Instant.now()))
             .rule().spacer()
             .keyValue("Document hash (SHA-256, base64)", wf.getDocumentHashB64())
             .keyValue("Document ledger anchor", wf.getFabricTxId() != null ? wf.getFabricTxId() : "(via per-signature audit anchors)")
             .spacer()
             .paragraph("Each signatory below applied an ECDSA P-256 signature over SHA-256(document hash | workflow id | signer id), verified server-side against their registered public key. The signature is bound to this workflow and cannot be replayed on another document or ceremony.")
             .spacer()
             .heading("Signatories");
            int i = 1;
            for (SigningRequest r : requests) {
                String name = userRepository.findById(r.getSignerId()).map(User::getFullName).orElse(r.getSignerId().toString());
                b.keyValue(i++ + ". " + name, r.getStatus()
                        + (r.getSignedAt() != null ? " · " + TS.format(r.getSignedAt()) : ""));
                if (r.getSignatureB64() != null) b.mono("ECDSA sig: " + r.getSignatureB64());
                if (r.getFabricTxId() != null) b.mono("Fabric tx: " + r.getFabricTxId());
                b.spacer();
            }
            return b.toBytes();
        }
    }

    private void notifyNextSigner(SigningWorkflow wf) {
        requestRepository.findByWorkflowIdOrderBySignOrderAsc(wf.getId()).stream()
                .filter(r -> "PENDING".equals(r.getStatus()))
                .min(Comparator.comparingInt(SigningRequest::getSignOrder))
                .ifPresent(r -> notificationService.push(r.getSignerId(), "SIGNATURE_REQUESTED",
                        "Your signature is requested on: " + wf.getTitle()));
    }

    private WorkflowDto toDto(SigningWorkflow wf, UUID viewerId) {
        List<SigningRequest> requests = requestRepository.findByWorkflowIdOrderBySignOrderAsc(wf.getId());
        UUID nextSignerId = requests.stream()
                .filter(r -> "PENDING".equals(r.getStatus()))
                .min(Comparator.comparingInt(SigningRequest::getSignOrder))
                .map(SigningRequest::getSignerId).orElse(null);

        List<SignerDto> signers = requests.stream().map(r -> {
            User u = userRepository.findById(r.getSignerId()).orElse(null);
            boolean yourTurn = "PENDING".equals(wf.getStatus())
                    && r.getSignerId().equals(viewerId)
                    && r.getSignerId().equals(nextSignerId);
            return new SignerDto(r.getId(), r.getSignerId(),
                    u != null ? u.getFullName() : "Unknown", u != null ? u.getEmail() : "",
                    r.getSignOrder(), r.getStatus(), r.getSignedAt(), r.getFabricTxId(), yourTurn);
        }).toList();

        return new WorkflowDto(wf.getId(), wf.getDocumentId(), wf.getCaseId(), wf.getTitle(), wf.getDocumentHashB64(),
                wf.getInitiatedBy(), wf.getStatus(), wf.getFabricTxId(), wf.getCreatedAt(), wf.getCompletedAt(), signers);
    }

    private static byte[] hexToBytes(String hex) {
        if (hex == null) return new byte[0];
        int len = hex.length();
        byte[] out = new byte[len / 2];
        for (int i = 0; i < len - 1; i += 2) {
            out[i / 2] = (byte) ((Character.digit(hex.charAt(i), 16) << 4) + Character.digit(hex.charAt(i + 1), 16));
        }
        return out;
    }
}

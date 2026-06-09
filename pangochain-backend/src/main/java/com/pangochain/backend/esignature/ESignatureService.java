package com.pangochain.backend.esignature;

import com.pangochain.backend.audit.AuditService;
import com.pangochain.backend.blockchain.FabricException;
import com.pangochain.backend.blockchain.FabricGatewayService;
import com.pangochain.backend.document.DocumentAccessRepository;
import com.pangochain.backend.user.User;
import com.pangochain.backend.user.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class ESignatureService {

    private final ESignatureRepository signatureRepository;
    private final DocumentAccessRepository accessRepository;
    private final UserRepository userRepository;
    private final AuditService auditService;
    @Autowired(required = false)
    private FabricGatewayService fabricGatewayService;

    /**
     * Record a document signature:
     * 1. Verify signer has active access to the document.
     * 2. Verify ECDSA P-256 signature server-side using the signer's registered public key.
     * 3. Anchor signature on Fabric via LogAuditEvent.
     * 4. Persist in esignatures table with verification_status = VERIFIED.
     */
    @Transactional
    public ESignatureDto sign(UUID docId, SignDocumentRequest req, User signer) {
        // 1. Verify access
        accessRepository.findActiveEntry(docId, signer.getId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN,
                        "You do not have access to this document"));

        // 2. ECDSA server-side verification
        String signerPublicKeyJwk = signer.getSigningPublicKey();
        if (signerPublicKeyJwk == null || signerPublicKeyJwk.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "No signing public key registered — re-register to enable ECDSA signatures");
        }
        boolean ecdsaValid = EcdsaVerifier.verify(req.documentHashB64(), req.signatureB64(), signerPublicKeyJwk);
        if (!ecdsaValid) {
            log.warn("ECDSA verification failed: docId={} signer={}", docId, signer.getEmail());
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "ECDSA signature verification failed — document hash or signature is invalid");
        }

        // 3. Anchor on Fabric
        String fabricTxId = null;
        try {
            if (fabricGatewayService != null) {
                String payload = String.format(
                        "{\"docId\":\"%s\",\"signerId\":\"%s\",\"documentHashB64\":\"%s\",\"timestamp\":\"%s\"}",
                        docId, signer.getId(), req.documentHashB64(), Instant.now());
                fabricTxId = fabricGatewayService.submitTransaction(
                        "LogAuditEvent",
                        "DOCUMENT_SIGNED",
                        docId.toString(),
                        signer.getId().toString(),
                        signer.getFirm() != null ? signer.getFirm().getMspId() : "FirmAMSP",
                        payload);
            }
        } catch (FabricException e) {
            log.warn("Fabric anchor for signature failed (continuing): {}", e.getMessage());
        }

        // 4. Persist
        ESignature sig = ESignature.builder()
                .documentId(docId)
                .signerId(signer.getId())
                .documentHashB64(req.documentHashB64())
                .signatureB64(req.signatureB64())
                .signingPublicKey(signerPublicKeyJwk)
                .verificationStatus("VERIFIED")
                .fabricTxId(fabricTxId)
                .build();
        sig = signatureRepository.save(sig);

        auditService.log("DOCUMENT_SIGNED", signer.getId(), "DOCUMENT", docId.toString(),
                fabricTxId, String.format("{\"documentHashB64\":\"%s\",\"ecdsaVerified\":true}", req.documentHashB64()));

        log.info("ECDSA signature verified and anchored: docId={} signer={} fabricTxId={}",
                docId, signer.getEmail(), fabricTxId);
        return toDto(sig, signer.getEmail());
    }

    public List<ESignatureDto> listForDocument(UUID docId) {
        return signatureRepository.findByDocumentId(docId).stream()
                .map(sig -> {
                    String email = userRepository.findById(sig.getSignerId())
                            .map(User::getEmail).orElse("unknown");
                    return toDto(sig, email);
                }).toList();
    }

    private ESignatureDto toDto(ESignature sig, String signerEmail) {
        return ESignatureDto.builder()
                .id(sig.getId())
                .documentId(sig.getDocumentId())
                .signerId(sig.getSignerId())
                .signerEmail(signerEmail)
                .documentHash(sig.getDocumentHash())
                .signatureHash(sig.getSignatureHash())
                .signatureB64(sig.getSignatureB64())
                .documentHashB64(sig.getDocumentHashB64())
                .signingPublicKey(sig.getSigningPublicKey())
                .verificationStatus(sig.getVerificationStatus())
                .fabricTxId(sig.getFabricTxId())
                .signedAt(sig.getSignedAt())
                .build();
    }
}

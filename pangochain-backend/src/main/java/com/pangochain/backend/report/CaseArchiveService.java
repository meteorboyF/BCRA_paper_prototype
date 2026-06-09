package com.pangochain.backend.report;

import com.pangochain.backend.audit.AuditLog;
import com.pangochain.backend.audit.AuditLogRepository;
import com.pangochain.backend.audit.AuditService;
import com.pangochain.backend.cases.Case;
import com.pangochain.backend.cases.CaseRepository;
import com.pangochain.backend.document.DocStatus;
import com.pangochain.backend.document.Document;
import com.pangochain.backend.document.DocumentRepository;
import com.pangochain.backend.user.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;

/**
 * Case Outcome Archive — generates the On-Chain Permanence Certificate: a PDF listing every
 * document and audit event associated with a case together with its Hyperledger Fabric transaction
 * ID, so the client retains a portable, independently verifiable record of case integrity. The
 * encrypted documents themselves are bundled client-side (decrypted in the browser, never here).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class CaseArchiveService {

    private static final DateTimeFormatter TS = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm 'UTC'").withZone(ZoneOffset.UTC);

    private final CaseRepository caseRepository;
    private final DocumentRepository documentRepository;
    private final AuditLogRepository auditLogRepository;
    private final AuditService auditService;

    public record CertificateResult(String fileName, byte[] pdf) {}

    @Transactional
    public CertificateResult permanenceCertificate(UUID caseId, User actor) {
        Case legalCase = caseRepository.findById(caseId)
                .orElseThrow(() -> new IllegalArgumentException("Case not found"));
        List<Document> docs = documentRepository.findByLegalCaseIdAndStatus(caseId, DocStatus.ACTIVE);
        List<AuditLog> events = auditLogRepository
                .findByResourceId(caseId.toString(), PageRequest.of(0, 200)).getContent();

        byte[] pdf;
        try (PdfBuilder b = new PdfBuilder()) {
            b.title("On-Chain Permanence Certificate")
             .subtitle("Case: " + legalCase.getTitle())
             .subtitle("Status: " + legalCase.getStatus()
                     + (legalCase.getClosedAt() != null ? "  ·  Closed " + TS.format(legalCase.getClosedAt()) : ""))
             .subtitle("Issued " + TS.format(Instant.now()) + " for " + actor.getEmail())
             .rule().spacer()
             .paragraph("This certificate attests that the documents and events listed below were anchored on the Hyperledger Fabric distributed ledger. Each entry carries the transaction ID under which it was committed. Recomputing a document's SHA-256 hash after decryption and comparing it to the value here proves the document has not been altered since it was anchored.")
             .spacer();

            b.keyValue("Case ledger anchor (tx)", legalCase.getFabricTxId() != null ? legalCase.getFabricTxId() : "(not anchored)")
             .keyValue("Documents", String.valueOf(docs.size()))
             .keyValue("Ledger-anchored events", String.valueOf(events.size()))
             .spacer();

            b.heading("Documents");
            int i = 1;
            for (Document d : docs) {
                b.keyValue(i++ + ". " + d.getFileName(), "v" + d.getVersion() + " · " + d.getCategory())
                 .mono("SHA-256: " + d.getDocumentHashSha256())
                 .mono("Fabric tx: " + (d.getFabricTxId() != null ? d.getFabricTxId() : "(not anchored)"))
                 .spacer();
            }

            b.heading("Anchored event history");
            for (AuditLog e : events) {
                b.mono(TS.format(e.getTimestamp()) + "  " + e.getEventType()
                        + (e.getFabricTxId() != null ? "  tx=" + e.getFabricTxId() : ""));
            }
            pdf = b.toBytes();
        }

        auditService.log("CASE_ARCHIVE_GENERATED", actor.getId(), "CASE", caseId.toString(), null,
                String.format("{\"documents\":%d,\"events\":%d}", docs.size(), events.size()));

        String fileName = "permanence-certificate_" + caseId.toString().substring(0, 8) + ".pdf";
        return new CertificateResult(fileName, pdf);
    }
}

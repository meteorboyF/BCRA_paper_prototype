package com.pangochain.backend.report;

import com.pangochain.backend.audit.AuditService;
import com.pangochain.backend.document.Document;
import com.pangochain.backend.document.DocumentRepository;
import com.pangochain.backend.user.User;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.Base64;
import java.util.List;
import java.util.UUID;

/**
 * Court-ready PDF bundle generator. The client decrypts the selected documents locally and POSTs
 * their plaintext (text documents) plus the document IDs. The server assembles a single PDF with a
 * cover page, table of contents, the document bodies, and a Blockchain Integrity Appendix whose
 * SHA-256 hashes and Fabric tx IDs are read from the authoritative DB records (not the client).
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class BundleService {

    private static final DateTimeFormatter TS = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm 'UTC'").withZone(ZoneOffset.UTC);

    private final DocumentRepository documentRepository;
    private final AuditService auditService;

    public record BundleItem(@NotNull UUID documentId, String plaintextBase64) {}

    public record BundleRequest(@NotNull UUID caseId, String bundleType, List<BundleItem> items) {}

    public record BundleResult(String fileName, byte[] pdf) {}

    @Transactional(readOnly = true)
    public BundleResult generate(BundleRequest req, User actor) {
        String bundleType = req.bundleType() != null ? req.bundleType() : "Evidence Bundle";
        List<BundleItem> items = req.items() != null ? req.items() : List.of();

        try (PdfBuilder pdf = new PdfBuilder()) {
            // ── Cover page ──
            pdf.title("PangoChain " + bundleType)
               .subtitle("Generated " + TS.format(Instant.now()) + " by " + actor.getEmail())
               .subtitle(items.size() + " document(s)")
               .rule().spacer()
               .paragraph("This bundle was assembled from end-to-end encrypted case documents. Each document was decrypted in the originating browser; the server received plaintext over TLS for assembly only and persists none of it. Document integrity is independently verifiable against the Hyperledger Fabric ledger using the SHA-256 hashes and transaction IDs in the Blockchain Integrity Appendix.")
               .spacer();

            // ── Table of contents ──
            pdf.heading("Table of Contents");
            int idx = 1;
            for (BundleItem item : items) {
                Document doc = lookup(item.documentId(), req.caseId());
                pdf.row(idx++ + ". " + (doc != null ? doc.getFileName() : "(missing document)"),
                        doc != null ? "v" + doc.getVersion() + " · " + doc.getCategory() : "");
            }

            // ── Document bodies ──
            idx = 1;
            for (BundleItem item : items) {
                Document doc = lookup(item.documentId(), req.caseId());
                String name = doc != null ? doc.getFileName() : "(missing document)";
                pdf.heading(idx++ + ". " + name);
                if (item.plaintextBase64() != null && !item.plaintextBase64().isBlank()) {
                    String text = new String(Base64.getDecoder().decode(item.plaintextBase64()), StandardCharsets.UTF_8);
                    pdf.paragraph(text);
                } else {
                    pdf.paragraph("[Binary document — included in this bundle by reference. Its integrity is attested by the SHA-256 hash and Fabric transaction ID in the appendix.]");
                }
                pdf.spacer();
            }

            // ── Blockchain Integrity Appendix ──
            pdf.heading("Blockchain Integrity Appendix")
               .paragraph("Each document below is anchored on the Hyperledger Fabric ledger. The SHA-256 hash is computed over the document plaintext at upload time; recomputing it after decryption and comparing to this value proves the document has not been altered.")
               .spacer();
            idx = 1;
            for (BundleItem item : items) {
                Document doc = lookup(item.documentId(), req.caseId());
                if (doc == null) continue;
                pdf.keyValue(idx++ + ". Document", doc.getFileName())
                   .mono("SHA-256: " + doc.getDocumentHashSha256())
                   .mono("Fabric tx: " + (doc.getFabricTxId() != null ? doc.getFabricTxId() : "(not anchored — Fabric unavailable at upload)"))
                   .spacer();
            }

            auditService.log("BUNDLE_GENERATED", actor.getId(), "CASE", req.caseId().toString(), null,
                    String.format("{\"type\":\"%s\",\"documents\":%d}", bundleType, items.size()));

            String fileName = bundleType.toLowerCase().replace(' ', '-') + "_" + req.caseId().toString().substring(0, 8) + ".pdf";
            return new BundleResult(fileName, pdf.toBytes());
        }
    }

    private Document lookup(UUID docId, UUID caseId) {
        return documentRepository.findById(docId)
                .filter(d -> d.getLegalCase() != null && d.getLegalCase().getId().equals(caseId))
                .orElse(null);
    }
}

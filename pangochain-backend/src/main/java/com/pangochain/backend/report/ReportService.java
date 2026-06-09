package com.pangochain.backend.report;

import com.pangochain.backend.audit.AuditLog;
import com.pangochain.backend.audit.AuditLogRepository;
import com.pangochain.backend.audit.AuditService;
import com.pangochain.backend.document.DocumentRepository;
import com.pangochain.backend.user.User;
import com.pangochain.backend.user.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/** Automated compliance report generator — renders branded PDF reports from the dual-store audit
 *  data. Supported types: GDPR_DATA_INVENTORY, ACCESS_LOG_SUMMARY, DATA_BREACH_READINESS. */
@Service
@RequiredArgsConstructor
@Slf4j
public class ReportService {

    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("yyyy-MM-dd").withZone(ZoneOffset.UTC);
    private static final DateTimeFormatter TS = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss 'UTC'").withZone(ZoneOffset.UTC);

    private final AuditLogRepository auditLogRepository;
    private final UserRepository userRepository;
    private final DocumentRepository documentRepository;
    private final AuditService auditService;

    public record ReportResult(String fileName, byte[] pdf) {}

    @Transactional(readOnly = true)
    public ReportResult generate(String type, Instant from, Instant to, User actor) {
        List<AuditLog> events = auditLogRepository.findByTimestampBetweenOrderByTimestampDesc(from, to);
        byte[] pdf = switch (type) {
            case "GDPR_DATA_INVENTORY" -> gdprInventory(from, to, events);
            case "ACCESS_LOG_SUMMARY" -> accessLogSummary(from, to, events);
            case "DATA_BREACH_READINESS" -> breachReadiness(from, to, events);
            default -> throw new IllegalArgumentException("Unknown report type: " + type);
        };

        auditService.log("REPORT_GENERATED", actor.getId(), "REPORT", type, null,
                String.format("{\"type\":\"%s\",\"from\":\"%s\",\"to\":\"%s\",\"events\":%d}",
                        type, DAY.format(from), DAY.format(to), events.size()));

        String fileName = type.toLowerCase().replace('_', '-') + "_" + DAY.format(from) + "_" + DAY.format(to) + ".pdf";
        return new ReportResult(fileName, pdf);
    }

    private void header(PdfBuilder pdf, String title, Instant from, Instant to) {
        pdf.title("PangoChain Compliance Report")
           .subtitle(title)
           .subtitle("Period: " + DAY.format(from) + " to " + DAY.format(to) + "   ·   Generated " + TS.format(Instant.now()))
           .rule().spacer();
    }

    private byte[] gdprInventory(Instant from, Instant to, List<AuditLog> events) {
        try (PdfBuilder pdf = new PdfBuilder()) {
            header(pdf, "GDPR Data Inventory", from, to);
            pdf.heading("1. Personal data held by the platform")
               .keyValue("Registered users (data subjects + staff)", String.valueOf(userRepository.count()))
               .keyValue("Documents under management", String.valueOf(documentRepository.count()))
               .keyValue("Audit entries in period", String.valueOf(events.size()))
               .spacer();

            pdf.heading("2. Categories of personal data")
               .paragraph("Profile identifiers (name, email, role); encrypted document payloads (held as ciphertext only - the platform holds no plaintext); cryptographic public keys; access-control grants; and an append-only audit trail. Document and message contents are end-to-end encrypted and are technically inaccessible to the data controller.")
               .spacer();

            pdf.heading("3. Lawful basis & retention")
               .paragraph("Processing is performed on the basis of contract (legal representation) and legal obligation (records retention). Ledger-anchored audit records are immutable by design and cannot be erased; this limitation is disclosed to data subjects in the privacy dashboard.")
               .spacer();

            pdf.heading("4. Data-subject request activity in period");
            long deletions = events.stream().filter(e -> e.getEventType().startsWith("GDPR_DELETION")).count();
            pdf.keyValue("GDPR deletion / erasure events", String.valueOf(deletions))
               .keyValue("Report generation events", String.valueOf(events.stream().filter(e -> e.getEventType().equals("REPORT_GENERATED")).count()));
            return pdf.toBytes();
        }
    }

    private byte[] accessLogSummary(Instant from, Instant to, List<AuditLog> events) {
        try (PdfBuilder pdf = new PdfBuilder()) {
            header(pdf, "Access Log Summary", from, to);
            pdf.keyValue("Total events in period", String.valueOf(events.size())).spacer();

            pdf.heading("Events by type");
            Map<String, Long> byType = events.stream()
                    .collect(Collectors.groupingBy(AuditLog::getEventType, Collectors.counting()));
            byType.entrySet().stream()
                    .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                    .forEach(e -> pdf.row(e.getKey(), e.getValue() + " events"));
            pdf.spacer();

            pdf.heading("Most active actors");
            Map<String, Long> byActor = events.stream()
                    .filter(e -> e.getActorId() != null)
                    .collect(Collectors.groupingBy(e -> e.getActorId().toString(), Collectors.counting()));
            byActor.entrySet().stream()
                    .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                    .limit(10)
                    .forEach(e -> {
                        String email = userRepository.findById(java.util.UUID.fromString(e.getKey()))
                                .map(User::getEmail).orElse(e.getKey());
                        pdf.row(email, e.getValue() + " events");
                    });
            pdf.spacer();

            pdf.heading("Ledger-anchored verification");
            pdf.paragraph("Each audit entry below carries the Fabric transaction ID under which it was anchored, enabling independent verification against the Hyperledger Fabric ledger.");
            events.stream().filter(e -> e.getFabricTxId() != null).limit(40).forEach(e ->
                    pdf.mono(TS.format(e.getTimestamp()) + "  " + e.getEventType() + "  tx=" + e.getFabricTxId()));
            return pdf.toBytes();
        }
    }

    private byte[] breachReadiness(Instant from, Instant to, List<AuditLog> events) {
        try (PdfBuilder pdf = new PdfBuilder()) {
            header(pdf, "Data Breach Readiness Assessment", from, to);
            pdf.heading("Technical & organisational measures")
               .row("Encryption at rest", "AES-256-GCM, browser-side; server holds ciphertext only")
               .row("Key management", "ECIES P-256 key wrapping; PBKDF2 (600k) private-key derivation")
               .row("Access control", "Two-layer: JWT (Spring Security) + Fabric CheckAccess chaincode")
               .row("Audit trail", "Append-only PostgreSQL (INSERT-only trigger) + Fabric anchoring")
               .row("Authentication", "TOTP MFA enforced for privileged roles; single-use recovery codes")
               .spacer();

            long anomalies = events.stream().filter(e -> e.getEventType().contains("ANOMALY")).count();
            long fallbacks = events.stream().filter(e -> e.getEventType().equals("ACL_FABRIC_FALLBACK")).count();
            pdf.heading("Incident indicators in period")
               .keyValue("Anomaly-detection alerts", String.valueOf(anomalies))
               .keyValue("Fabric ACL fallbacks (degraded-mode access checks)", String.valueOf(fallbacks))
               .keyValue("Total audited events", String.valueOf(events.size()))
               .spacer();

            pdf.heading("Breach notification readiness")
               .paragraph("The append-only audit log provides a complete, tamper-evident record of every access event, enabling scope determination within the 72-hour GDPR notification window. Affected data subjects can be enumerated from access-control grants. As payloads are end-to-end encrypted, exposure of stored ciphertext without the corresponding wrapped keys does not constitute disclosure of personal data.");
            return pdf.toBytes();
        }
    }
}

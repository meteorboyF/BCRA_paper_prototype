package com.pangochain.backend.report;

import com.pangochain.backend.user.User;
import com.pangochain.backend.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;

/** Automated compliance report generator — IT Admins / Managing Partners download branded PDFs. */
@RestController
@RequestMapping("/api/reports")
@RequiredArgsConstructor
public class ReportController {

    private final ReportService reportService;
    private final UserRepository userRepository;

    /** The report types the UI can offer, with human labels. */
    @PreAuthorize("hasAnyRole('MANAGING_PARTNER','IT_ADMIN')")
    @GetMapping("/types")
    public ResponseEntity<List<Map<String, String>>> types() {
        return ResponseEntity.ok(List.of(
                Map.of("key", "GDPR_DATA_INVENTORY", "label", "GDPR Data Inventory"),
                Map.of("key", "ACCESS_LOG_SUMMARY", "label", "Access Log Summary"),
                Map.of("key", "DATA_BREACH_READINESS", "label", "Data Breach Readiness")));
    }

    /**
     * Generate a report PDF. Dates are inclusive ISO-8601 days (yyyy-MM-dd); if omitted the range
     * defaults to the last 30 days.
     */
    @PreAuthorize("hasAnyRole('MANAGING_PARTNER','IT_ADMIN')")
    @GetMapping("/{type}")
    public ResponseEntity<byte[]> generate(
            @PathVariable String type,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @AuthenticationPrincipal UserDetails principal) {

        Instant fromInstant = from != null
                ? LocalDate.parse(from).atStartOfDay(ZoneOffset.UTC).toInstant()
                : Instant.now().minusSeconds(30L * 24 * 3600);
        Instant toInstant = to != null
                ? LocalDate.parse(to).plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant()
                : Instant.now();

        ReportService.ReportResult result = reportService.generate(type, fromInstant, toInstant, resolve(principal));

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_PDF);
        headers.setContentDisposition(ContentDisposition.attachment().filename(result.fileName()).build());
        return new ResponseEntity<>(result.pdf(), headers, 200);
    }

    private User resolve(UserDetails principal) {
        return userRepository.findByEmail(principal.getUsername())
                .orElseThrow(() -> new IllegalStateException("User not found"));
    }
}

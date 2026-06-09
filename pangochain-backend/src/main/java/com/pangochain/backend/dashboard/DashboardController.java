package com.pangochain.backend.dashboard;

import com.pangochain.backend.audit.AuditLogRepository;
import com.pangochain.backend.cases.CaseRepository;
import com.pangochain.backend.cases.CaseStatus;
import com.pangochain.backend.deadline.CaseDeadlineRepository;
import com.pangochain.backend.document.DocStatus;
import com.pangochain.backend.document.DocumentRepository;
import com.pangochain.backend.hearing.HearingDto;
import com.pangochain.backend.hearing.HearingRepository;
import com.pangochain.backend.message.MessageRepository;
import com.pangochain.backend.reminder.ReminderRepository;
import com.pangochain.backend.user.User;
import com.pangochain.backend.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/dashboard")
@RequiredArgsConstructor
public class DashboardController {

    private final CaseRepository caseRepository;
    private final DocumentRepository documentRepository;
    private final MessageRepository messageRepository;
    private final AuditLogRepository auditLogRepository;
    private final HearingRepository hearingRepository;
    private final ReminderRepository reminderRepository;
    private final UserRepository userRepository;
    private final CaseDeadlineRepository deadlineRepository;

    @PreAuthorize("isAuthenticated()")
    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> stats(
            @AuthenticationPrincipal UserDetails principal) {
        User user = userRepository.findByEmail(principal.getUsername())
                .orElseThrow(() -> new IllegalStateException("User not found"));

        Map<String, Object> stats = new HashMap<>();

        String roleStr = user.getRole().name();
        boolean isClientRole = roleStr.startsWith("CLIENT_");

        if (isClientRole) {
            long activeCases = caseRepository.findByMember(user.getId()).stream()
                    .filter(c -> c.getStatus() == CaseStatus.ACTIVE)
                    .count();
            stats.put("activeCases", activeCases);
            stats.put("totalDocuments", documentRepository.countAccessibleByUser(user.getId(), DocStatus.ACTIVE));
            stats.put("unreadMessages", messageRepository.countByRecipientIdAndReadAtIsNull(user.getId()));
            stats.put("unreadReminders", reminderRepository.countByRecipientIdAndReadFalse(user.getId()));
            stats.put("auditEvents", auditLogRepository.count());

            hearingRepository.findUpcomingForClient(user.getId(), Instant.now())
                    .stream().findFirst()
                    .ifPresentOrElse(
                            h -> stats.put("nextHearing", HearingDto.from(h)),
                            () -> stats.put("nextHearing", null)
                    );

        } else {
            // Legal professional stats
            long activeCases = user.getFirm() != null
                    ? caseRepository.countByFirmIdAndStatus(user.getFirm().getId(), CaseStatus.ACTIVE)
                    : 0L;
            stats.put("activeCases", activeCases);
            stats.put("totalDocuments", documentRepository.count());
            stats.put("unreadMessages", messageRepository.countByRecipientIdAndReadAtIsNull(user.getId()));
            stats.put("unreadReminders", reminderRepository.countByRecipientIdAndReadFalse(user.getId()));
            stats.put("auditEvents", auditLogRepository.count());

            // Next upcoming hearing for this firm
            if (user.getFirm() != null) {
                hearingRepository.findUpcomingByFirm(user.getFirm().getId(), Instant.now())
                        .stream().findFirst()
                        .ifPresentOrElse(
                                h -> stats.put("nextHearing", HearingDto.from(h)),
                                () -> stats.put("nextHearing", null)
                        );
            } else {
                stats.put("nextHearing", null);
            }
        }

        return ResponseEntity.ok(stats);
    }

    /** GET /api/dashboard/lawyer — lawyer-specific stats (redirects to /stats for non-client). */
    @PreAuthorize("hasAnyRole('MANAGING_PARTNER','PARTNER_SENIOR','PARTNER_JUNIOR','ASSOCIATE_SENIOR','ASSOCIATE_JUNIOR','SECRETARY','IT_ADMIN','PARALEGAL','REGULATOR')")
    @GetMapping("/lawyer")
    public ResponseEntity<Map<String, Object>> lawyerDashboard(@AuthenticationPrincipal UserDetails principal) {
        User user = userRepository.findByEmail(principal.getUsername())
                .orElseThrow(() -> new IllegalStateException("User not found"));

        boolean isFirmWide = "MANAGING_PARTNER".equals(user.getRole().name());
        long activeCases = user.getFirm() != null
                ? caseRepository.countByFirmIdAndStatus(user.getFirm().getId(), CaseStatus.ACTIVE) : 0L;
        long totalDocs = isFirmWide ? documentRepository.count() : documentRepository.countByOwnerId(user.getId());

        Map<String, Object> stats = new HashMap<>();
        stats.put("activeCasesCount", activeCases);
        stats.put("totalDocuments", totalDocs);
        stats.put("unreadMessages", messageRepository.countByRecipientIdAndReadAtIsNull(user.getId()));
        stats.put("recentAuditEvents", auditLogRepository.findAll(
                org.springframework.data.domain.PageRequest.of(0, 5,
                        org.springframework.data.domain.Sort.by("timestamp").descending())).getContent());
        if (user.getFirm() != null) {
            hearingRepository.findUpcomingByFirm(user.getFirm().getId(), Instant.now())
                    .stream().findFirst()
                    .ifPresentOrElse(h -> stats.put("nextHearing", HearingDto.from(h)),
                            () -> stats.put("nextHearing", null));
            // Upcoming deadlines for the dashboard timeline (5 soonest, not yet completed)
            List<Map<String, Object>> upcomingDeadlines = deadlineRepository
                    .findUpcomingByFirm(user.getFirm().getId(), Instant.now(), PageRequest.of(0, 5))
                    .stream()
                    .map(d -> {
                        Map<String, Object> m = new HashMap<>();
                        m.put("id", d.getId().toString());
                        m.put("title", d.getTitle());
                        m.put("description", d.getDescription());
                        m.put("deadlineType", d.getDeadlineType().name());
                        m.put("deadlineDate", d.getDeadlineDate().toEpochMilli());
                        m.put("caseId", d.getCaseId().toString());
                        return m;
                    })
                    .toList();
            stats.put("upcomingDeadlines", upcomingDeadlines);
        } else {
            stats.put("nextHearing", null);
            stats.put("upcomingDeadlines", List.of());
        }
        return ResponseEntity.ok(stats);
    }

    /** GET /api/dashboard/client — client portal stats. */
    @PreAuthorize("hasAnyRole('CLIENT_PRIMARY','CLIENT_SECONDARY','CLIENT_CORP_ADMIN')")
    @GetMapping("/client")
    public ResponseEntity<Map<String, Object>> clientDashboard(@AuthenticationPrincipal UserDetails principal) {
        User user = userRepository.findByEmail(principal.getUsername())
                .orElseThrow(() -> new IllegalStateException("User not found"));

        Map<String, Object> stats = new HashMap<>();
        stats.put("documentsCount", documentRepository.countAccessibleByUser(user.getId(), DocStatus.ACTIVE));
        stats.put("messagesCount", messageRepository.countByRecipientIdAndReadAtIsNull(user.getId()));
        stats.put("remindersCount", reminderRepository.countByRecipientIdAndReadFalse(user.getId()));
        stats.put("auditEventsCount", auditLogRepository.count());
        hearingRepository.findUpcomingForClient(user.getId(), Instant.now())
                .stream().findFirst()
                .ifPresentOrElse(
                        h -> stats.put("nextHearing", HearingDto.from(h)),
                        () -> stats.put("nextHearing", null)
                );
        stats.put("encryptionStatus", Map.of(
                "algorithm", "AES-256-GCM",
                "keyDerivation", "PBKDF2-SHA256-600k",
                "keyWrapping", "ECIES-P256"
        ));
        return ResponseEntity.ok(stats);
    }
}

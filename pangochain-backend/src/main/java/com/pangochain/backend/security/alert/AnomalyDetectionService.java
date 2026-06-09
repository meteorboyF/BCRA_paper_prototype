package com.pangochain.backend.security.alert;

import com.pangochain.backend.audit.AuditLog;
import com.pangochain.backend.audit.AuditLogRepository;
import com.pangochain.backend.audit.AuditService;
import com.pangochain.backend.user.User;
import com.pangochain.backend.user.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Statistical anomaly detection over the dual-store audit log. Runs nightly and on demand.
 * Flags: (1) actors whose access volume is a Z-score outlier, (2) short-window access bursts,
 * (3) concentrated off-hours activity. Findings are written to {@link SecurityAlert} and a
 * single ACL_ANOMALY_DETECTED event is logged when anything is found.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class AnomalyDetectionService {

    private static final Duration WINDOW = Duration.ofDays(7);
    private static final double Z_THRESHOLD = 2.5;
    private static final int MIN_EVENTS_FOR_OUTLIER = 15;
    private static final int BURST_COUNT = 12;
    private static final Duration BURST_WINDOW = Duration.ofMinutes(10);
    private static final int OFFHOURS_THRESHOLD = 10;

    private final AuditLogRepository auditLogRepository;
    private final SecurityAlertRepository alertRepository;
    private final UserRepository userRepository;
    private final AuditService auditService;

    /** Nightly sweep (02:30 server time). */
    @Scheduled(cron = "0 30 2 * * *")
    public void scheduledRun() {
        try { analyze(); } catch (Exception e) { log.warn("Scheduled anomaly sweep failed: {}", e.getMessage()); }
    }

    @Transactional
    public List<SecurityAlert> analyze() {
        List<AuditLog> logs = auditLogRepository.findByTimestampAfter(Instant.now().minus(WINDOW));
        Map<UUID, List<AuditLog>> byActor = logs.stream()
                .filter(l -> l.getActorId() != null)
                .collect(Collectors.groupingBy(AuditLog::getActorId));

        List<SecurityAlert> found = new ArrayList<>();

        // (1) Volume outliers via Z-score across actors.
        List<Integer> counts = byActor.values().stream().map(List::size).toList();
        double mean = counts.stream().mapToInt(i -> i).average().orElse(0);
        double std = stddev(counts, mean);
        for (var e : byActor.entrySet()) {
            int n = e.getValue().size();
            if (std > 0 && n >= MIN_EVENTS_FOR_OUTLIER) {
                double z = (n - mean) / std;
                if (z >= Z_THRESHOLD) {
                    found.add(build(SecurityAlert.Severity.HIGH, "ACCESS_VOLUME_OUTLIER", e.getKey(),
                            String.format("%s performed %d audited actions in the last 7 days — %.1f×σ above the firm average (%.0f).",
                                    label(e.getKey()), n, z, mean), z, e.getValue()));
                }
            }
        }

        // (2) Bursts + (3) off-hours concentration, per actor.
        for (var e : byActor.entrySet()) {
            List<Instant> ts = e.getValue().stream().map(AuditLog::getTimestamp).sorted().toList();
            int maxBurst = maxInWindow(ts, BURST_WINDOW);
            if (maxBurst >= BURST_COUNT) {
                found.add(build(SecurityAlert.Severity.MEDIUM, "ACCESS_BURST", e.getKey(),
                        String.format("%s triggered %d audited actions within a %d-minute window.",
                                label(e.getKey()), maxBurst, BURST_WINDOW.toMinutes()), (double) maxBurst, e.getValue()));
            }
            long offHours = ts.stream().filter(t -> {
                int h = t.atZone(ZoneOffset.UTC).getHour();
                return h >= 0 && h < 5;
            }).count();
            if (offHours >= OFFHOURS_THRESHOLD) {
                found.add(build(SecurityAlert.Severity.LOW, "OFF_HOURS_ACTIVITY", e.getKey(),
                        String.format("%s performed %d actions between 00:00–05:00 UTC.",
                                label(e.getKey()), offHours), (double) offHours, e.getValue()));
            }
        }

        // Replace prior auto-generated unacknowledged alerts with this sweep's findings.
        alertRepository.deleteUnacknowledgedAuto();
        List<SecurityAlert> saved = alertRepository.saveAll(found);

        if (!saved.isEmpty()) {
            auditService.log("ACL_ANOMALY_DETECTED", null, "SYSTEM", "audit-log", null,
                    "{\"alerts\":" + saved.size() + "}");
        }
        log.info("Anomaly sweep: {} actors, {} alert(s)", byActor.size(), saved.size());
        return alertRepository.findAllByOrderBySeverityDescDetectedAtDesc();
    }

    public List<SecurityAlert> listAlerts() {
        return alertRepository.findAllByOrderBySeverityDescDetectedAtDesc();
    }

    @Transactional
    public void acknowledge(UUID id) {
        alertRepository.findById(id).ifPresent(a -> { a.setAcknowledged(true); alertRepository.save(a); });
    }

    private SecurityAlert build(SecurityAlert.Severity sev, String type, UUID actorId,
                                String description, double metric, List<AuditLog> evidence) {
        String fabricTx = evidence.stream().map(AuditLog::getFabricTxId)
                .filter(Objects::nonNull).findFirst().orElse(null);
        return SecurityAlert.builder()
                .severity(sev).alertType(type).actorId(actorId).actorLabel(label(actorId))
                .description(description).metric(metric).fabricTxId(fabricTx)
                .signature(type + ":" + actorId).build();
    }

    private String label(UUID actorId) {
        if (actorId == null) return "An actor";
        return userRepository.findById(actorId).map(User::getEmail).orElse(actorId.toString());
    }

    private static double stddev(List<Integer> values, double mean) {
        if (values.size() < 2) return 0;
        double var = values.stream().mapToDouble(v -> (v - mean) * (v - mean)).sum() / values.size();
        return Math.sqrt(var);
    }

    /** Max number of timestamps within any sliding window of the given duration (sorted input). */
    private static int maxInWindow(List<Instant> sorted, Duration window) {
        int best = 0, start = 0;
        for (int end = 0; end < sorted.size(); end++) {
            while (Duration.between(sorted.get(start), sorted.get(end)).compareTo(window) > 0) start++;
            best = Math.max(best, end - start + 1);
        }
        return best;
    }
}

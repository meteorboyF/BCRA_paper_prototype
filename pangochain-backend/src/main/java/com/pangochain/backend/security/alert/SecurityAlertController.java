package com.pangochain.backend.security.alert;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/** Security alerts dashboard — Managing Partner / IT Admin only. */
@RestController
@RequestMapping("/api/security")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('MANAGING_PARTNER','IT_ADMIN')")
public class SecurityAlertController {

    private final AnomalyDetectionService anomalyDetectionService;

    @GetMapping("/alerts")
    public ResponseEntity<List<SecurityAlert>> alerts() {
        return ResponseEntity.ok(anomalyDetectionService.listAlerts());
    }

    /** Trigger an on-demand sweep (the same logic the nightly job runs). */
    @PostMapping("/analyze")
    public ResponseEntity<List<SecurityAlert>> analyze() {
        return ResponseEntity.ok(anomalyDetectionService.analyze());
    }

    @PostMapping("/alerts/{id}/ack")
    public ResponseEntity<Void> acknowledge(@PathVariable UUID id) {
        anomalyDetectionService.acknowledge(id);
        return ResponseEntity.noContent().build();
    }
}

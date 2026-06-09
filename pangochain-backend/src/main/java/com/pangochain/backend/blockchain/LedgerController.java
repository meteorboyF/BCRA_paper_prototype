package com.pangochain.backend.blockchain;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/ledger")
@RequiredArgsConstructor
@Slf4j
public class LedgerController {

    @Autowired(required = false)
    private FabricGatewayService fabricGatewayService;

    private final com.pangochain.backend.audit.AuditLogRepository auditLogRepository;

    /** GET /api/ledger/events — latest Fabric chaincode events (via audit_log table). */
    @PreAuthorize("hasAnyRole('MANAGING_PARTNER','IT_ADMIN','REGULATOR')")
    @GetMapping("/events")
    public ResponseEntity<List<com.pangochain.backend.audit.AuditLog>> latestEvents(
            @RequestParam(defaultValue = "50") int limit) {
        var pageable = org.springframework.data.domain.PageRequest.of(
                0, Math.min(limit, 200),
                org.springframework.data.domain.Sort.by("timestamp").descending());
        return ResponseEntity.ok(auditLogRepository.findAll(pageable).getContent());
    }

    /** GET /api/ledger/tx/{txId} — look up a Fabric transaction by txId stored in audit_log. */
    @PreAuthorize("hasAnyRole('MANAGING_PARTNER','IT_ADMIN','REGULATOR')")
    @GetMapping("/tx/{txId}")
    public ResponseEntity<Map<String, Object>> transactionDetail(@PathVariable String txId) {
        var entry = auditLogRepository.findByFabricTxId(txId);
        if (entry.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        String fabricDetail = "{}";
        if (fabricGatewayService != null) {
            try {
                fabricDetail = fabricGatewayService.evaluateTransaction("GetAuditEvent", txId);
            } catch (FabricException e) {
                log.debug("Fabric GetAuditEvent unavailable for txId={}: {}", txId, e.getMessage());
            }
        }

        var log0 = entry.get(0);
        return ResponseEntity.ok(Map.of(
                "txId", txId,
                "eventType", log0.getEventType(),
                "actorId", log0.getActorId() != null ? log0.getActorId().toString() : "",
                "resourceType", log0.getResourceType() != null ? log0.getResourceType() : "",
                "resourceId", log0.getResourceId() != null ? log0.getResourceId() : "",
                "timestamp", log0.getTimestamp().toString(),
                "fabricDetail", fabricDetail
        ));
    }
}

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
    private final com.pangochain.backend.user.UserRepository userRepository;

    @org.springframework.beans.factory.annotation.Value("${fabric.chaincode-name:legalcc}")
    private String chaincodeName;

    @org.springframework.beans.factory.annotation.Value("${fabric.msp-id:FirmAMSP}")
    private String gatewayMspId;

    /**
     * GET /api/ledger/blocks — recent ledger-anchored events grouped by the
     * Fabric block that committed them. Block numbers and chain height come
     * live from qscc (GetBlockByTxID / GetChainInfo); when qscc is
     * unavailable the fields are null and the UI renders nothing for them.
     * All transactions are submitted through the server-managed gateway
     * identity (custodial MSP), reported as submittingMsp.
     */
    @PreAuthorize("hasAnyRole('MANAGING_PARTNER','IT_ADMIN','REGULATOR')")
    @GetMapping("/blocks")
    public ResponseEntity<Map<String, Object>> recentBlocks(
            @RequestParam(defaultValue = "12") int limit) {
        var pageable = org.springframework.data.domain.PageRequest.of(0, Math.min(Math.max(limit, 1), 30));
        var anchored = auditLogRepository.findByFabricTxIdNotNullOrderByTimestampDesc(pageable).getContent();

        String channel = null;
        Long height = null;
        if (fabricGatewayService != null) {
            channel = fabricGatewayService.channelName();
            var h = fabricGatewayService.chainHeight();
            if (h.isPresent()) height = h.getAsLong();
        }

        var grouped = new java.util.LinkedHashMap<Long, java.util.List<Map<String, Object>>>();
        for (var e : anchored) {
            Long blockNo = null;
            if (fabricGatewayService != null) {
                var b = fabricGatewayService.blockNumberForTx(e.getFabricTxId());
                if (b.isPresent()) blockNo = b.getAsLong();
            }
            var actor = e.getActorId() != null
                    ? userRepository.findById(e.getActorId())
                        .map(com.pangochain.backend.user.User::getFullName).orElse("")
                    : "";
            var row = new java.util.LinkedHashMap<String, Object>();
            row.put("txId", e.getFabricTxId());
            row.put("eventType", e.getEventType());
            row.put("actor", actor);
            row.put("actorRole", e.getActorRole() == null ? "" : e.getActorRole());
            row.put("resourceType", e.getResourceType() == null ? "" : e.getResourceType());
            row.put("resourceId", e.getResourceId() == null ? "" : e.getResourceId());
            row.put("timestamp", e.getTimestamp().toString());
            grouped.computeIfAbsent(blockNo, k -> new java.util.ArrayList<>()).add(row);
        }

        var blocks = new java.util.ArrayList<Map<String, Object>>();
        grouped.entrySet().stream()
                .sorted((a, b) -> {
                    if (a.getKey() == null) return 1;
                    if (b.getKey() == null) return -1;
                    return Long.compare(b.getKey(), a.getKey());
                })
                .forEach(en -> {
                    var m = new java.util.LinkedHashMap<String, Object>();
                    m.put("blockNumber", en.getKey());
                    m.put("chaincode", chaincodeName);
                    m.put("transactions", en.getValue());
                    blocks.add(m);
                });

        var out = new java.util.LinkedHashMap<String, Object>();
        out.put("channel", channel);
        out.put("height", height);
        out.put("submittingMsp", gatewayMspId);
        out.put("blocks", blocks);
        return ResponseEntity.ok(out);
    }

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

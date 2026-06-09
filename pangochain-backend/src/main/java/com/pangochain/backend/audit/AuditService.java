package com.pangochain.backend.audit;

import com.pangochain.backend.blockchain.FabricException;
import com.pangochain.backend.blockchain.FabricGatewayService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuditService {

    private final AuditLogRepository auditLogRepository;

    @Autowired(required = false)
    private FabricGatewayService fabricGatewayService;

    /**
     * Write an audit entry to BOTH PostgreSQL and Fabric.
     * Async + separate transaction so audit writes never block or rollback the caller.
     * The PostgreSQL INSERT-only trigger enforces append-only at DB level.
     * If Fabric is unavailable the PostgreSQL write still succeeds (fabric_tx_id = null).
     */
    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void log(String eventType, UUID actorId, String resourceType,
                    String resourceId, String fabricTxId, String metadataJson) {
        // Layer 2: anchor to Fabric ledger if available
        String auditFabricTxId = fabricTxId;
        if (fabricGatewayService != null && auditFabricTxId == null) {
            try {
                auditFabricTxId = fabricGatewayService.submitTransaction(
                        "LogAuditEvent",
                        eventType,
                        actorId != null ? actorId.toString() : "system",
                        "PangoChain",
                        resourceId != null ? resourceId : "",
                        metadataJson != null ? metadataJson : "{}",
                        "");
            } catch (FabricException e) {
                log.warn("Fabric audit anchor failed for {}: {}", eventType, e.getMessage());
            }
        }

        try {
            AuditLog entry = AuditLog.builder()
                    .eventType(eventType)
                    .actorId(actorId)
                    .resourceType(resourceType)
                    .resourceId(resourceId)
                    .fabricTxId(auditFabricTxId)
                    .metadataJson(metadataJson)
                    .build();
            auditLogRepository.save(entry);
        } catch (Exception e) {
            log.error("Failed to write audit log entry: eventType={}, actorId={}", eventType, actorId, e);
        }
    }

    /** Overload for system-generated events (no UUID actor — uses string identity). */
    @Async
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void log(String eventType, String actorIdStr, String actorOrg,
                    String resourceType, String resourceId, String fabricTxId,
                    String metadataJson, String ipAddress) {
        String auditFabricTxId = fabricTxId;
        if (fabricGatewayService != null && auditFabricTxId == null) {
            try {
                auditFabricTxId = fabricGatewayService.submitTransaction(
                        "LogAuditEvent", eventType, actorIdStr, actorOrg,
                        resourceId != null ? resourceId : "",
                        metadataJson != null ? metadataJson : "{}", "");
            } catch (FabricException e) {
                log.warn("Fabric audit anchor failed for {}: {}", eventType, e.getMessage());
            }
        }

        try {
            AuditLog entry = AuditLog.builder()
                    .eventType(eventType)
                    .actorId(null)
                    .resourceType(resourceType)
                    .resourceId(resourceId)
                    .fabricTxId(auditFabricTxId)
                    .metadataJson(metadataJson != null ? metadataJson
                            : String.format("{\"actor\":\"%s\",\"org\":\"%s\"}", actorIdStr, actorOrg))
                    .build();
            auditLogRepository.save(entry);
        } catch (Exception e) {
            log.error("Failed to write system audit log: eventType={}", eventType, e);
        }
    }
}

package com.pangochain.backend.audit;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Repository
public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {
    Page<AuditLog> findByActorIdOrderByTimestampDesc(UUID actorId, Pageable pageable);
    List<AuditLog> findByTimestampAfter(Instant since);
    List<AuditLog> findByTimestampBetweenOrderByTimestampDesc(Instant from, Instant to);
    Page<AuditLog> findByResourceId(String resourceId, Pageable pageable);
    Page<AuditLog> findByEventType(String eventType, Pageable pageable);
    Page<AuditLog> findAllByOrderByTimestampDesc(Pageable pageable);
    Page<AuditLog> findByResourceIdAndEventType(String resourceId, String eventType, Pageable pageable);
    List<AuditLog> findByFabricTxId(String fabricTxId);
    long countByActorId(UUID actorId);
}

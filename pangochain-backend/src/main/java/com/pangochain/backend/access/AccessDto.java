package com.pangochain.backend.access;

import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.UUID;

@Data
@Builder
public class AccessDto {
    private UUID id;
    private UUID docId;
    private UUID userId;
    private String userEmail;
    private String userFullName;
    private String grantedByEmail;
    private String capability;
    private Instant grantedAt;
    private Instant expiresAt;
    /** "committed" when the ledger anchor landed inline; "pending" when queued for durable retry. */
    private String ledgerSyncStatus;
    /** Outbox row id when {@code ledgerSyncStatus} is "pending"; null otherwise. */
    private UUID pendingAnchorId;
}

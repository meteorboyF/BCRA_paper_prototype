package com.pangochain.backend.access;

import java.util.UUID;

/** Body returned when a revoke's ledger anchor is still PENDING (HTTP 202). */
public record RevokeResponseDto(String ledgerSyncStatus, UUID pendingAnchorId) {}

package com.pangochain.backend.cases.dto;

import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.UUID;

@Data
@Builder
public class CaseDto {
    private UUID id;
    private String title;
    private String description;
    private String caseType;
    private String clientName;
    private String opposingParty;
    private String relatedParties;
    private UUID firmId;
    private String firmName;
    private String createdByEmail;
    private String status;
    private String fabricTxId;
    private long documentCount;
    private Instant createdAt;
    private Instant closedAt;
}

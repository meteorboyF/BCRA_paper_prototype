package com.pangochain.backend.document.dto;

import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.UUID;

@Data
@Builder
public class DocumentDto {
    private UUID id;
    private UUID caseId;
    private String fileName;
    private String ipfsCid;
    private String documentHash;
    private String fabricTxId;
    private String ownerEmail;
    private int version;
    private UUID previousVersionId;
    private String status;
    private boolean keyRotationPending;
    private String category;
    private boolean confidential;
    private Instant createdAt;
}

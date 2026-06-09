package com.pangochain.backend.cases.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class CaseCreateRequest {
    @NotBlank
    private String title;
    private String description;
    private String caseType;
    private String clientName;
    private String opposingParty;
    private String relatedParties;
    /** Set true when the creator has reviewed and accepted any conflict-of-interest warning. */
    private boolean conflictCheckAcknowledged;
}

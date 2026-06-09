package com.pangochain.backend.hearing;

import java.time.Instant;
import java.util.UUID;

public record HearingDto(
        UUID id,
        UUID caseId,
        String caseTitle,
        String title,
        Instant hearingDate,
        String location,
        String courtName,
        String hearingType,
        String notes,
        String createdByName,
        Instant createdAt
) {
    public static HearingDto from(Hearing h) {
        return new HearingDto(
                h.getId(),
                h.getLegalCase().getId(),
                h.getLegalCase().getTitle(),
                h.getTitle(),
                h.getHearingDate(),
                h.getLocation(),
                h.getCourtName(),
                h.getHearingType(),
                h.getNotes(),
                h.getCreatedBy() != null ? h.getCreatedBy().getFullName() : null,
                h.getCreatedAt()
        );
    }
}

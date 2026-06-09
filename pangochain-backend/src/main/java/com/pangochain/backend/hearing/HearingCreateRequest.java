package com.pangochain.backend.hearing;

import java.time.Instant;
import java.util.UUID;

public record HearingCreateRequest(
        UUID caseId,
        String title,
        Instant hearingDate,
        String location,
        String courtName,
        String hearingType,
        String notes
) {}

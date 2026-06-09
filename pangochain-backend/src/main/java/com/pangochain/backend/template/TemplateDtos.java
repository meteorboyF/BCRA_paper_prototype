package com.pangochain.backend.template;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.Instant;
import java.util.UUID;

public final class TemplateDtos {

    private TemplateDtos() {}

    /** A template offered in the library. fieldsJson is a raw JSON array the UI renders as a form. */
    public record TemplateDto(
            UUID id, String templateKey, String name, String category, int version,
            String description, String fieldsJson, String body) {}

    /** Records that a template was used to produce a document on a case. */
    public record RecordGenerationRequest(
            @NotNull UUID templateId,
            @NotNull UUID caseId,
            UUID documentId,
            @NotBlank String paramHash) {}

    public record GenerationDto(
            UUID id, UUID templateId, String templateKey, int templateVersion,
            UUID caseId, UUID documentId, String paramHash, UUID generatedBy,
            String fabricTxId, Instant createdAt) {}
}

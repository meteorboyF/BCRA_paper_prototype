package com.pangochain.backend.template;

import com.pangochain.backend.template.TemplateDtos.GenerationDto;
import com.pangochain.backend.template.TemplateDtos.RecordGenerationRequest;
import com.pangochain.backend.template.TemplateDtos.TemplateDto;
import com.pangochain.backend.user.User;
import com.pangochain.backend.user.UserRepository;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/** Smart Contract Template Engine — versioned legal-document templates for legal staff. */
@RestController
@RequestMapping("/api/templates")
@RequiredArgsConstructor
public class TemplateController {

    private static final String LEGAL_STAFF =
            "hasAnyRole('MANAGING_PARTNER','PARTNER_SENIOR','PARTNER_JUNIOR','ASSOCIATE_SENIOR','ASSOCIATE_JUNIOR','PARALEGAL')";

    private final TemplateService templateService;
    private final UserRepository userRepository;

    @PreAuthorize(LEGAL_STAFF)
    @GetMapping
    public ResponseEntity<List<TemplateDto>> list() {
        return ResponseEntity.ok(templateService.listTemplates());
    }

    @PreAuthorize(LEGAL_STAFF)
    @GetMapping("/{id}")
    public ResponseEntity<TemplateDto> get(@PathVariable UUID id) {
        return ResponseEntity.ok(templateService.getTemplate(id));
    }

    @PreAuthorize(LEGAL_STAFF)
    @PostMapping("/record-generation")
    public ResponseEntity<GenerationDto> recordGeneration(
            @Valid @RequestBody RecordGenerationRequest req,
            @AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.ok(templateService.recordGeneration(req, resolve(principal)));
    }

    @PreAuthorize(LEGAL_STAFF)
    @GetMapping("/generations/{caseId}")
    public ResponseEntity<List<GenerationDto>> generationsForCase(@PathVariable UUID caseId) {
        return ResponseEntity.ok(templateService.generationsForCase(caseId));
    }

    private User resolve(UserDetails principal) {
        return userRepository.findByEmail(principal.getUsername())
                .orElseThrow(() -> new IllegalStateException("User not found"));
    }
}

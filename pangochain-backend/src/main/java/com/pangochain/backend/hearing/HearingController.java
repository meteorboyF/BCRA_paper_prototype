package com.pangochain.backend.hearing;

import com.pangochain.backend.audit.AuditService;
import com.pangochain.backend.cases.Case;
import com.pangochain.backend.cases.CaseRepository;
import com.pangochain.backend.user.User;
import com.pangochain.backend.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/hearings")
@RequiredArgsConstructor
public class HearingController {

    private final HearingRepository hearingRepository;
    private final CaseRepository caseRepository;
    private final UserRepository userRepository;
    private final AuditService auditService;

    @PreAuthorize("isAuthenticated()")
    @GetMapping("/by-case/{caseId}")
    public ResponseEntity<List<HearingDto>> byCase(@PathVariable UUID caseId) {
        List<HearingDto> list = hearingRepository
                .findByLegalCaseIdOrderByHearingDateAsc(caseId)
                .stream().map(HearingDto::from).toList();
        return ResponseEntity.ok(list);
    }

    @PreAuthorize("isAuthenticated()")
    @GetMapping("/upcoming")
    public ResponseEntity<List<HearingDto>> upcoming(
            @AuthenticationPrincipal UserDetails principal) {
        User user = resolveUser(principal);
        List<Hearing> hearings;
        if (user.getFirm() != null) {
            hearings = hearingRepository.findUpcomingByFirm(user.getFirm().getId(), Instant.now());
        } else {
            // Client users have no firm — look up via case membership instead
            hearings = hearingRepository.findUpcomingForClient(user.getId(), Instant.now());
        }
        return ResponseEntity.ok(hearings.stream().map(HearingDto::from).toList());
    }

    @PreAuthorize("hasAnyRole('MANAGING_PARTNER','PARTNER_SENIOR','PARTNER_JUNIOR','ASSOCIATE_SENIOR','ASSOCIATE_JUNIOR')")
    @PostMapping
    public ResponseEntity<HearingDto> create(
            @RequestBody HearingCreateRequest req,
            @AuthenticationPrincipal UserDetails principal) {
        User creator = resolveUser(principal);
        Case legalCase = caseRepository.findById(req.caseId())
                .orElseThrow(() -> new IllegalArgumentException("Case not found"));

        Hearing h = Hearing.builder()
                .legalCase(legalCase)
                .title(req.title())
                .hearingDate(req.hearingDate())
                .location(req.location())
                .courtName(req.courtName())
                .hearingType(req.hearingType() != null ? req.hearingType() : "COURT_HEARING")
                .notes(req.notes())
                .createdBy(creator)
                .build();

        h = hearingRepository.save(h);
        auditService.log("HEARING_SCHEDULED", creator.getId(), "HEARING", h.getId().toString(), null,
                String.format("{\"caseId\":\"%s\",\"date\":\"%s\"}", legalCase.getId(), req.hearingDate()));
        return ResponseEntity.ok(HearingDto.from(h));
    }

    @PreAuthorize("hasAnyRole('MANAGING_PARTNER','PARTNER_SENIOR','PARTNER_JUNIOR','ASSOCIATE_SENIOR','ASSOCIATE_JUNIOR')")
    @Transactional
    @PutMapping("/{id}")
    public ResponseEntity<HearingDto> update(
            @PathVariable UUID id,
            @RequestBody HearingCreateRequest req,
            @AuthenticationPrincipal UserDetails principal) {
        User updater = resolveUser(principal);
        Hearing h = hearingRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Hearing not found"));
        if (req.title() != null) h.setTitle(req.title());
        if (req.hearingDate() != null) h.setHearingDate(req.hearingDate());
        if (req.location() != null) h.setLocation(req.location());
        if (req.courtName() != null) h.setCourtName(req.courtName());
        if (req.hearingType() != null) h.setHearingType(req.hearingType());
        if (req.notes() != null) h.setNotes(req.notes());
        h = hearingRepository.save(h);
        auditService.log("HEARING_UPDATED", updater.getId(), "HEARING", id.toString(), null,
                String.format("{\"date\":\"%s\"}", h.getHearingDate()));
        return ResponseEntity.ok(HearingDto.from(h));
    }

    @PreAuthorize("hasAnyRole('MANAGING_PARTNER','PARTNER_SENIOR','PARTNER_JUNIOR','ASSOCIATE_SENIOR','ASSOCIATE_JUNIOR')")
    @PostMapping("/{id}/remind")
    public ResponseEntity<Void> sendReminder(
            @PathVariable UUID id,
            @AuthenticationPrincipal UserDetails principal) {
        User sender = resolveUser(principal);
        Hearing h = hearingRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Hearing not found"));
        auditService.log("HEARING_REMINDER_SENT", sender.getId(), "HEARING", id.toString(), null,
                String.format("{\"hearingDate\":\"%s\",\"priority\":\"HIGH\"}", h.getHearingDate()));
        return ResponseEntity.noContent().build();
    }

    @PreAuthorize("hasAnyRole('MANAGING_PARTNER','PARTNER_SENIOR','PARTNER_JUNIOR','ASSOCIATE_SENIOR','ASSOCIATE_JUNIOR')")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(
            @PathVariable UUID id,
            @AuthenticationPrincipal UserDetails principal) {
        User user = resolveUser(principal);
        hearingRepository.deleteById(id);
        auditService.log("HEARING_DELETED", user.getId(), "HEARING", id.toString(), null, "{}");
        return ResponseEntity.noContent().build();
    }

    private User resolveUser(UserDetails principal) {
        return userRepository.findByEmail(principal.getUsername())
                .orElseThrow(() -> new IllegalStateException("User not found"));
    }
}

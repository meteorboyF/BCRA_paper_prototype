package com.pangochain.backend.milestone;

import com.pangochain.backend.milestone.MilestoneDtos.CreateMilestoneRequest;
import com.pangochain.backend.milestone.MilestoneDtos.MilestoneDto;
import com.pangochain.backend.milestone.MilestoneDtos.UpdateMilestoneRequest;
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

/** Case progress milestones. Read for any authenticated user (incl. client); write for legal staff. */
@RestController
@RequestMapping("/api/cases/{caseId}/milestones")
@RequiredArgsConstructor
public class MilestoneController {

    private static final String LEGAL_STAFF =
            "hasAnyRole('MANAGING_PARTNER','PARTNER_SENIOR','PARTNER_JUNIOR','ASSOCIATE_SENIOR','ASSOCIATE_JUNIOR','PARALEGAL')";

    private final MilestoneService milestoneService;
    private final UserRepository userRepository;

    @PreAuthorize("isAuthenticated()")
    @GetMapping
    public ResponseEntity<List<MilestoneDto>> list(@PathVariable UUID caseId) {
        return ResponseEntity.ok(milestoneService.list(caseId));
    }

    @PreAuthorize(LEGAL_STAFF)
    @PostMapping
    public ResponseEntity<MilestoneDto> create(
            @PathVariable UUID caseId,
            @Valid @RequestBody CreateMilestoneRequest req,
            @AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.ok(milestoneService.create(caseId, req, resolve(principal)));
    }

    @PreAuthorize(LEGAL_STAFF)
    @PutMapping("/{milestoneId}")
    public ResponseEntity<MilestoneDto> update(
            @PathVariable UUID caseId,
            @PathVariable UUID milestoneId,
            @Valid @RequestBody UpdateMilestoneRequest req,
            @AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.ok(milestoneService.update(caseId, milestoneId, req, resolve(principal)));
    }

    @PreAuthorize(LEGAL_STAFF)
    @DeleteMapping("/{milestoneId}")
    public ResponseEntity<Void> delete(
            @PathVariable UUID caseId,
            @PathVariable UUID milestoneId,
            @AuthenticationPrincipal UserDetails principal) {
        milestoneService.delete(caseId, milestoneId, resolve(principal));
        return ResponseEntity.noContent().build();
    }

    private User resolve(UserDetails principal) {
        return userRepository.findByEmail(principal.getUsername())
                .orElseThrow(() -> new IllegalStateException("User not found"));
    }
}

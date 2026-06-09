package com.pangochain.backend.deadline;

import com.pangochain.backend.deadline.DeadlineDtos.CreateDeadlineRequest;
import com.pangochain.backend.deadline.DeadlineDtos.DeadlineDto;
import com.pangochain.backend.deadline.DeadlineDtos.UpdateDeadlineRequest;
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

/** Case deadlines & statute-of-limitations tracker. Read for case staff; write for legal staff. */
@RestController
@RequestMapping("/api/cases/{caseId}/deadlines")
@RequiredArgsConstructor
public class DeadlineController {

    private static final String LEGAL_STAFF =
            "hasAnyRole('MANAGING_PARTNER','PARTNER_SENIOR','PARTNER_JUNIOR','ASSOCIATE_SENIOR','ASSOCIATE_JUNIOR','PARALEGAL')";

    private final DeadlineService deadlineService;
    private final UserRepository userRepository;

    @PreAuthorize("isAuthenticated()")
    @GetMapping
    public ResponseEntity<List<DeadlineDto>> list(@PathVariable UUID caseId) {
        return ResponseEntity.ok(deadlineService.list(caseId));
    }

    @PreAuthorize(LEGAL_STAFF)
    @PostMapping
    public ResponseEntity<DeadlineDto> create(
            @PathVariable UUID caseId,
            @Valid @RequestBody CreateDeadlineRequest req,
            @AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.ok(deadlineService.create(caseId, req, resolve(principal)));
    }

    @PreAuthorize(LEGAL_STAFF)
    @PutMapping("/{deadlineId}")
    public ResponseEntity<DeadlineDto> update(
            @PathVariable UUID caseId,
            @PathVariable UUID deadlineId,
            @Valid @RequestBody UpdateDeadlineRequest req,
            @AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.ok(deadlineService.update(caseId, deadlineId, req, resolve(principal)));
    }

    @PreAuthorize(LEGAL_STAFF)
    @DeleteMapping("/{deadlineId}")
    public ResponseEntity<Void> delete(
            @PathVariable UUID caseId,
            @PathVariable UUID deadlineId,
            @AuthenticationPrincipal UserDetails principal) {
        deadlineService.delete(caseId, deadlineId, resolve(principal));
        return ResponseEntity.noContent().build();
    }

    private User resolve(UserDetails principal) {
        return userRepository.findByEmail(principal.getUsername())
                .orElseThrow(() -> new IllegalStateException("User not found"));
    }
}

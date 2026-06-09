package com.pangochain.backend.redaction;

import com.pangochain.backend.redaction.RedactionDtos.RecordRedactionRequest;
import com.pangochain.backend.redaction.RedactionDtos.RedactionDto;
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

/** Client-side document redaction — records the original->redacted relationship after upload. */
@RestController
@RequestMapping("/api/documents/{originalDocId}/redactions")
@RequiredArgsConstructor
public class RedactionController {

    private static final String LEGAL_STAFF =
            "hasAnyRole('MANAGING_PARTNER','PARTNER_SENIOR','PARTNER_JUNIOR','ASSOCIATE_SENIOR','ASSOCIATE_JUNIOR','PARALEGAL')";

    private final RedactionService redactionService;
    private final UserRepository userRepository;

    @PreAuthorize(LEGAL_STAFF)
    @PostMapping
    public ResponseEntity<RedactionDto> record(
            @PathVariable UUID originalDocId,
            @Valid @RequestBody RecordRedactionRequest req,
            @AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.ok(redactionService.record(originalDocId, req, resolve(principal)));
    }

    @PreAuthorize("isAuthenticated()")
    @GetMapping
    public ResponseEntity<List<RedactionDto>> list(@PathVariable UUID originalDocId) {
        return ResponseEntity.ok(redactionService.forDocument(originalDocId));
    }

    private User resolve(UserDetails principal) {
        return userRepository.findByEmail(principal.getUsername())
                .orElseThrow(() -> new IllegalStateException("User not found"));
    }
}

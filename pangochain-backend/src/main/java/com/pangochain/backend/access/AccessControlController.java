package com.pangochain.backend.access;

import com.pangochain.backend.user.User;
import com.pangochain.backend.user.UserRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/access")
@RequiredArgsConstructor
public class AccessControlController {

    private final AccessControlService accessControlService;
    private final UserRepository userRepository;

    public record GrantBatchRequest(@NotEmpty List<GrantAccessRequest> grants) {}
    public record BatchItemResult(String docId, String granteeId, boolean ok, String error) {}

    /**
     * POST /api/access/grant-batch — distribute access across many (document, grantee) pairs
     * in one request (Jira-style bulk distribute). Each pair is granted independently: a
     * single failure (e.g. capability cap exceeded) does not abort the rest; per-item results
     * are returned. The browser pre-wraps the document key for each grantee (ECIES) per item.
     */
    @PreAuthorize("hasAnyRole('MANAGING_PARTNER','PARTNER_SENIOR','PARTNER_JUNIOR','ASSOCIATE_SENIOR','ASSOCIATE_JUNIOR','PARALEGAL')")
    @PostMapping("/grant-batch")
    public ResponseEntity<List<BatchItemResult>> grantBatch(
            @Valid @RequestBody GrantBatchRequest req,
            @AuthenticationPrincipal UserDetails principal) {
        User granter = resolveUser(principal);
        List<BatchItemResult> results = new ArrayList<>();
        for (GrantAccessRequest g : req.grants()) {
            try {
                // Each grant() is its own proxied transaction, so one failure won't roll back
                // the successful grants in the batch.
                accessControlService.grant(g, granter);
                results.add(new BatchItemResult(g.getDocId(), g.getGranteeId(), true, null));
            } catch (Exception e) {
                results.add(new BatchItemResult(g.getDocId(), g.getGranteeId(), false, e.getMessage()));
            }
        }
        return ResponseEntity.ok(results);
    }

    /** POST /api/access/grant — browser sends ECIES-wrapped key for the grantee */
    @PreAuthorize("hasAnyRole('MANAGING_PARTNER','PARTNER_SENIOR','PARTNER_JUNIOR','ASSOCIATE_SENIOR','ASSOCIATE_JUNIOR','PARALEGAL')")
    @PostMapping("/grant")
    public ResponseEntity<AccessDto> grant(
            @Valid @RequestBody GrantAccessRequest req,
            @AuthenticationPrincipal UserDetails principal) {
        User granter = resolveUser(principal);
        return ResponseEntity.ok(accessControlService.grant(req, granter));
    }

    /** DELETE /api/access/{docId}/user/{userId} */
    @PreAuthorize("hasAnyRole('MANAGING_PARTNER','PARTNER_SENIOR','PARTNER_JUNIOR','ASSOCIATE_SENIOR','ASSOCIATE_JUNIOR','PARALEGAL')")
    @DeleteMapping("/{docId}/user/{userId}")
    public ResponseEntity<Void> revoke(
            @PathVariable String docId,
            @PathVariable String userId,
            @AuthenticationPrincipal UserDetails principal) {
        User revoker = resolveUser(principal);
        accessControlService.revoke(docId, userId, revoker);
        return ResponseEntity.noContent().build();
    }

    /** GET /api/access/{docId} — returns current ACL for a document */
    @PreAuthorize("isAuthenticated()")
    @GetMapping("/{docId}")
    public ResponseEntity<List<AccessDto>> list(
            @PathVariable UUID docId,
            @AuthenticationPrincipal UserDetails principal) {
        User requester = resolveUser(principal);
        return ResponseEntity.ok(accessControlService.listForDoc(docId, requester));
    }

    private User resolveUser(UserDetails principal) {
        return userRepository.findByEmail(principal.getUsername())
                .orElseThrow(() -> new IllegalStateException("User not found"));
    }
}

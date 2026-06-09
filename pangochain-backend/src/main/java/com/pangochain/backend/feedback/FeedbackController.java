package com.pangochain.backend.feedback;

import com.pangochain.backend.feedback.FeedbackService.FeedbackDto;
import com.pangochain.backend.feedback.FeedbackService.SatisfactionSummary;
import com.pangochain.backend.user.User;
import com.pangochain.backend.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/feedback")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class FeedbackController {

    private final FeedbackService feedbackService;
    private final UserRepository userRepository;

    @PreAuthorize("hasAnyRole('CLIENT_PRIMARY','CLIENT_SECONDARY','CLIENT_CORP_ADMIN')")
    @PostMapping
    public ResponseEntity<FeedbackDto> submit(
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal UserDetails principal) {
        UUID caseId = body.get("caseId") != null ? UUID.fromString(body.get("caseId").toString()) : null;
        int rating = ((Number) body.getOrDefault("rating", 0)).intValue();
        String comment = body.get("comment") != null ? body.get("comment").toString() : null;
        String context = body.get("context") != null ? body.get("context").toString() : "GENERAL";
        return ResponseEntity.ok(feedbackService.submit(resolve(principal), caseId, rating, comment, context));
    }

    @PreAuthorize("hasAnyRole('CLIENT_PRIMARY','CLIENT_SECONDARY','CLIENT_CORP_ADMIN')")
    @GetMapping("/mine")
    public ResponseEntity<List<FeedbackDto>> mine(@AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.ok(feedbackService.mine(resolve(principal)));
    }

    @PreAuthorize("hasAnyRole('MANAGING_PARTNER','IT_ADMIN')")
    @GetMapping("/summary")
    public ResponseEntity<SatisfactionSummary> summary() {
        return ResponseEntity.ok(feedbackService.summary());
    }

    private User resolve(UserDetails principal) {
        return userRepository.findByEmail(principal.getUsername())
                .orElseThrow(() -> new IllegalStateException("User not found"));
    }
}

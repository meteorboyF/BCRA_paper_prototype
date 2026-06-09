package com.pangochain.backend.classification;

import com.pangochain.backend.classification.ClassificationService.Suggestion;
import com.pangochain.backend.user.User;
import com.pangochain.backend.user.UserRepository;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/documents/classify")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class ClassificationController {

    private final ClassificationService classificationService;
    private final UserRepository userRepository;

    public record ClassifyRequest(
            String fileName,
            @Size(max = 20_000) String previewText) {}

    @PostMapping
    public ResponseEntity<Suggestion> classify(
            @RequestBody ClassifyRequest req,
            @AuthenticationPrincipal UserDetails principal) {
        User user = userRepository.findByEmail(principal.getUsername()).orElse(null);
        return ResponseEntity.ok(classificationService.classify(req.fileName(), req.previewText(), user));
    }
}

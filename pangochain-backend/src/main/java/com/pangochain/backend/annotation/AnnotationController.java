package com.pangochain.backend.annotation;

import com.pangochain.backend.annotation.AnnotationDtos.AnnotationDto;
import com.pangochain.backend.annotation.AnnotationDtos.CreateAnnotationRequest;
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

/** Real-time collaborative annotation — REST CRUD; live fan-out is over STOMP. */
@RestController
@RequestMapping("/api/documents/{documentId}/annotations")
@RequiredArgsConstructor
public class AnnotationController {

    private final AnnotationService annotationService;
    private final UserRepository userRepository;

    @PreAuthorize("isAuthenticated()")
    @GetMapping
    public ResponseEntity<List<AnnotationDto>> list(
            @PathVariable UUID documentId,
            @AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.ok(annotationService.list(documentId, resolve(principal)));
    }

    @PreAuthorize("isAuthenticated()")
    @PostMapping
    public ResponseEntity<AnnotationDto> add(
            @PathVariable UUID documentId,
            @Valid @RequestBody CreateAnnotationRequest req,
            @AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.ok(annotationService.add(documentId, req, resolve(principal)));
    }

    @PreAuthorize("isAuthenticated()")
    @PostMapping("/{annotationId}/resolve")
    public ResponseEntity<AnnotationDto> resolve(
            @PathVariable UUID documentId,
            @PathVariable UUID annotationId,
            @AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.ok(annotationService.resolve(annotationId, resolve(principal)));
    }

    private User resolve(UserDetails principal) {
        return userRepository.findByEmail(principal.getUsername())
                .orElseThrow(() -> new IllegalStateException("User not found"));
    }
}

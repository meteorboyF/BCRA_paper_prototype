package com.pangochain.backend.privacy;

import com.pangochain.backend.privacy.PrivacyService.*;
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
@RequestMapping("/api/privacy")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class PrivacyController {

    private final PrivacyService privacyService;
    private final UserRepository userRepository;

    @GetMapping("/data-inventory")
    public ResponseEntity<List<InventoryItem>> inventory(@AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.ok(privacyService.dataInventory(resolve(principal)));
    }

    @PostMapping("/deletion-requests")
    public ResponseEntity<DeletionRequestDto> submit(
            @RequestBody Map<String, String> body,
            @AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.ok(privacyService.submitDeletionRequest(resolve(principal), body.get("reason")));
    }

    @GetMapping("/deletion-requests/mine")
    public ResponseEntity<List<DeletionRequestDto>> mine(@AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.ok(privacyService.myRequests(resolve(principal)));
    }

    @PreAuthorize("hasAnyRole('MANAGING_PARTNER','IT_ADMIN')")
    @GetMapping("/deletion-requests")
    public ResponseEntity<List<DeletionRequestAdminDto>> all() {
        return ResponseEntity.ok(privacyService.allRequests());
    }

    @PreAuthorize("hasAnyRole('MANAGING_PARTNER','IT_ADMIN')")
    @PostMapping("/deletion-requests/{id}/process")
    public ResponseEntity<DeletionRequestDto> process(
            @PathVariable UUID id,
            @RequestBody Map<String, String> body,
            @AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.ok(privacyService.process(id, body.get("status"), body.get("resolution"), resolve(principal)));
    }

    private User resolve(UserDetails principal) {
        return userRepository.findByEmail(principal.getUsername())
                .orElseThrow(() -> new IllegalStateException("User not found"));
    }
}

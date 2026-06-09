package com.pangochain.backend.esignature;

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

@RestController
@RequestMapping("/api/signatures")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class ESignatureController {

    private final ESignatureService signatureService;
    private final UserRepository userRepository;

    /**
     * POST /api/signatures/{docId}/sign
     * Browser decrypts document, shows SHA-256 hash to signer, signer confirms,
     * browser signs the hash with ECIES private key and POSTs here.
     */
    @PostMapping("/{docId}/sign")
    public ResponseEntity<ESignatureDto> sign(
            @PathVariable UUID docId,
            @Valid @RequestBody SignDocumentRequest req,
            @AuthenticationPrincipal UserDetails principal) {
        User signer = resolveUser(principal);
        return ResponseEntity.ok(signatureService.sign(docId, req, signer));
    }

    /**
     * GET /api/signatures/{docId}
     * Returns all signatures for a document (public — shows signed badge to all users).
     */
    @GetMapping("/{docId}")
    public ResponseEntity<List<ESignatureDto>> listForDocument(@PathVariable UUID docId) {
        return ResponseEntity.ok(signatureService.listForDocument(docId));
    }

    private User resolveUser(UserDetails principal) {
        return userRepository.findByEmail(principal.getUsername())
                .orElseThrow(() -> new IllegalStateException("Authenticated user not found"));
    }
}

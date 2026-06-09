package com.pangochain.backend.document;

import com.pangochain.backend.blockchain.FabricException;
import com.pangochain.backend.document.dto.DocumentDto;
import com.pangochain.backend.document.dto.DocumentUploadRequest;
import com.pangochain.backend.user.User;
import com.pangochain.backend.user.UserRepository;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.data.domain.Page;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/documents")
@RequiredArgsConstructor
public class DocumentController {

    private final DocumentService documentService;
    private final UserRepository userRepository;

    /**
     * POST /api/documents/upload
     * Server receives only ciphertext — plaintext never transmitted.
     * AES-256-GCM encryption occurs in the browser via WebCrypto API before this endpoint is called.
     * Accepts IV+ciphertext + metadata, pins to IPFS, anchors on Fabric.
     */
    @PreAuthorize("hasAnyRole('MANAGING_PARTNER','PARTNER_SENIOR','PARTNER_JUNIOR','ASSOCIATE_SENIOR','ASSOCIATE_JUNIOR','PARALEGAL','CLIENT_PRIMARY','CLIENT_SECONDARY','CLIENT_CORP_ADMIN')")
    @PostMapping("/upload")
    public ResponseEntity<DocumentDto> upload(
            @Valid @RequestBody DocumentUploadRequest req,
            @AuthenticationPrincipal UserDetails principal) {
        User uploader = resolveUser(principal);
        DocumentDto dto = documentService.upload(req, uploader);
        return ResponseEntity.ok(dto);
    }

    /**
     * GET /api/documents/{id}/ciphertext
     * Returns raw ciphertext bytes (IPFS content). Browser decrypts with WebCrypto.
     * Requires JWT + Fabric CheckAccess (two-layer ACL).
     */
    @PreAuthorize("isAuthenticated()")
    @GetMapping("/{id}/ciphertext")
    public ResponseEntity<byte[]> downloadCiphertext(
            @PathVariable UUID id,
            @AuthenticationPrincipal UserDetails principal) throws FabricException {
        User requester = resolveUser(principal);
        byte[] ciphertext = documentService.downloadCiphertext(id, requester);
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"encrypted.bin\"")
                .body(ciphertext);
    }

    /**
     * GET /api/documents/{id}/wrapped-key
     * Returns the ECIES-wrapped document key for the calling user.
     * Browser uses this with the private key to recover the AES doc key.
     */
    @PreAuthorize("isAuthenticated()")
    @GetMapping("/{id}/wrapped-key")
    public ResponseEntity<String> getWrappedKey(
            @PathVariable UUID id,
            @AuthenticationPrincipal UserDetails principal) throws FabricException {
        User requester = resolveUser(principal);
        String token = documentService.getWrappedKey(id, requester);
        return ResponseEntity.ok(token);
    }

    /**
     * POST /api/documents/{id}/key-rotation-complete
     * Called by the document owner's browser after it has re-encrypted the document
     * and distributed new wrapped key tokens to all remaining authorised users.
     * Clears the key_rotation_pending flag so the UI no longer prompts for rotation.
     */
    @PreAuthorize("isAuthenticated()")
    @PostMapping("/{id}/key-rotation-complete")
    public ResponseEntity<Void> completeKeyRotation(
            @PathVariable UUID id,
            @AuthenticationPrincipal UserDetails principal) {
        User requester = resolveUser(principal);
        documentService.completeKeyRotation(id, requester);
        return ResponseEntity.noContent().build();
    }

    /**
     * GET /api/documents/by-case/{caseId}
     * Lists all active documents for a case (metadata only, no ciphertext).
     */
    @PreAuthorize("isAuthenticated()")
    @GetMapping("/by-case/{caseId}")
    public ResponseEntity<List<DocumentDto>> listByCase(
            @PathVariable UUID caseId,
            @RequestParam(defaultValue = "100") int limit) {
        return ResponseEntity.ok(documentService.listByCase(caseId, limit));
    }

    /**
     * GET /api/documents
     * Lists all documents accessible to the calling user.
     */
    @PreAuthorize("isAuthenticated()")
    @GetMapping
    public ResponseEntity<Map<String, Object>> listAll(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) String category,
            @AuthenticationPrincipal UserDetails principal) {
        User user = resolveUser(principal);
        Page<DocumentDto> docs = documentService.listAccessibleByUser(user, page, size, q, category);
        return ResponseEntity.ok(Map.of(
                "content", docs.getContent(),
                "totalElements", docs.getTotalElements(),
                "totalPages", docs.getTotalPages(),
                "number", docs.getNumber()
        ));
    }

    /**
     * GET /api/documents/{id}/history
     * Returns Fabric ledger history for a document (all state changes).
     */
    @PreAuthorize("isAuthenticated()")
    @GetMapping("/{id}/history")
    public ResponseEntity<String> history(
            @PathVariable UUID id,
            @AuthenticationPrincipal UserDetails principal) {
        User requester = resolveUser(principal);
        String historyJson = documentService.getDocumentHistory(id, requester);
        return ResponseEntity.ok(historyJson);
    }

    /**
     * GET /api/documents/{id}/versions
     * Full version lineage (oldest → newest) for a document, traversing previous_version_id.
     */
    @PreAuthorize("isAuthenticated()")
    @GetMapping("/{id}/versions")
    public ResponseEntity<List<DocumentDto>> versions(
            @PathVariable UUID id,
            @AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.ok(documentService.listVersions(id, resolveUser(principal)));
    }

    /**
     * POST /api/documents/{id}/restore
     * Restore an earlier version as a new head of the chain (reuses ciphertext + key grants).
     */
    @PreAuthorize("hasAnyRole('MANAGING_PARTNER','PARTNER_SENIOR','PARTNER_JUNIOR','ASSOCIATE_SENIOR','ASSOCIATE_JUNIOR','PARALEGAL')")
    @PostMapping("/{id}/restore")
    public ResponseEntity<DocumentDto> restore(
            @PathVariable UUID id,
            @AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.ok(documentService.restore(id, resolveUser(principal)));
    }

    /**
     * PUT /api/documents/{id}/metadata
     * Update document category and confidential flag (metadata only, no ciphertext).
     */
    @PreAuthorize("hasAnyRole('MANAGING_PARTNER','PARTNER_SENIOR','PARTNER_JUNIOR','ASSOCIATE_SENIOR','ASSOCIATE_JUNIOR','PARALEGAL')")
    @PutMapping("/{id}/metadata")
    public ResponseEntity<DocumentDto> updateMetadata(
            @PathVariable UUID id,
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal UserDetails principal) {
        User requester = resolveUser(principal);
        String category = body.containsKey("category") ? (String) body.get("category") : null;
        Boolean confidential = body.containsKey("confidential") ? (Boolean) body.get("confidential") : null;
        DocumentDto dto = documentService.updateMetadata(id, category, confidential, requester);
        return ResponseEntity.ok(dto);
    }

    private User resolveUser(UserDetails principal) {
        return userRepository.findByEmail(principal.getUsername())
                .orElseThrow(() -> new IllegalStateException("Authenticated user not found"));
    }
}

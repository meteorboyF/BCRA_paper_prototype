package com.pangochain.backend.signingworkflow;

import com.pangochain.backend.signingworkflow.SigningDtos.InitiateRequest;
import com.pangochain.backend.signingworkflow.SigningDtos.SignRequest;
import com.pangochain.backend.signingworkflow.SigningDtos.WorkflowDto;
import com.pangochain.backend.user.User;
import com.pangochain.backend.user.UserRepository;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/** Multi-party signing workflow — legal staff initiate; any signatory signs in order. */
@RestController
@RequestMapping("/api/signing-workflows")
@RequiredArgsConstructor
public class SigningWorkflowController {

    private static final String LEGAL_STAFF =
            "hasAnyRole('MANAGING_PARTNER','PARTNER_SENIOR','PARTNER_JUNIOR','ASSOCIATE_SENIOR','ASSOCIATE_JUNIOR','PARALEGAL')";

    private final SigningWorkflowService service;
    private final UserRepository userRepository;

    @PreAuthorize(LEGAL_STAFF)
    @PostMapping
    public ResponseEntity<WorkflowDto> initiate(
            @Valid @RequestBody InitiateRequest req,
            @AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.ok(service.initiate(req, resolve(principal)));
    }

    @PreAuthorize("isAuthenticated()")
    @GetMapping("/by-document/{documentId}")
    public ResponseEntity<List<WorkflowDto>> forDocument(
            @PathVariable UUID documentId,
            @AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.ok(service.forDocument(documentId, resolve(principal)));
    }

    @PreAuthorize("isAuthenticated()")
    @PostMapping("/{workflowId}/sign")
    public ResponseEntity<WorkflowDto> sign(
            @PathVariable UUID workflowId,
            @Valid @RequestBody SignRequest req,
            @AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.ok(service.sign(workflowId, req, resolve(principal)));
    }

    @PreAuthorize("isAuthenticated()")
    @GetMapping("/{workflowId}/certificate")
    public ResponseEntity<byte[]> certificate(@PathVariable UUID workflowId) {
        byte[] pdf = service.certificate(workflowId);
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_PDF);
        headers.setContentDisposition(ContentDisposition.attachment()
                .filename("signing-certificate_" + workflowId.toString().substring(0, 8) + ".pdf").build());
        return new ResponseEntity<>(pdf, headers, 200);
    }

    private User resolve(UserDetails principal) {
        return userRepository.findByEmail(principal.getUsername())
                .orElseThrow(() -> new IllegalStateException("User not found"));
    }
}

package com.pangochain.backend.report;

import com.pangochain.backend.user.User;
import com.pangochain.backend.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

/** Case Outcome Archive — the On-Chain Permanence Certificate for a case (clients + legal staff). */
@RestController
@RequestMapping("/api/cases/{caseId}/archive")
@RequiredArgsConstructor
public class CaseArchiveController {

    private final CaseArchiveService caseArchiveService;
    private final UserRepository userRepository;

    @PreAuthorize("isAuthenticated()")
    @GetMapping("/permanence-certificate")
    public ResponseEntity<byte[]> certificate(
            @PathVariable UUID caseId,
            @AuthenticationPrincipal UserDetails principal) {
        CaseArchiveService.CertificateResult result =
                caseArchiveService.permanenceCertificate(caseId, resolve(principal));
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_PDF);
        headers.setContentDisposition(ContentDisposition.attachment().filename(result.fileName()).build());
        return new ResponseEntity<>(result.pdf(), headers, 200);
    }

    private User resolve(UserDetails principal) {
        return userRepository.findByEmail(principal.getUsername())
                .orElseThrow(() -> new IllegalStateException("User not found"));
    }
}

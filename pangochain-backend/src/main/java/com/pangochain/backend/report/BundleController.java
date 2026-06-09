package com.pangochain.backend.report;

import com.pangochain.backend.report.BundleService.BundleRequest;
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

/** Court-ready PDF bundle generator — legal staff assemble a filing bundle from case documents. */
@RestController
@RequestMapping("/api/bundles")
@RequiredArgsConstructor
public class BundleController {

    private static final String LEGAL_STAFF =
            "hasAnyRole('MANAGING_PARTNER','PARTNER_SENIOR','PARTNER_JUNIOR','ASSOCIATE_SENIOR','ASSOCIATE_JUNIOR','PARALEGAL')";

    private final BundleService bundleService;
    private final UserRepository userRepository;

    @PreAuthorize(LEGAL_STAFF)
    @PostMapping
    public ResponseEntity<byte[]> generate(
            @Valid @RequestBody BundleRequest req,
            @AuthenticationPrincipal UserDetails principal) {
        BundleService.BundleResult result = bundleService.generate(req, resolve(principal));
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

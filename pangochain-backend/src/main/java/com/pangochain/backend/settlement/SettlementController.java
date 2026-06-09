package com.pangochain.backend.settlement;

import com.pangochain.backend.settlement.SettlementDtos.CreateOfferRequest;
import com.pangochain.backend.settlement.SettlementDtos.OfferDto;
import com.pangochain.backend.settlement.SettlementDtos.RespondRequest;
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

/** Settlement Offer Comparison — lawyers add offers; clients accept/reject them. */
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class SettlementController {

    private static final String LEGAL_STAFF =
            "hasAnyRole('MANAGING_PARTNER','PARTNER_SENIOR','PARTNER_JUNIOR','ASSOCIATE_SENIOR','ASSOCIATE_JUNIOR','PARALEGAL')";

    private final SettlementService settlementService;
    private final UserRepository userRepository;

    @PreAuthorize("isAuthenticated()")
    @GetMapping("/cases/{caseId}/settlement-offers")
    public ResponseEntity<List<OfferDto>> list(@PathVariable UUID caseId) {
        return ResponseEntity.ok(settlementService.listForCase(caseId));
    }

    @PreAuthorize(LEGAL_STAFF)
    @PostMapping("/cases/{caseId}/settlement-offers")
    public ResponseEntity<OfferDto> add(
            @PathVariable UUID caseId,
            @Valid @RequestBody CreateOfferRequest req,
            @AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.ok(settlementService.addOffer(caseId, req, resolve(principal)));
    }

    @PreAuthorize("hasAnyRole('CLIENT_PRIMARY','CLIENT_SECONDARY','CLIENT_CORP_ADMIN')")
    @PostMapping("/settlement-offers/{id}/respond")
    public ResponseEntity<OfferDto> respond(
            @PathVariable UUID id,
            @Valid @RequestBody RespondRequest req,
            @AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.ok(settlementService.respond(id, req, resolve(principal)));
    }

    private User resolve(UserDetails principal) {
        return userRepository.findByEmail(principal.getUsername())
                .orElseThrow(() -> new IllegalStateException("User not found"));
    }
}

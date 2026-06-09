package com.pangochain.backend.cases;

import com.pangochain.backend.cases.conflict.ConflictService;
import com.pangochain.backend.cases.conflict.ConflictService.ConflictCheckRequest;
import com.pangochain.backend.cases.conflict.ConflictService.ConflictCheckResult;
import com.pangochain.backend.cases.dto.CaseCreateRequest;
import com.pangochain.backend.cases.dto.CaseDto;
import com.pangochain.backend.user.User;
import com.pangochain.backend.user.UserRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/cases")
@RequiredArgsConstructor
public class CaseController {

    private final CaseService caseService;
    private final ConflictService conflictService;
    private final UserRepository userRepository;

    @PersistenceContext
    private EntityManager em;

    @PreAuthorize("hasAnyRole('MANAGING_PARTNER','PARTNER_SENIOR','PARTNER_JUNIOR','ASSOCIATE_SENIOR','ASSOCIATE_JUNIOR','PARALEGAL')")
    @PostMapping
    public ResponseEntity<CaseDto> create(
            @Valid @RequestBody CaseCreateRequest req,
            @AuthenticationPrincipal UserDetails principal) {
        User creator = resolveUser(principal);
        return ResponseEntity.ok(caseService.create(req, creator));
    }

    /** POST /api/cases/conflict-check — fuzzy-match prospective party names against existing matters. */
    @PreAuthorize("hasAnyRole('MANAGING_PARTNER','PARTNER_SENIOR','PARTNER_JUNIOR','ASSOCIATE_SENIOR','ASSOCIATE_JUNIOR','PARALEGAL')")
    @PostMapping("/conflict-check")
    public ResponseEntity<ConflictCheckResult> conflictCheck(
            @RequestBody ConflictCheckRequest req,
            @AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.ok(conflictService.check(req, resolveUser(principal)));
    }

    @PreAuthorize("isAuthenticated()")
    @GetMapping
    public ResponseEntity<Page<CaseDto>> list(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @AuthenticationPrincipal UserDetails principal) {
        User user = resolveUser(principal);
        UUID firmId = user.getFirm() != null ? user.getFirm().getId() : null;
        CaseStatus caseStatus = (status != null && !status.isBlank()) ? CaseStatus.valueOf(status) : null;
        return ResponseEntity.ok(caseService.listByFirm(firmId, caseStatus, q, page, size));
    }

    @PreAuthorize("isAuthenticated()")
    @GetMapping("/{id}")
    public ResponseEntity<CaseDto> getById(@PathVariable UUID id) {
        return ResponseEntity.ok(caseService.getById(id));
    }

    /** GET /api/cases/{id}/members — case team (for access distribution + delegation UI). */
    @PreAuthorize("isAuthenticated()")
    @GetMapping("/{id}/members")
    @SuppressWarnings("unchecked")
    public ResponseEntity<List<Map<String, Object>>> members(@PathVariable UUID id) {
        List<Object[]> rows = em.createNativeQuery(
                "SELECT u.id, u.full_name, u.email, u.role, cm.role_in_case, " +
                "(u.public_key_ecies IS NOT NULL) AS has_key " +
                "FROM case_members cm JOIN users u ON u.id = cm.user_id WHERE cm.case_id = :cid " +
                "ORDER BY u.full_name")
                .setParameter("cid", id).getResultList();
        List<Map<String, Object>> out = rows.stream().map(r -> {
            Map<String, Object> m = new java.util.HashMap<>();
            m.put("userId", r[0].toString());
            m.put("fullName", r[1]);
            m.put("email", r[2]);
            m.put("role", r[3]);
            m.put("roleInCase", r[4] != null ? r[4] : "");
            m.put("hasPublicKey", r[5]);
            return m;
        }).toList();
        return ResponseEntity.ok(out);
    }

    @PreAuthorize("hasAnyRole('MANAGING_PARTNER','PARTNER_SENIOR')")
    @PostMapping("/{id}/close")
    public ResponseEntity<CaseDto> close(
            @PathVariable UUID id,
            @AuthenticationPrincipal UserDetails principal) {
        User closer = resolveUser(principal);
        return ResponseEntity.ok(caseService.close(id, closer));
    }

    public record StatusUpdateRequest(String status) {}

    /** PATCH /api/cases/{id}/status — persist dashboard pipeline moves. */
    @PreAuthorize("hasAnyRole('MANAGING_PARTNER','PARTNER_SENIOR','PARTNER_JUNIOR','ASSOCIATE_SENIOR','ASSOCIATE_JUNIOR')")
    @PatchMapping("/{id}/status")
    public ResponseEntity<CaseDto> updateStatus(
            @PathVariable UUID id,
            @RequestBody StatusUpdateRequest req,
            @AuthenticationPrincipal UserDetails principal) {
        User updater = resolveUser(principal);
        return ResponseEntity.ok(caseService.updateStatus(id, CaseStatus.valueOf(req.status()), updater));
    }

    /** Link a client user to a case (lawyer/partner only) */
    @PreAuthorize("hasAnyRole('MANAGING_PARTNER','PARTNER_SENIOR','PARTNER_JUNIOR','ASSOCIATE_SENIOR','ASSOCIATE_JUNIOR')")
    @PostMapping("/{id}/clients")
    @Transactional
    public ResponseEntity<Map<String, String>> addClient(
            @PathVariable UUID id,
            @RequestBody Map<String, String> body,
            @AuthenticationPrincipal UserDetails principal) {
        UUID clientId = UUID.fromString(body.get("clientId"));
        User caller = resolveUser(principal);
        em.createNativeQuery(
                "INSERT INTO case_clients (case_id, client_id, added_by) VALUES (:c, :u, :a) ON CONFLICT DO NOTHING"
        ).setParameter("c", id).setParameter("u", clientId).setParameter("a", caller.getId()).executeUpdate();
        return ResponseEntity.ok(Map.of("status", "linked"));
    }

    /** Get all cases a client is associated with */
    @PreAuthorize("isAuthenticated()")
    @GetMapping("/my-cases")
    @SuppressWarnings("unchecked")
    public ResponseEntity<List<CaseDto>> myCases(@AuthenticationPrincipal UserDetails principal) {
        User user = resolveUser(principal);
        List<UUID> caseIds = em.createNativeQuery(
                "SELECT case_id FROM case_clients WHERE client_id = :uid"
        ).setParameter("uid", user.getId()).getResultList();
        List<CaseDto> result = caseIds.stream()
                .map(cid -> caseService.getById(cid))
                .toList();
        return ResponseEntity.ok(result);
    }

    /** GET /api/cases/{id}/timeline — GetHistoryForKey on Fabric for case events. */
    @PreAuthorize("isAuthenticated()")
    @GetMapping("/{id}/timeline")
    public ResponseEntity<String> timeline(@PathVariable UUID id) {
        String history = caseService.getTimeline(id);
        return ResponseEntity.ok(history);
    }

    private User resolveUser(UserDetails principal) {
        return userRepository.findByEmail(principal.getUsername())
                .orElseThrow(() -> new IllegalStateException("User not found"));
    }
}

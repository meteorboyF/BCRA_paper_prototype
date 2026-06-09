package com.pangochain.backend.caseevent;

import com.pangochain.backend.cases.CaseRepository;
import com.pangochain.backend.user.User;
import com.pangochain.backend.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/case-events")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class CaseEventController {

    private final CaseEventRepository caseEventRepository;
    private final CaseRepository caseRepository;
    private final UserRepository userRepository;

    @GetMapping("/by-case/{caseId}")
    public ResponseEntity<List<Map<String, Object>>> byCase(@PathVariable UUID caseId) {
        List<Map<String, Object>> events = caseEventRepository
                .findByLegalCaseIdOrderByCreatedAtDesc(caseId)
                .stream()
                .map(e -> Map.<String, Object>of(
                        "id", e.getId(),
                        "eventType", e.getEventType(),
                        "title", e.getTitle(),
                        "description", e.getDescription() != null ? e.getDescription() : "",
                        "fabricTxId", e.getFabricTxId() != null ? e.getFabricTxId() : "",
                        "actorName", e.getActor() != null ? e.getActor().getFullName() : "System",
                        "createdAt", e.getCreatedAt()
                ))
                .toList();
        return ResponseEntity.ok(events);
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> create(
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal UserDetails principal) {
        User actor = userRepository.findByEmail(principal.getUsername())
                .orElseThrow();
        UUID caseId = UUID.fromString((String) body.get("caseId"));
        var legalCase = caseRepository.findById(caseId).orElseThrow();

        CaseEvent event = CaseEvent.builder()
                .legalCase(legalCase)
                .eventType((String) body.getOrDefault("eventType", "GENERAL"))
                .title((String) body.get("title"))
                .description((String) body.get("description"))
                .fabricTxId((String) body.get("fabricTxId"))
                .actor(actor)
                .build();

        event = caseEventRepository.save(event);
        return ResponseEntity.ok(Map.of("id", event.getId(), "createdAt", event.getCreatedAt()));
    }
}

package com.pangochain.backend.ai;

import com.pangochain.backend.cases.CaseRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.UUID;
import java.util.List;

@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class AiController {

    private final AiChatService chatService;
    private final AiDocumentService documentService;
    private final AiCaseService caseService;
    private final AiAvailability availability;
    private final CaseRepository caseRepository;

    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> health() {
        return ResponseEntity.ok(Map.of(
                "available", availability.isAvailable(),
                "model", "gpt-4o",
                "message", availability.statusMessage()
        ));
    }

    public record AnalyzeDocRequest(String fileName, String text, UUID documentId) {}

    @PostMapping("/documents/analyze")
    @PreAuthorize("hasAnyRole('LAWYER', 'MANAGING_PARTNER', 'PARALEGAL', 'PARTNER_SENIOR', 'PARTNER_JUNIOR', 'ASSOCIATE_SENIOR', 'ASSOCIATE_JUNIOR')")
    public ResponseEntity<AiDocumentService.DocumentAnalysis> analyzeDocument(@RequestBody AnalyzeDocRequest req) {
        availability.requireAvailable();
        return ResponseEntity.ok(documentService.analyzeDocument(req.fileName(), req.text()));
    }

    @GetMapping("/cases/{caseId}/timeline-check")
    @PreAuthorize("hasAnyRole('LAWYER', 'MANAGING_PARTNER', 'IT_ADMIN', 'PARTNER_SENIOR', 'PARTNER_JUNIOR', 'ASSOCIATE_SENIOR', 'ASSOCIATE_JUNIOR')")
    public ResponseEntity<AiCaseService.TimelineCheckResult> checkTimeline(@PathVariable UUID caseId) {
        return ResponseEntity.ok(caseService.checkTimeline(caseId));
    }

    @GetMapping("/cases/{caseId}/evidence-gaps")
    @PreAuthorize("hasAnyRole('LAWYER', 'MANAGING_PARTNER', 'IT_ADMIN', 'PARTNER_SENIOR', 'PARTNER_JUNIOR', 'ASSOCIATE_SENIOR', 'ASSOCIATE_JUNIOR')")
    public ResponseEntity<AiCaseService.EvidenceGapResult> analyzeEvidenceGaps(@PathVariable UUID caseId) {
        return ResponseEntity.ok(caseService.analyzeEvidenceGaps(caseId));
    }

    @GetMapping("/hearings/{hearingId}/prep")
    @PreAuthorize("hasAnyRole('LAWYER', 'MANAGING_PARTNER', 'PARTNER_SENIOR', 'PARTNER_JUNIOR', 'ASSOCIATE_SENIOR', 'ASSOCIATE_JUNIOR')")
    public ResponseEntity<AiCaseService.HearingPrepBrief> hearingPrep(@PathVariable UUID hearingId) {
        return ResponseEntity.ok(caseService.generateHearingPrep(hearingId));
    }

    @PostMapping("/draft")
    @PreAuthorize("hasAnyRole('LAWYER', 'MANAGING_PARTNER', 'PARTNER_SENIOR', 'PARTNER_JUNIOR', 'ASSOCIATE_SENIOR', 'ASSOCIATE_JUNIOR')")
    public ResponseEntity<AiDocumentService.DraftResult> draftDocument(@RequestBody AiDocumentService.DraftRequest req) {
        var legalCase = caseRepository.findById(req.caseId()).orElseThrow();
        return ResponseEntity.ok(documentService.draftDocument(req, legalCase.getTitle()));
    }

    @PostMapping("/chat")
    @PreAuthorize("hasAnyRole('LAWYER', 'MANAGING_PARTNER', 'PARALEGAL', 'PARTNER_SENIOR', 'PARTNER_JUNIOR', 'ASSOCIATE_SENIOR', 'ASSOCIATE_JUNIOR')")
    public ResponseEntity<AiChatService.ChatResponse> chat(
            @RequestBody AiChatService.ChatRequest req,
            @AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.ok(chatService.chat(req, principal.getUsername()));
    }

    @GetMapping("/cases/{caseId}/chat-history")
    @PreAuthorize("hasAnyRole('LAWYER', 'MANAGING_PARTNER', 'PARALEGAL', 'PARTNER_SENIOR', 'PARTNER_JUNIOR', 'ASSOCIATE_SENIOR', 'ASSOCIATE_JUNIOR')")
    public ResponseEntity<List<AiChatService.ConversationMessage>> chatHistory(
            @PathVariable UUID caseId,
            @RequestParam(required = false) UUID sessionId,
            @AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.ok(chatService.getHistory(caseId, sessionId, principal.getUsername()));
    }

    @GetMapping("/cases/{caseId}/chat-sessions")
    @PreAuthorize("hasAnyRole('LAWYER', 'MANAGING_PARTNER', 'PARALEGAL', 'PARTNER_SENIOR', 'PARTNER_JUNIOR', 'ASSOCIATE_SENIOR', 'ASSOCIATE_JUNIOR')")
    public ResponseEntity<List<AiChatService.ChatSessionSummary>> chatSessions(
            @PathVariable UUID caseId,
            @AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.ok(chatService.getSessions(caseId, principal.getUsername()));
    }

    @PostMapping("/client/chat")
    @PreAuthorize("hasAnyRole('CLIENT_PRIMARY', 'CLIENT_SECONDARY', 'CLIENT_CORP_ADMIN', 'LAWYER', 'MANAGING_PARTNER', 'PARTNER_SENIOR', 'PARTNER_JUNIOR', 'ASSOCIATE_SENIOR', 'ASSOCIATE_JUNIOR')")
    public ResponseEntity<AiChatService.ChatResponse> clientChat(
            @RequestBody AiChatService.ClientChatRequest req,
            @AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.ok(chatService.clientChat(req, principal.getUsername()));
    }
}

package com.pangochain.backend.ai;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class AiController {

    private final AiChatService chatService;
    private final AiDocumentService documentService;
    private final AiCaseService caseService;
    private final AiAvailability availability;

    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> health() {
        return ResponseEntity.ok(Map.of("available", availability.isAvailable(), "model", "gpt-4o"));
    }

    public record AnalyzeDocRequest(String fileName, String text, UUID documentId) {}

    @PostMapping("/documents/analyze")
    @PreAuthorize("hasAnyRole('LAWYER', 'MANAGING_PARTNER', 'PARALEGAL', 'PARTNER_SENIOR', 'PARTNER_JUNIOR', 'ASSOCIATE_SENIOR', 'ASSOCIATE_JUNIOR')")
    public ResponseEntity<AiDocumentService.DocumentAnalysis> analyzeDocument(@RequestBody AnalyzeDocRequest req) {
        availability.requireAvailable();
        return ResponseEntity.ok(documentService.analyzeDocument(req.fileName(), req.text()));
    }
}

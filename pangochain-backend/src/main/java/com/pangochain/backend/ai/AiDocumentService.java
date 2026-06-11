package com.pangochain.backend.ai;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class AiDocumentService {

    protected static final int MAX_CHARS_PER_DOC = 12_000;

    protected final Optional<ChatClient> chatClient;
    protected final AiAvailability availability;

    protected String safe(String text) {
        if (text == null) {
            return "";
        }
        return text.length() > MAX_CHARS_PER_DOC
                ? text.substring(0, MAX_CHARS_PER_DOC) + "\n[... truncated]"
                : text;
    }

    public record DocumentAnalysis(
            String summary,
            String[] keyParties,
            String[] keyDates,
            String[] obligations,
            RiskFlag[] riskFlags,
            String overallRiskLevel
    ) {}

    public record RiskFlag(
            String clause,
            String concern,
            String severity
    ) {}

    public record DraftRequest(
            java.util.UUID caseId,
            String documentType,
            String instructions,
            String[] keyFacts
    ) {}

    public record DraftResult(String title, String draftText, String[] notes) {}

    public DocumentAnalysis analyzeDocument(String fileName, String documentText) {
        availability.requireAvailable();

        String prompt = """
                Analyze this legal document and extract structured information.

                Document name: %s

                Document text:
                %s

                Return a JSON object with:
                - summary: 2-3 sentence executive summary
                - keyParties: array of party names mentioned
                - keyDates: array of important dates mentioned (as strings)
                - obligations: array of key obligations/commitments
                - riskFlags: array of objects {clause: "...", concern: "...", severity: "LOW|MEDIUM|HIGH"}
                  Focus on: unusual clauses, missing standard terms, one-sided terms, liability exposures
                - overallRiskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"

                Respond ONLY with valid JSON.
                """.formatted(fileName == null ? "Untitled document" : fileName, safe(documentText));

        return availability.call(() -> chatClient.orElseThrow(() -> new AiUnavailableException("AI features require OPENAI_API_KEY to be configured."))
                .prompt()
                .system("You are a senior legal analyst. Identify risks that a junior lawyer might miss. Be specific.")
                .user(prompt)
                .call()
                .entity(DocumentAnalysis.class));
    }

    public DraftResult draftDocument(DraftRequest req, String caseTitle) {
        availability.requireAvailable();

        String factsFormatted = req.keyFacts() != null && req.keyFacts().length > 0
                ? String.join("\n- ", req.keyFacts())
                : "None provided";

        String prompt = """
                Draft a professional legal document of type: %s

                Case: %s (ID: %s)

                User instructions: %s

                Key facts to incorporate:
                - %s

                Requirements:
                - Use proper legal document formatting and language
                - Include standard boilerplate for this document type
                - Leave [PLACEHOLDER] where specific details are missing
                - Keep it professional and court-ready

                Return JSON with:
                - title: document title
                - draftText: the complete draft document text (use \\n for newlines)
                - notes: array of notes for the lawyer (what to verify, fill in, customize)

                Respond ONLY with valid JSON.
                """.formatted(req.documentType(), caseTitle, req.caseId(), safe(req.instructions()), factsFormatted);

        return availability.call(() -> chatClient.orElseThrow(() -> new AiUnavailableException("AI features require OPENAI_API_KEY to be configured."))
                .prompt()
                .system("You are an expert legal drafter. Produce professional-quality legal documents.")
                .user(prompt)
                .call()
                .entity(DraftResult.class));
    }
}

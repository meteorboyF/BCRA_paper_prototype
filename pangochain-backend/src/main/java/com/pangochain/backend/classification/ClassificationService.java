package com.pangochain.backend.classification;

import com.pangochain.backend.ai.AiAvailability;
import com.pangochain.backend.user.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Document category classifier. The scoring model here is a transparent keyword/extension
 * heuristic that acts as a drop-in <b>stub</b> for a future fine-tuned text classifier
 * (e.g. a FastAPI sidecar). The contract is identical — {@code classify(fileName, previewText)}
 * returns a category, a 0–100 confidence and a short rationale — so the real model can replace
 * this class without touching callers. Critically, only the filename and a user-supplied
 * plaintext preview are seen here; ciphertext is never sent.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ClassificationService {

    public record Suggestion(String category, int confidence, String rationale) {}

    // Category → indicative keywords. Order also defines tie-break priority.
    private static final Map<String, List<String>> SIGNALS = new LinkedHashMap<>() {{
        put("CONTRACT", List.of("agreement", "contract", "nda", "retainer", "terms", "lease", "clause", "party", "hereby", "whereas"));
        put("EVIDENCE", List.of("exhibit", "evidence", "photo", "screenshot", "log", "recording", "transcript", "statement of"));
        put("CONFESSION", List.of("confession", "admit", "i confess", "guilt", "plea", "admission"));
        put("MEDICAL", List.of("medical", "diagnosis", "patient", "hospital", "clinic", "treatment", "prescription", "injury"));
        put("FINANCIAL", List.of("invoice", "statement", "balance", "payment", "tax", "bank", "financial", "ledger", "receipt", "usd"));
        put("CORRESPONDENCE", List.of("dear", "letter", "email", "memo", "regards", "sincerely", "correspondence", "re:"));
    }};

    private final DocumentClassificationLogRepository logRepository;
    private final Optional<ChatClient> chatClient;
    private final AiAvailability aiAvailability;

    @Transactional
    public Suggestion classify(String fileName, String previewText, User requester) {
        if (aiAvailability.isAvailable() && previewText != null && previewText.length() > 50 && chatClient.isPresent()) {
            try {
                return gptClassify(fileName, previewText, requester);
            } catch (Exception e) {
                log.warn("GPT classification failed, falling back to keyword heuristic: {}", e.getMessage());
            }
        }
        return keywordClassify(fileName, previewText, requester);
    }

    private Suggestion gptClassify(String fileName, String previewText, User requester) {
        record GptResult(String category, int confidence, String rationale) {}

        String prompt = """
                Classify the following legal document excerpt.
                Filename: %s

                Document text (first ~500 words):
                %s

                Return JSON with exactly these fields:
                - category: one of CONTRACT, EVIDENCE, CONFESSION, MEDICAL, FINANCIAL, CORRESPONDENCE, GENERAL
                - confidence: integer 0-100
                - rationale: one sentence explaining the classification
                """.formatted(fileName == null ? "unknown" : fileName,
                previewText.substring(0, Math.min(previewText.length(), 2_000)));

        GptResult result = chatClient.get().prompt()
                .system("You are a legal document classifier. Respond ONLY with valid JSON, no markdown.")
                .user(prompt)
                .call()
                .entity(GptResult.class);

        String category = result.category() == null ? "GENERAL" : result.category().toUpperCase();
        int confidence = Math.max(0, Math.min(100, result.confidence()));
        String rationale = result.rationale() == null ? "GPT classified the document from the provided preview." : result.rationale();

        persistLog(fileName, category, confidence, requester);
        return new Suggestion(category, confidence, rationale);
    }

    private Suggestion keywordClassify(String fileName, String previewText, User requester) {
        String haystack = ((fileName == null ? "" : fileName) + " " + (previewText == null ? "" : previewText))
                .toLowerCase();

        String best = "GENERAL";
        int bestHits = 0;
        String bestSignal = null;
        for (Map.Entry<String, List<String>> e : SIGNALS.entrySet()) {
            int hits = 0;
            String firstHit = null;
            for (String kw : e.getValue()) {
                if (haystack.contains(kw)) { hits++; if (firstHit == null) firstHit = kw; }
            }
            if (hits > bestHits) { bestHits = hits; best = e.getKey(); bestSignal = firstHit; }
        }

        // Map hit-count to a calibrated-feeling confidence; GENERAL (no hits) is low-confidence.
        int confidence = bestHits == 0 ? 35 : Math.min(95, 55 + bestHits * 12);
        String rationale = bestHits == 0
                ? "No strong category signals — defaulting to General."
                : "Matched " + bestHits + " signal" + (bestHits == 1 ? "" : "s") + " (e.g. \"" + bestSignal + "\").";

        persistLog(fileName, best, confidence, requester);
        return new Suggestion(best, confidence, rationale);
    }

    private void persistLog(String fileName, String category, int confidence, User requester) {
        logRepository.save(DocumentClassificationLog.builder()
                .fileName(fileName)
                .suggestedCategory(category)
                .confidence(confidence)
                .requestedBy(requester != null ? requester.getId() : null)
                .build());
    }
}

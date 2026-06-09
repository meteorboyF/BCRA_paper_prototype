package com.pangochain.backend.classification;

import com.pangochain.backend.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

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

    @Transactional
    public Suggestion classify(String fileName, String previewText, User requester) {
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

        logRepository.save(DocumentClassificationLog.builder()
                .fileName(fileName)
                .suggestedCategory(best)
                .confidence(confidence)
                .requestedBy(requester != null ? requester.getId() : null)
                .build());

        return new Suggestion(best, confidence, rationale);
    }
}

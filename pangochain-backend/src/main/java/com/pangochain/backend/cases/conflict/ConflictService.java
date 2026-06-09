package com.pangochain.backend.cases.conflict;

import com.pangochain.backend.cases.Case;
import com.pangochain.backend.cases.CaseRepository;
import com.pangochain.backend.user.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.Stream;

/**
 * Conflict-of-interest checker. Fuzzy-matches a prospective matter's party names against the
 * party names (and titles) of all existing cases in the same firm, using a normalised
 * Levenshtein similarity plus substring containment. Every check is recorded.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ConflictService {

    /** Similarity (0–100) at or above which two names are treated as a potential conflict. */
    private static final int THRESHOLD = 82;

    private final CaseRepository caseRepository;
    private final ConflictCheckLogRepository logRepository;

    public record ConflictCheckRequest(
            String clientName, String opposingParty, String relatedParties, boolean acknowledged) {}

    public record ConflictMatch(
            UUID caseId, String caseTitle, String caseStatus,
            String matchedField, String matchedValue, String queryTerm, int score) {}

    public record ConflictCheckResult(boolean hasConflicts, List<ConflictMatch> matches) {}

    @Transactional
    public ConflictCheckResult check(ConflictCheckRequest req, User requester) {
        UUID firmId = requester.getFirm() != null ? requester.getFirm().getId() : null;
        List<String> queryTerms = Stream.of(
                        Stream.of(req.clientName(), req.opposingParty()),
                        splitParties(req.relatedParties()).stream())
                .flatMap(s -> s)
                .map(ConflictService::normalize)
                .filter(s -> s.length() >= 3)
                .distinct()
                .toList();

        List<ConflictMatch> matches = new ArrayList<>();
        if (firmId != null && !queryTerms.isEmpty()) {
            for (Case c : caseRepository.findByFirmId(firmId)) {
                ConflictMatch best = bestMatchForCase(c, queryTerms);
                if (best != null) matches.add(best);
            }
        }
        matches.sort(Comparator.comparingInt(ConflictMatch::score).reversed());

        logRepository.save(ConflictCheckLog.builder()
                .firmId(firmId)
                .requestedBy(requester.getId())
                .queryTerms(String.join(" | ", queryTerms))
                .matchCount(matches.size())
                .matchedCaseIds(matches.stream().map(m -> m.caseId().toString()).collect(Collectors.joining(",")))
                .acknowledged(req.acknowledged())
                .build());

        log.info("Conflict check by {}: {} term(s) → {} match(es) (ack={})",
                requester.getEmail(), queryTerms.size(), matches.size(), req.acknowledged());
        return new ConflictCheckResult(!matches.isEmpty(), matches);
    }

    /** Best (highest-scoring) match between any query term and any party field of the case. */
    private ConflictMatch bestMatchForCase(Case c, List<String> queryTerms) {
        record Field(String label, String value) {}
        List<Field> fields = new ArrayList<>();
        if (c.getClientName() != null) fields.add(new Field("client", c.getClientName()));
        if (c.getOpposingParty() != null) fields.add(new Field("opposing party", c.getOpposingParty()));
        splitParties(c.getRelatedParties()).forEach(p -> fields.add(new Field("related party", p)));
        fields.add(new Field("case title", c.getTitle()));

        ConflictMatch best = null;
        for (String term : queryTerms) {
            for (Field f : fields) {
                int score = similarity(term, normalize(f.value()));
                if (score >= THRESHOLD && (best == null || score > best.score())) {
                    best = new ConflictMatch(c.getId(), c.getTitle(), c.getStatus().name(),
                            f.label(), f.value(), term, score);
                }
            }
        }
        return best;
    }

    private static List<String> splitParties(String raw) {
        if (raw == null || raw.isBlank()) return List.of();
        return Stream.of(raw.split("[,;\\n]"))
                .map(String::trim).filter(s -> !s.isEmpty()).toList();
    }

    private static String normalize(String s) {
        return s == null ? "" : s.toLowerCase().replaceAll("[^a-z0-9 ]", " ").replaceAll("\\s+", " ").trim();
    }

    /**
     * Similarity 0–100: 100 for equality, a boosted score for substring containment of names
     * ≥4 chars, otherwise a normalised Levenshtein ratio.
     */
    private static int similarity(String a, String b) {
        if (a.isEmpty() || b.isEmpty()) return 0;
        if (a.equals(b)) return 100;
        if ((a.length() >= 4 && b.contains(a)) || (b.length() >= 4 && a.contains(b))) return 90;
        int dist = levenshtein(a, b);
        int maxLen = Math.max(a.length(), b.length());
        return (int) Math.round((1.0 - (double) dist / maxLen) * 100);
    }

    private static int levenshtein(String a, String b) {
        int[] prev = new int[b.length() + 1];
        int[] curr = new int[b.length() + 1];
        for (int j = 0; j <= b.length(); j++) prev[j] = j;
        for (int i = 1; i <= a.length(); i++) {
            curr[0] = i;
            for (int j = 1; j <= b.length(); j++) {
                int cost = a.charAt(i - 1) == b.charAt(j - 1) ? 0 : 1;
                curr[j] = Math.min(Math.min(curr[j - 1] + 1, prev[j] + 1), prev[j - 1] + cost);
            }
            int[] tmp = prev; prev = curr; curr = tmp;
        }
        return prev[b.length()];
    }
}

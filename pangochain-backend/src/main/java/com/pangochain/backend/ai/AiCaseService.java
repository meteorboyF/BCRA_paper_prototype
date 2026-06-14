package com.pangochain.backend.ai;

import com.pangochain.backend.caseevent.CaseEvent;
import com.pangochain.backend.caseevent.CaseEventRepository;
import com.pangochain.backend.cases.CaseRepository;
import com.pangochain.backend.deadline.CaseDeadlineRepository;
import com.pangochain.backend.document.DocStatus;
import com.pangochain.backend.document.DocumentRepository;
import com.pangochain.backend.hearing.HearingRepository;
import com.pangochain.backend.milestone.CaseMilestoneRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional(readOnly = true)
public class AiCaseService {

    protected final Optional<ChatClient> chatClient;
    protected final AiAvailability availability;
    private final CaseRepository caseRepository;
    private final CaseEventRepository caseEventRepository;
    private final DocumentRepository documentRepository;
    private final HearingRepository hearingRepository;
    private final CaseMilestoneRepository milestoneRepository;
    private final CaseDeadlineRepository deadlineRepository;
    private final AiCaseInsightsRepository insightsRepository;

    public record TimelineCheckResult(
            String summary,
            Contradiction[] contradictions,
            String overallAssessment
    ) {}

    public record Contradiction(
            String description,
            String event1,
            String event2,
            String severity
    ) {}

    public record EvidenceGapResult(
            String caseTheory,
            String[] availableEvidence,
            EvidenceGap[] gaps,
            String priorityRecommendation
    ) {}

    public record EvidenceGap(
            String evidenceNeeded,
            String reason,
            String priority
    ) {}

    public record HearingPrepBrief(
            String caseBackground,
            String hearingObjective,
            String[] keyFacts,
            String[] documentsToReview,
            String[] suggestedArguments,
            String[] anticipatedCounterArguments,
            String[] questionsToAddress,
            String[] actionItemsBeforeHearing
    ) {}

    public TimelineCheckResult checkTimeline(UUID caseId) {
        availability.requireAvailable();

        var legalCase = caseRepository.findById(caseId).orElseThrow();
        List<CaseEvent> events = new ArrayList<>(caseEventRepository.findByLegalCaseIdOrderByCreatedAtDesc(caseId));
        Collections.reverse(events);
        var milestones = milestoneRepository.findByCaseIdOrderBySortOrderAscCreatedAtAsc(caseId);
        var hearings = hearingRepository.findByLegalCaseIdOrderByHearingDateAsc(caseId);
        var deadlines = deadlineRepository.findByCaseIdOrderByDeadlineDateAsc(caseId);
        var documents = documentRepository.findByLegalCaseIdAndStatus(caseId, DocStatus.ACTIVE);

        StringBuilder context = new StringBuilder();
        context.append("Case: ").append(legalCase.getTitle()).append(" (").append(legalCase.getCaseType()).append(")\n");
        context.append("Status: ").append(legalCase.getStatus()).append("\n");
        context.append("Description: ").append(legalCase.getDescription() == null ? "N/A" : legalCase.getDescription()).append("\n\n");

        context.append("== CASE EVENTS ==\n");
        events.forEach(e -> context.append(e.getCreatedAt())
                .append(": ").append(e.getTitle())
                .append(" - ").append(e.getDescription() == null ? "" : e.getDescription())
                .append("\n"));

        context.append("\n== HEARINGS ==\n");
        hearings.forEach(h -> context.append(h.getHearingDate())
                .append(": ").append(h.getHearingType())
                .append(" at ").append(h.getCourtName() == null ? h.getLocation() : h.getCourtName())
                .append("\n"));

        context.append("\n== MILESTONES ==\n");
        milestones.forEach(m -> context.append(m.getCompletedAt() != null ? m.getCompletedAt() : "PENDING")
                .append(": ").append(m.getTitle())
                .append(" [").append(m.getStatus()).append("]")
                .append(" - ").append(m.getDescription() == null ? "" : m.getDescription())
                .append("\n"));

        context.append("\n== DEADLINES ==\n");
        deadlines.forEach(d -> context.append(d.getDeadlineDate())
                .append(": ").append(d.getTitle())
                .append(" [").append(d.getDeadlineType()).append("]")
                .append(d.isCompleted() ? " [COMPLETED]" : " [OPEN]")
                .append(" - ").append(d.getDescription() == null ? "" : d.getDescription())
                .append("\n"));

        context.append("\n== DOCUMENTS (metadata only) ==\n");
        documents.forEach(d -> context.append(d.getCreatedAt())
                .append(": ").append(d.getFileName())
                .append(" [").append(d.getCategory()).append("]\n"));

        String prompt = """
                Analyze this case timeline for contradictions, inconsistencies, or suspicious gaps.

                %s

                Identify:
                1. Date contradictions
                2. Logical inconsistencies
                3. Suspicious gaps in the timeline

                Return JSON with:
                - summary: overall assessment in 1-2 sentences
                - contradictions: array of {description, event1, event2, severity: "LOW|MEDIUM|HIGH"}
                - overallAssessment: "CLEAN" | "MINOR_ISSUES" | "SIGNIFICANT_ISSUES" | "CRITICAL_ISSUES"

                Respond ONLY with valid JSON.
                """.formatted(context);

        return availability.call(() -> chatClient.orElseThrow(() -> new AiUnavailableException("AI features require OPENAI_API_KEY to be configured."))
                .prompt()
                .system("You are a forensic legal analyst specializing in timeline analysis. Be specific and cite exact events.")
                .user(prompt)
                .call()
                .entity(TimelineCheckResult.class));
    }

    public EvidenceGapResult analyzeEvidenceGaps(UUID caseId) {
        availability.requireAvailable();

        var legalCase = caseRepository.findById(caseId).orElseThrow();
        var documents = documentRepository.findByLegalCaseIdAndStatus(caseId, DocStatus.ACTIVE);
        List<CaseEvent> events = new ArrayList<>(caseEventRepository.findByLegalCaseIdOrderByCreatedAtDesc(caseId));
        Collections.reverse(events);
        var hearings = hearingRepository.findByLegalCaseIdOrderByHearingDateAsc(caseId);
        var milestones = milestoneRepository.findByCaseIdOrderBySortOrderAscCreatedAtAsc(caseId);
        var deadlines = deadlineRepository.findByCaseIdOrderByDeadlineDateAsc(caseId);

        StringBuilder context = new StringBuilder();
        context.append("Case Type: ").append(legalCase.getCaseType()).append("\n");
        context.append("Case Title: ").append(legalCase.getTitle()).append("\n");
        context.append("Client: ").append(legalCase.getClientName()).append("\n");
        context.append("Opposing Party: ").append(legalCase.getOpposingParty()).append("\n");
        context.append("Description: ").append(legalCase.getDescription() == null ? "N/A" : legalCase.getDescription()).append("\n\n");

        context.append("Available Evidence (document metadata):\n");
        documents.forEach(d -> context.append("- ").append(d.getFileName())
                .append(" [").append(d.getCategory()).append("]")
                .append(d.isConfidential() ? " [CONFIDENTIAL]" : "")
                .append("\n"));

        context.append("\nCase Events:\n");
        events.forEach(e -> context.append("- ").append(e.getCreatedAt())
                .append(": ").append(e.getTitle())
                .append(" - ").append(e.getDescription() == null ? "" : e.getDescription())
                .append("\n"));

        context.append("\nUpcoming Hearings:\n");
        hearings.forEach(h -> context.append("- ").append(h.getHearingDate())
                .append(": ").append(h.getTitle())
                .append(" [").append(h.getHearingType()).append("]")
                .append(" - ").append(h.getNotes() == null ? "" : h.getNotes())
                .append("\n"));

        context.append("\nMilestones:\n");
        milestones.forEach(m -> context.append("- ").append(m.getTitle())
                .append(" [").append(m.getStatus()).append("]")
                .append(" - ").append(m.getDescription() == null ? "" : m.getDescription())
                .append("\n"));

        context.append("\nDeadlines:\n");
        deadlines.forEach(d -> context.append("- ").append(d.getDeadlineDate())
                .append(": ").append(d.getTitle())
                .append(" [").append(d.getDeadlineType()).append("]")
                .append(d.isCompleted() ? " [COMPLETED]" : " [OPEN]")
                .append(" - ").append(d.getDescription() == null ? "" : d.getDescription())
                .append("\n"));

        String prompt = """
                For this legal case, analyze what evidence is currently available and identify strategic gaps.

                %s

                Based on the case type and available documents:
                1. State the apparent case theory
                2. List what evidence is available
                3. Identify what evidence is typically needed but appears to be missing
                4. Prioritize gaps by importance

                Return JSON with:
                - caseTheory: the apparent legal theory being pursued (1 sentence)
                - availableEvidence: array of available evidence descriptions
                - gaps: array of {evidenceNeeded, reason, priority: "HIGH|MEDIUM|LOW"}
                - priorityRecommendation: the single most important next step

                Respond ONLY with valid JSON.
                """.formatted(context);

        return availability.call(() -> chatClient.orElseThrow(() -> new AiUnavailableException("AI features require OPENAI_API_KEY to be configured."))
                .prompt()
                .system("You are a strategic litigation consultant. Think like a winning trial lawyer.")
                .user(prompt)
                .call()
                .entity(EvidenceGapResult.class));
    }

    public HearingPrepBrief generateHearingPrep(UUID hearingId) {
        availability.requireAvailable();

        var hearing = hearingRepository.findById(hearingId).orElseThrow();
        var legalCase = hearing.getLegalCase();
        List<CaseEvent> events = new ArrayList<>(caseEventRepository.findByLegalCaseIdOrderByCreatedAtDesc(legalCase.getId()));
        Collections.reverse(events);
        var documents = documentRepository.findByLegalCaseIdAndStatus(legalCase.getId(), DocStatus.ACTIVE);

        String context = """
                Case: %s | Type: %s | Status: %s
                Hearing Date: %s | Type: %s | Court: %s | Location: %s

                Case Events:
                %s

                Available Documents:
                %s
                """.formatted(
                legalCase.getTitle(), legalCase.getCaseType(), legalCase.getStatus(),
                hearing.getHearingDate(), hearing.getHearingType(), hearing.getCourtName(), hearing.getLocation(),
                events.stream()
                        .map(e -> "- " + e.getCreatedAt() + ": " + e.getTitle()
                                + (e.getDescription() == null ? "" : " - " + e.getDescription()))
                        .collect(Collectors.joining("\n")),
                documents.stream()
                        .map(d -> "- " + d.getFileName() + " [" + d.getCategory() + "]")
                        .collect(Collectors.joining("\n"))
        );

        String prompt = """
                Generate a comprehensive hearing preparation brief for the following hearing.

                %s

                Return JSON with:
                - caseBackground: 2-sentence case summary
                - hearingObjective: what needs to be achieved at this hearing
                - keyFacts: array of the most important facts to remember
                - documentsToReview: array of document names to review before the hearing
                - suggestedArguments: array of key arguments to make
                - anticipatedCounterArguments: array of expected opposing arguments with brief rebuttals
                - questionsToAddress: array of questions the judge might ask
                - actionItemsBeforeHearing: array of tasks to complete before the hearing date

                Respond ONLY with valid JSON.
                """.formatted(context);

        return availability.call(() -> chatClient.orElseThrow(() -> new AiUnavailableException("AI features require OPENAI_API_KEY to be configured."))
                .prompt()
                .system("You are a senior litigator with 20 years of court experience. Be tactical and specific.")
                .user(prompt)
                .call()
                .entity(HearingPrepBrief.class));
    }
}

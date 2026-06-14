package com.pangochain.backend.ai;

import com.pangochain.backend.cases.CaseRepository;
import com.pangochain.backend.document.DocStatus;
import com.pangochain.backend.document.DocumentRepository;
import com.pangochain.backend.hearing.HearingRepository;
import com.pangochain.backend.milestone.CaseMilestoneRepository;
import com.pangochain.backend.user.UserRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class AiChatService {

    protected static final int MAX_CHARS_PER_DOC = 12_000;

    protected final Optional<ChatClient> chatClient;
    protected final AiAvailability availability;
    private final AiConversationRepository conversationRepo;
    private final CaseRepository caseRepository;
    private final UserRepository userRepository;
    private final HearingRepository hearingRepository;
    private final CaseMilestoneRepository milestoneRepository;
    private final DocumentRepository documentRepository;

    @PersistenceContext
    private EntityManager em;

    protected String safe(String text) {
        if (text == null) {
            return "";
        }
        return text.length() > MAX_CHARS_PER_DOC
                ? text.substring(0, MAX_CHARS_PER_DOC) + "\n[... truncated]"
                : text;
    }

    public record DocumentContext(String documentId, String fileName, String text) {}

    public record ChatRequest(UUID caseId, UUID sessionId, String question, List<DocumentContext> documents) {}

    public record ChatResponse(String answer, String[] citations, UUID sessionId) {}

    public record ClientChatRequest(String question) {}

    public record ConversationMessage(String role, String content, Instant createdAt) {}

    public record ChatSessionSummary(UUID sessionId, String title, Instant updatedAt, long messageCount) {}

    public ChatResponse chat(ChatRequest req, String userEmail) {
        availability.requireAvailable();

        var user = userRepository.findByEmail(userEmail).orElseThrow();
        var legalCase = caseRepository.findById(req.caseId()).orElseThrow();
        UUID sessionId = req.sessionId() != null ? req.sessionId() : UUID.randomUUID();
        String sessionTitle = titleFrom(req.question());

        String docContext = "";
        if (req.documents() != null && !req.documents().isEmpty()) {
            docContext = "\n\n== PROVIDED DOCUMENTS ==\n" + req.documents().stream()
                    .map(d -> "--- " + d.fileName() + " ---\n" + safe(d.text()))
                    .collect(Collectors.joining("\n\n"));
        }

        var history = conversationRepo.findTop20ByLegalCaseIdAndUserIdAndSessionIdOrderByCreatedAtAsc(req.caseId(), user.getId(), sessionId);
        String historyContext = history.stream()
                .map(h -> h.getRole() + ": " + h.getContent())
                .collect(Collectors.joining("\n"));

        String system = """
                You are a legal AI assistant for the case: "%s".
                Case type: %s
                Answer questions based on the provided selected documents and case context.
                If PROVIDED DOCUMENTS are present below, you do have access to that selected document text for this chat.
                Do not say you cannot access documents when selected document text is provided.
                Cite specific documents when applicable. If you don't have enough information, say so.

                Recent conversation:
                %s
                %s
                """.formatted(legalCase.getTitle(), legalCase.getCaseType(), historyContext, docContext);

        String answer = availability.call(() -> chatClient.orElseThrow(() -> new AiUnavailableException("AI features require OPENAI_API_KEY to be configured."))
                .prompt()
                .system(system)
                .user(req.question())
                .call()
                .content());

        var userMsg = new AiConversation();
        userMsg.setLegalCase(legalCase);
        userMsg.setUser(user);
        userMsg.setRole("user");
        userMsg.setContent(req.question());
        userMsg.setSessionId(sessionId);
        userMsg.setSessionTitle(sessionTitle);
        conversationRepo.save(userMsg);

        var assistantMsg = new AiConversation();
        assistantMsg.setLegalCase(legalCase);
        assistantMsg.setUser(user);
        assistantMsg.setRole("assistant");
        assistantMsg.setContent(answer);
        assistantMsg.setSessionId(sessionId);
        assistantMsg.setSessionTitle(sessionTitle);
        conversationRepo.save(assistantMsg);

        String[] citations = req.documents() != null
                ? req.documents().stream()
                .filter(d -> d.fileName() != null && answer != null && answer.contains(d.fileName()))
                .map(DocumentContext::fileName)
                .toArray(String[]::new)
                : new String[0];

        return new ChatResponse(answer, citations, sessionId);
    }

    @Transactional(readOnly = true)
    public List<ConversationMessage> getHistory(UUID caseId, UUID sessionId, String userEmail) {
        var user = userRepository.findByEmail(userEmail).orElseThrow();
        List<AiConversation> messages = sessionId != null
                ? conversationRepo.findTop20ByLegalCaseIdAndUserIdAndSessionIdOrderByCreatedAtAsc(caseId, user.getId(), sessionId)
                : conversationRepo.findTop20ByLegalCaseIdAndUserIdOrderByCreatedAtAsc(caseId, user.getId());
        return messages
                .stream()
                .map(h -> new ConversationMessage(h.getRole(), h.getContent(), h.getCreatedAt()))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<ChatSessionSummary> getSessions(UUID caseId, String userEmail) {
        var user = userRepository.findByEmail(userEmail).orElseThrow();
        @SuppressWarnings("unchecked")
        List<Object[]> rows = em.createNativeQuery("""
                SELECT session_id,
                       COALESCE(MAX(session_title), 'AI chat') AS title,
                       MAX(created_at) AS updated_at,
                       COUNT(*) AS message_count
                FROM ai_conversations
                WHERE case_id = :caseId AND user_id = :userId
                GROUP BY session_id
                ORDER BY MAX(created_at) DESC
                LIMIT 20
                """)
                .setParameter("caseId", caseId)
                .setParameter("userId", user.getId())
                .getResultList();
        return rows.stream()
                .map(row -> new ChatSessionSummary(
                        (UUID) row[0],
                        row[1] != null ? row[1].toString() : "AI chat",
                        toInstant(row[2]),
                        ((Number) row[3]).longValue()))
                .toList();
    }

    @Transactional(readOnly = true)
    public ChatResponse clientChat(ClientChatRequest req, String clientEmail) {
        availability.requireAvailable();

        var user = userRepository.findByEmail(clientEmail).orElseThrow();
        var clientCases = caseRepository.findByClientId(user.getId());
        if (clientCases.isEmpty()) {
            return new ChatResponse("I don't see any active cases for your account. Please contact your lawyer.", new String[0], null);
        }

        var legalCase = clientCases.get(0);
        var hearings = hearingRepository.findByLegalCaseIdOrderByHearingDateAsc(legalCase.getId());
        var milestones = milestoneRepository.findByCaseIdOrderBySortOrderAscCreatedAtAsc(legalCase.getId());
        var documents = documentRepository.findByLegalCaseIdAndStatus(legalCase.getId(), DocStatus.ACTIVE);

        String context = """
                Today's date: %s

                Your case: %s
                Type: %s | Status: %s

                Upcoming hearings:
                %s

                Case milestones:
                %s

                Documents in your vault (names only):
                %s
                """.formatted(
                LocalDate.now(),
                legalCase.getTitle(), legalCase.getCaseType(), legalCase.getStatus(),
                hearings.stream()
                        .map(h -> "- " + h.getHearingDate() + ": " + h.getHearingType() + " at " + h.getCourtName())
                        .collect(Collectors.joining("\n")),
                milestones.stream()
                        .map(m -> "- " + m.getTitle() + ": "
                                + (m.getCompletedAt() != null ? "Completed " + m.getCompletedAt() : m.getStatus()))
                        .collect(Collectors.joining("\n")),
                documents.stream().map(d -> "- " + d.getFileName()).collect(Collectors.joining("\n"))
        );

        String answer = availability.call(() -> chatClient.orElseThrow(() -> new AiUnavailableException("AI features require OPENAI_API_KEY to be configured."))
                .prompt()
                .system("""
                        You are a friendly legal case assistant helping a client understand their case.
                        Use plain English. Avoid legal jargon.
                        Be warm, reassuring, and honest.
                        Never give legal advice beyond explaining their specific case facts.
                        If a question requires a lawyer's judgment, say "Your lawyer will be best placed to answer this."

                        Case context:
                        """ + context)
                .user(req.question())
                .call()
                .content());

        return new ChatResponse(answer, new String[0], null);
    }

    private String titleFrom(String question) {
        if (question == null || question.isBlank()) {
            return "New AI chat";
        }
        String cleaned = question.replaceAll("\\s+", " ").trim();
        return cleaned.length() > 80 ? cleaned.substring(0, 77) + "..." : cleaned;
    }

    private Instant toInstant(Object value) {
        if (value instanceof Instant instant) return instant;
        if (value instanceof java.sql.Timestamp timestamp) return timestamp.toInstant();
        if (value instanceof java.time.OffsetDateTime offsetDateTime) return offsetDateTime.toInstant();
        return Instant.parse(value.toString());
    }
}

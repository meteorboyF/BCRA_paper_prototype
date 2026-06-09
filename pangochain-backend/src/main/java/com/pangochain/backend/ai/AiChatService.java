package com.pangochain.backend.ai;

import com.pangochain.backend.cases.CaseRepository;
import com.pangochain.backend.user.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
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

    protected String safe(String text) {
        if (text == null) {
            return "";
        }
        return text.length() > MAX_CHARS_PER_DOC
                ? text.substring(0, MAX_CHARS_PER_DOC) + "\n[... truncated]"
                : text;
    }

    public record DocumentContext(String documentId, String fileName, String text) {}

    public record ChatRequest(UUID caseId, String question, List<DocumentContext> documents) {}

    public record ChatResponse(String answer, String[] citations) {}

    public record ConversationMessage(String role, String content, Instant createdAt) {}

    public ChatResponse chat(ChatRequest req, String userEmail) {
        availability.requireAvailable();

        var user = userRepository.findByEmail(userEmail).orElseThrow();
        var legalCase = caseRepository.findById(req.caseId()).orElseThrow();

        String docContext = "";
        if (req.documents() != null && !req.documents().isEmpty()) {
            docContext = "\n\n== PROVIDED DOCUMENTS ==\n" + req.documents().stream()
                    .map(d -> "--- " + d.fileName() + " ---\n" + safe(d.text()))
                    .collect(Collectors.joining("\n\n"));
        }

        var history = conversationRepo.findTop20ByLegalCaseIdAndUserIdOrderByCreatedAtAsc(req.caseId(), user.getId());
        String historyContext = history.stream()
                .map(h -> h.getRole() + ": " + h.getContent())
                .collect(Collectors.joining("\n"));

        String system = """
                You are a legal AI assistant for the case: "%s".
                Case type: %s
                Answer questions based on provided documents and case context.
                Cite specific documents when applicable. If you don't have enough information, say so.

                Recent conversation:
                %s
                %s
                """.formatted(legalCase.getTitle(), legalCase.getCaseType(), historyContext, docContext);

        String answer = chatClient.orElseThrow(() -> new AiUnavailableException("AI features require OPENAI_API_KEY to be configured."))
                .prompt()
                .system(system)
                .user(req.question())
                .call()
                .content();

        var userMsg = new AiConversation();
        userMsg.setLegalCase(legalCase);
        userMsg.setUser(user);
        userMsg.setRole("user");
        userMsg.setContent(req.question());
        conversationRepo.save(userMsg);

        var assistantMsg = new AiConversation();
        assistantMsg.setLegalCase(legalCase);
        assistantMsg.setUser(user);
        assistantMsg.setRole("assistant");
        assistantMsg.setContent(answer);
        conversationRepo.save(assistantMsg);

        String[] citations = req.documents() != null
                ? req.documents().stream()
                .filter(d -> d.fileName() != null && answer != null && answer.contains(d.fileName()))
                .map(DocumentContext::fileName)
                .toArray(String[]::new)
                : new String[0];

        return new ChatResponse(answer, citations);
    }

    @Transactional(readOnly = true)
    public List<ConversationMessage> getHistory(UUID caseId, String userEmail) {
        var user = userRepository.findByEmail(userEmail).orElseThrow();
        return conversationRepo.findTop20ByLegalCaseIdAndUserIdOrderByCreatedAtAsc(caseId, user.getId())
                .stream()
                .map(h -> new ConversationMessage(h.getRole(), h.getContent(), h.getCreatedAt()))
                .toList();
    }
}

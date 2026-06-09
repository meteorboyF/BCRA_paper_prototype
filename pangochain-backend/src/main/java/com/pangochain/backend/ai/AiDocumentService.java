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
}

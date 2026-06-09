package com.pangochain.backend.ai;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class AiAvailability {

    @Value("${spring.ai.openai.api-key:}")
    private String apiKey;

    public boolean isAvailable() {
        return apiKey != null && !apiKey.isBlank();
    }

    public void requireAvailable() {
        if (!isAvailable()) {
            throw new AiUnavailableException("AI features require OPENAI_API_KEY to be configured.");
        }
    }
}

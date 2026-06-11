package com.pangochain.backend.ai;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.concurrent.Callable;

@Component
@Slf4j
public class AiAvailability {

    @Value("${OPENAI_API_KEY:}")
    private String apiKey;

    public boolean isAvailable() {
        return configProblem() == null;
    }

    public String statusMessage() {
        String problem = configProblem();
        return problem == null ? "OpenAI API key is configured." : problem;
    }

    public void requireAvailable() {
        String problem = configProblem();
        if (problem != null) {
            throw new AiUnavailableException(problem);
        }
    }

    public <T> T call(Callable<T> action) {
        requireAvailable();
        try {
            return action.call();
        } catch (AiUnavailableException ex) {
            throw ex;
        } catch (Exception ex) {
            log.warn("OpenAI request failed: {}", ex.getMessage());
            throw new AiUnavailableException("OpenAI request failed. Check that OPENAI_API_KEY is a valid key with model access, then restart the backend.");
        }
    }

    private String configProblem() {
        if (apiKey == null || apiKey.isBlank()) {
            return "AI features require OPENAI_API_KEY to be configured.";
        }
        String trimmed = apiKey.trim();
        if (trimmed.contains("your-openai") || trimmed.contains("your-real") || trimmed.contains("placeholder")) {
            return "OPENAI_API_KEY still looks like a placeholder. Put your real OpenAI API key in .env and restart the backend.";
        }
        if (trimmed.length() < 30) {
            return "OPENAI_API_KEY is too short to be a valid OpenAI key. Put the full key in .env and restart the backend.";
        }
        if (!trimmed.startsWith("sk-")) {
            return "OPENAI_API_KEY should start with sk-. Check the value in .env and restart the backend.";
        }
        return null;
    }
}

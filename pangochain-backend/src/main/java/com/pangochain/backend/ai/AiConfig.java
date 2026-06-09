package com.pangochain.backend.ai;

import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.openai.OpenAiChatModel;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class AiConfig {

    @Bean
    @ConditionalOnExpression("!'${spring.ai.openai.api-key:}'.isBlank()")
    public ChatClient chatClient(OpenAiChatModel chatModel) {
        return ChatClient.builder(chatModel)
                .defaultSystem("You are a legal AI assistant for PangoChain, a secure legal document management platform. "
                        + "Be precise, cite evidence when available, and always note when something requires human legal judgment.")
                .build();
    }
}

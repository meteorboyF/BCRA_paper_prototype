package com.pangochain.backend.chat;

import com.pangochain.backend.chat.ChatDtos.ChatMessageDto;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

import java.util.UUID;

/**
 * Pushes a freshly-posted message to subscribers of its conversation topic.
 * The {@link SimpMessagingTemplate} is optional so the app still works (REST-only)
 * before the STOMP/WebSocket layer is configured; once it is, messages fan out live.
 */
@Component
@Slf4j
public class ChatRealtimePublisher {

    @Autowired(required = false)
    private SimpMessagingTemplate messagingTemplate;

    public void broadcast(UUID conversationId, ChatMessageDto message) {
        if (messagingTemplate == null) return;
        messagingTemplate.convertAndSend("/topic/conversations/" + conversationId, message);
    }
}

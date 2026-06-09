package com.pangochain.backend.notification;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * Creates notifications and pushes them to the recipient in real time over STOMP
 * (destination {@code /topic/users/{userId}/notifications}). The messaging template is
 * optional so the app still works REST-only before the WebSocket layer is up.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class NotificationService {

    public static final String USER_TOPIC_PREFIX = "/topic/users/";
    public static final String USER_TOPIC_SUFFIX = "/notifications";

    private final NotificationRepository repository;
    @Autowired(required = false)
    private SimpMessagingTemplate messagingTemplate;

    /** Persist a notification for a user and fan it out live to any open session. */
    @Transactional
    public Notification push(UUID userId, String type, String message) {
        Notification saved = repository.save(Notification.builder()
                .userId(userId).type(type).message(message).build());
        if (messagingTemplate != null) {
            messagingTemplate.convertAndSend(
                    USER_TOPIC_PREFIX + userId + USER_TOPIC_SUFFIX, NotificationDto.from(saved));
        }
        return saved;
    }

    @Transactional(readOnly = true)
    public Page<NotificationDto> list(UUID userId, Pageable pageable) {
        return repository.findByUserIdOrderByCreatedAtDesc(userId, pageable).map(NotificationDto::from);
    }

    @Transactional(readOnly = true)
    public long unreadCount(UUID userId) {
        return repository.countByUserIdAndReadFalse(userId);
    }

    @Transactional
    public int markAllRead(UUID userId) {
        return repository.markAllRead(userId);
    }
}

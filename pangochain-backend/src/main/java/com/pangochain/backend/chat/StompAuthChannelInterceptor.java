package com.pangochain.backend.chat;

import com.pangochain.backend.auth.JwtTokenProvider;
import com.pangochain.backend.user.User;
import com.pangochain.backend.user.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.lang.NonNull;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.stereotype.Component;

import java.security.Principal;
import java.util.List;
import java.util.UUID;

/**
 * Authenticates the STOMP CONNECT frame with the same JWT used for REST, and authorizes
 * SUBSCRIBE frames so a user can only subscribe to conversation topics they belong to.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class StompAuthChannelInterceptor implements ChannelInterceptor {

    private static final String TOPIC_PREFIX = "/topic/conversations/";
    private static final String USER_TOPIC_PREFIX = "/topic/users/";
    private static final String DOC_TOPIC_PREFIX = "/topic/documents/";

    private final JwtTokenProvider jwtTokenProvider;
    private final UserRepository userRepository;
    private final ChatService chatService;
    private final com.pangochain.backend.document.DocumentService documentService;

    @Override
    public Message<?> preSend(@NonNull Message<?> message, @NonNull MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
        if (accessor == null) return message;

        if (StompCommand.CONNECT.equals(accessor.getCommand())) {
            String auth = accessor.getFirstNativeHeader("Authorization");
            if (auth == null || !auth.startsWith("Bearer ")) {
                throw new IllegalArgumentException("Missing bearer token on STOMP CONNECT");
            }
            String token = auth.substring(7);
            if (!jwtTokenProvider.isAccessToken(token)) {
                throw new IllegalArgumentException("Invalid access token");
            }
            String email = jwtTokenProvider.extractEmail(token);
            Principal principal = new UsernamePasswordAuthenticationToken(email, null, List.of());
            accessor.setUser(principal);
        } else if (StompCommand.SUBSCRIBE.equals(accessor.getCommand())) {
            String dest = accessor.getDestination();
            if (dest != null && dest.startsWith(TOPIC_PREFIX)) {
                UUID convId = UUID.fromString(dest.substring(TOPIC_PREFIX.length()));
                Principal user = accessor.getUser();
                User u = user != null ? userRepository.findByEmail(user.getName()).orElse(null) : null;
                if (u == null || !chatService.isMember(convId, u.getId())) {
                    throw new IllegalArgumentException("Not authorized to subscribe to this conversation");
                }
            } else if (dest != null && dest.startsWith(DOC_TOPIC_PREFIX)) {
                // /topic/documents/{docId}/annotations — must have access to the document.
                String segment = dest.substring(DOC_TOPIC_PREFIX.length());
                int slash = segment.indexOf('/');
                UUID docId = UUID.fromString(slash >= 0 ? segment.substring(0, slash) : segment);
                Principal user = accessor.getUser();
                User u = user != null ? userRepository.findByEmail(user.getName()).orElse(null) : null;
                if (u == null || !documentService.hasDocumentAccess(docId, u.getId())) {
                    throw new IllegalArgumentException("Not authorized to subscribe to this document");
                }
            } else if (dest != null && dest.startsWith(USER_TOPIC_PREFIX)) {
                // /topic/users/{userId}/notifications — a user may only subscribe to their own.
                String segment = dest.substring(USER_TOPIC_PREFIX.length());
                int slash = segment.indexOf('/');
                String idPart = slash >= 0 ? segment.substring(0, slash) : segment;
                Principal user = accessor.getUser();
                User u = user != null ? userRepository.findByEmail(user.getName()).orElse(null) : null;
                if (u == null || !u.getId().toString().equals(idPart)) {
                    throw new IllegalArgumentException("Not authorized to subscribe to these notifications");
                }
            }
        }
        return message;
    }
}

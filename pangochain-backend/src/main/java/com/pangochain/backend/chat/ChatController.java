package com.pangochain.backend.chat;

import com.pangochain.backend.chat.ChatDtos.ChatMessageDto;
import com.pangochain.backend.chat.ChatDtos.ConversationDto;
import com.pangochain.backend.chat.ChatDtos.SendChatRequest;
import com.pangochain.backend.user.User;
import com.pangochain.backend.user.UserRepository;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/chat")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class ChatController {

    private final ChatService chatService;
    private final UserRepository userRepository;
    private final ChatRealtimePublisher realtimePublisher;

    @GetMapping("/conversations")
    public ResponseEntity<List<ConversationDto>> conversations(@AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.ok(chatService.listConversations(resolve(principal)));
    }

    /** Open (find-or-create) a 1:1 direct conversation with another firm member. */
    @PostMapping("/direct")
    public ResponseEntity<ConversationDto> openDirect(
            @Valid @RequestBody OpenDirectRequest req,
            @AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.ok(chatService.openDirect(resolve(principal), req.userId()));
    }

    public record OpenDirectRequest(@jakarta.validation.constraints.NotNull UUID userId) {}

    @GetMapping("/conversations/{id}/messages")
    public ResponseEntity<List<ChatMessageDto>> history(
            @PathVariable UUID id, @AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.ok(chatService.history(id, resolve(principal)));
    }

    @PostMapping("/conversations/{id}/messages")
    public ResponseEntity<ChatMessageDto> send(
            @PathVariable UUID id,
            @Valid @RequestBody SendChatRequest req,
            @AuthenticationPrincipal UserDetails principal) {
        ChatMessageDto dto = chatService.post(id, resolve(principal), req.body());
        realtimePublisher.broadcast(id, dto);
        return ResponseEntity.ok(dto);
    }

    @PostMapping("/conversations/{id}/read")
    public ResponseEntity<Void> markRead(
            @PathVariable UUID id, @AuthenticationPrincipal UserDetails principal) {
        chatService.markRead(id, resolve(principal));
        return ResponseEntity.noContent().build();
    }

    private User resolve(UserDetails principal) {
        return userRepository.findByEmail(principal.getUsername())
                .orElseThrow(() -> new IllegalStateException("User not found"));
    }
}

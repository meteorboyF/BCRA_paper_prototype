package com.pangochain.backend.message;

import com.pangochain.backend.user.User;
import com.pangochain.backend.user.UserRepository;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/messages")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class MessageController {

    private final MessageService messageService;
    private final UserRepository userRepository;

    @PostMapping
    public ResponseEntity<MessageDto> send(
            @Valid @RequestBody SendMessageRequest req,
            @AuthenticationPrincipal UserDetails principal) {
        User sender = resolveUser(principal);
        return ResponseEntity.ok(messageService.send(req, sender));
    }

    @GetMapping
    public ResponseEntity<Page<MessageDto>> inbox(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @AuthenticationPrincipal UserDetails principal) {
        User user = resolveUser(principal);
        return ResponseEntity.ok(messageService.inbox(user, page, size));
    }

    @PostMapping("/mark-read")
    public ResponseEntity<Map<String, Integer>> markAllRead(
            @AuthenticationPrincipal UserDetails principal) {
        User user = resolveUser(principal);
        int count = messageService.markAllRead(user);
        return ResponseEntity.ok(Map.of("marked", count));
    }

    @GetMapping("/unread-count")
    public ResponseEntity<Map<String, Long>> unreadCount(
            @AuthenticationPrincipal UserDetails principal) {
        User user = resolveUser(principal);
        return ResponseEntity.ok(Map.of("count", messageService.unreadCount(user)));
    }

    /** GET /api/messages/conversations — one entry per conversation partner. */
    @GetMapping("/conversations")
    public ResponseEntity<List<MessageDto>> conversations(
            @AuthenticationPrincipal UserDetails principal) {
        User user = resolveUser(principal);
        return ResponseEntity.ok(messageService.conversationSummaries(user));
    }

    /** GET /api/messages/conversation/{userId} — full thread with a specific user. */
    @GetMapping("/conversation/{userId}")
    public ResponseEntity<List<MessageDto>> thread(
            @PathVariable UUID userId,
            @AuthenticationPrincipal UserDetails principal) {
        User caller = resolveUser(principal);
        return ResponseEntity.ok(messageService.thread(caller, userId));
    }

    /** PUT /api/messages/{id}/read — mark one message as read. */
    @PutMapping("/{id}/read")
    public ResponseEntity<Map<String, Integer>> markOneRead(
            @PathVariable UUID id,
            @AuthenticationPrincipal UserDetails principal) {
        User user = resolveUser(principal);
        int marked = messageService.markOneRead(id, user);
        return ResponseEntity.ok(Map.of("marked", marked));
    }

    private User resolveUser(UserDetails principal) {
        return userRepository.findByEmail(principal.getUsername())
                .orElseThrow(() -> new IllegalStateException("User not found"));
    }
}

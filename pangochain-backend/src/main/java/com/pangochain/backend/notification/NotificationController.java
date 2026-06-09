package com.pangochain.backend.notification;

import com.pangochain.backend.user.User;
import com.pangochain.backend.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class NotificationController {

    private final NotificationService notificationService;
    private final UserRepository userRepository;

    @GetMapping
    public ResponseEntity<Map<String, Object>> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @AuthenticationPrincipal UserDetails principal) {
        User user = resolve(principal);
        Page<NotificationDto> p = notificationService.list(user.getId(), PageRequest.of(page, size));
        return ResponseEntity.ok(Map.of(
                "content", p.getContent(),
                "totalElements", p.getTotalElements(),
                "unread", notificationService.unreadCount(user.getId())));
    }

    @GetMapping("/unread-count")
    public ResponseEntity<Map<String, Object>> unreadCount(@AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.ok(Map.of("unread", notificationService.unreadCount(resolve(principal).getId())));
    }

    @PostMapping("/read-all")
    public ResponseEntity<Map<String, Object>> readAll(@AuthenticationPrincipal UserDetails principal) {
        return ResponseEntity.ok(Map.of("marked", notificationService.markAllRead(resolve(principal).getId())));
    }

    private User resolve(UserDetails principal) {
        return userRepository.findByEmail(principal.getUsername())
                .orElseThrow(() -> new IllegalStateException("User not found"));
    }
}

package com.pangochain.backend.reminder;

import com.pangochain.backend.cases.CaseRepository;
import com.pangochain.backend.user.User;
import com.pangochain.backend.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/reminders")
@RequiredArgsConstructor
@PreAuthorize("isAuthenticated()")
public class ReminderController {

    private final ReminderRepository reminderRepository;
    private final CaseRepository caseRepository;
    private final UserRepository userRepository;

    @GetMapping
    public ResponseEntity<List<ReminderDto>> myReminders(
            @AuthenticationPrincipal UserDetails principal) {
        User user = resolveUser(principal);
        return ResponseEntity.ok(
                reminderRepository.findByRecipientIdOrderByCreatedAtDesc(user.getId())
                        .stream().map(ReminderDto::from).toList()
        );
    }

    @GetMapping("/unread-count")
    public ResponseEntity<Map<String, Long>> unreadCount(
            @AuthenticationPrincipal UserDetails principal) {
        User user = resolveUser(principal);
        return ResponseEntity.ok(Map.of("count",
                reminderRepository.countByRecipientIdAndReadFalse(user.getId())));
    }

    @PostMapping
    public ResponseEntity<ReminderDto> send(
            @RequestBody ReminderCreateRequest req,
            @AuthenticationPrincipal UserDetails principal) {
        User sender = resolveUser(principal);
        User recipient = userRepository.findById(req.recipientId())
                .orElseThrow(() -> new IllegalArgumentException("Recipient not found"));

        Reminder.ReminderBuilder b = Reminder.builder()
                .sender(sender)
                .recipient(recipient)
                .title(req.title())
                .body(req.body())
                .dueAt(req.dueAt())
                .priority(req.priority() != null ? req.priority() : "NORMAL");

        if (req.caseId() != null) {
            b.legalCase(caseRepository.findById(req.caseId()).orElse(null));
        }

        return ResponseEntity.ok(ReminderDto.from(reminderRepository.save(b.build())));
    }

    @PatchMapping("/{id}/read")
    public ResponseEntity<Void> markRead(
            @PathVariable UUID id,
            @AuthenticationPrincipal UserDetails principal) {
        reminderRepository.findById(id).ifPresent(r -> {
            r.setRead(true);
            reminderRepository.save(r);
        });
        return ResponseEntity.noContent().build();
    }

    private User resolveUser(UserDetails principal) {
        return userRepository.findByEmail(principal.getUsername())
                .orElseThrow(() -> new IllegalStateException("User not found"));
    }
}

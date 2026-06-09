package com.pangochain.backend.feedback;

import com.pangochain.backend.user.User;
import com.pangochain.backend.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class FeedbackService {

    public record FeedbackDto(UUID id, UUID caseId, int rating, String comment, String context, Instant createdAt) {}
    public record FeedbackAdminDto(UUID id, String clientEmail, UUID caseId, int rating, String comment,
                                   String context, Instant createdAt) {}
    public record SatisfactionSummary(double averageRating, long total, Map<Integer, Long> distribution,
                                      List<FeedbackAdminDto> recent) {}

    private final FeedbackResponseRepository repository;
    private final UserRepository userRepository;

    @Transactional
    public FeedbackDto submit(User client, UUID caseId, int rating, String comment, String context) {
        if (rating < 1 || rating > 5) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Rating must be 1–5");
        FeedbackResponse r = repository.save(FeedbackResponse.builder()
                .clientId(client.getId()).caseId(caseId).rating(rating).comment(comment)
                .context(context != null && !context.isBlank() ? context.toUpperCase() : "GENERAL").build());
        return toDto(r);
    }

    @Transactional(readOnly = true)
    public List<FeedbackDto> mine(User client) {
        return repository.findByClientIdOrderByCreatedAtDesc(client.getId()).stream().map(this::toDto).toList();
    }

    @Transactional(readOnly = true)
    public SatisfactionSummary summary() {
        List<FeedbackResponse> all = repository.findAllByOrderByCreatedAtDesc();
        double avg = all.stream().mapToInt(FeedbackResponse::getRating).average().orElse(0);
        Map<Integer, Long> dist = new java.util.TreeMap<>();
        for (int i = 1; i <= 5; i++) dist.put(i, 0L);
        all.forEach(r -> dist.merge(r.getRating(), 1L, Long::sum));
        List<FeedbackAdminDto> recent = all.stream().limit(20).map(this::toAdminDto).toList();
        return new SatisfactionSummary(Math.round(avg * 10) / 10.0, all.size(), dist, recent);
    }

    private FeedbackDto toDto(FeedbackResponse r) {
        return new FeedbackDto(r.getId(), r.getCaseId(), r.getRating(), r.getComment(), r.getContext(), r.getCreatedAt());
    }

    private FeedbackAdminDto toAdminDto(FeedbackResponse r) {
        String email = userRepository.findById(r.getClientId()).map(User::getEmail).orElse("unknown");
        return new FeedbackAdminDto(r.getId(), email, r.getCaseId(), r.getRating(), r.getComment(), r.getContext(), r.getCreatedAt());
    }
}

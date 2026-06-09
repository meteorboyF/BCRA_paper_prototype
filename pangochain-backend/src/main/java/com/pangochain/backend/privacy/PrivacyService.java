package com.pangochain.backend.privacy;

import com.pangochain.backend.audit.AuditLogRepository;
import com.pangochain.backend.audit.AuditService;
import com.pangochain.backend.document.DocumentRepository;
import com.pangochain.backend.esignature.ESignatureRepository;
import com.pangochain.backend.notification.NotificationRepository;
import com.pangochain.backend.user.User;
import com.pangochain.backend.user.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * GDPR data subject services: a per-user data inventory and an erasure-request workflow.
 * Ledger/audit entries are immutable by design — this is disclosed to the data subject and
 * such records are listed but not erased.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class PrivacyService {

    public record InventoryItem(String category, long count, boolean erasable, String note) {}
    public record DeletionRequestDto(UUID id, String status, String reason, String resolution,
                                     Instant processedAt, Instant createdAt) {}
    public record DeletionRequestAdminDto(UUID id, UUID userId, String userEmail, String status,
                                          String reason, String resolution, Instant createdAt) {}

    private final DocumentRepository documentRepository;
    private final AuditLogRepository auditLogRepository;
    private final NotificationRepository notificationRepository;
    private final ESignatureRepository signatureRepository;
    private final DeletionRequestRepository deletionRequestRepository;
    private final UserRepository userRepository;
    private final AuditService auditService;

    @Transactional(readOnly = true)
    public List<InventoryItem> dataInventory(User user) {
        UUID id = user.getId();
        return List.of(
                new InventoryItem("Profile", 1, true, "Name, email, role, public keys."),
                new InventoryItem("Documents you own", documentRepository.countByOwnerId(id), true,
                        "Encrypted documents — ciphertext + metadata."),
                new InventoryItem("Notifications", notificationRepository.countByUserId(id), true,
                        "In-app notifications addressed to you."),
                new InventoryItem("Digital signatures", signatureRepository.countBySignerId(id), false,
                        "Signature records anchored on the ledger — immutable."),
                new InventoryItem("Audit-trail entries", auditLogRepository.countByActorId(id), false,
                        "Blockchain-anchored actions — immutable by design.")
        );
    }

    @Transactional
    public DeletionRequestDto submitDeletionRequest(User user, String reason) {
        DeletionRequest r = deletionRequestRepository.save(DeletionRequest.builder()
                .userId(user.getId()).reason(reason).status(DeletionRequest.Status.PENDING).build());
        auditService.log("GDPR_DELETION_REQUEST", user.getId(), "USER", user.getId().toString(), null,
                "{\"requestId\":\"" + r.getId() + "\"}");
        log.info("GDPR deletion request {} submitted by {}", r.getId(), user.getEmail());
        return toDto(r);
    }

    @Transactional(readOnly = true)
    public List<DeletionRequestDto> myRequests(User user) {
        return deletionRequestRepository.findByUserIdOrderByCreatedAtDesc(user.getId())
                .stream().map(this::toDto).toList();
    }

    @Transactional(readOnly = true)
    public List<DeletionRequestAdminDto> allRequests() {
        return deletionRequestRepository.findAllByOrderByCreatedAtDesc().stream()
                .map(r -> new DeletionRequestAdminDto(r.getId(), r.getUserId(),
                        userRepository.findById(r.getUserId()).map(User::getEmail).orElse("unknown"),
                        r.getStatus().name(), r.getReason(), r.getResolution(), r.getCreatedAt()))
                .toList();
    }

    @Transactional
    public DeletionRequestDto process(UUID requestId, String status, String resolution, User admin) {
        DeletionRequest r = deletionRequestRepository.findById(requestId)
                .orElseThrow(() -> new IllegalArgumentException("Request not found"));
        DeletionRequest.Status target;
        try { target = DeletionRequest.Status.valueOf(status.toUpperCase()); }
        catch (IllegalArgumentException e) { throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid status"); }
        r.setStatus(target);
        r.setResolution(resolution);
        r.setProcessedBy(admin.getId());
        r.setProcessedAt(Instant.now());
        deletionRequestRepository.save(r);
        auditService.log("GDPR_DELETION_PROCESSED", admin.getId(), "USER", r.getUserId().toString(), null,
                "{\"requestId\":\"" + r.getId() + "\",\"status\":\"" + target + "\"}");
        return toDto(r);
    }

    private DeletionRequestDto toDto(DeletionRequest r) {
        return new DeletionRequestDto(r.getId(), r.getStatus().name(), r.getReason(),
                r.getResolution(), r.getProcessedAt(), r.getCreatedAt());
    }
}

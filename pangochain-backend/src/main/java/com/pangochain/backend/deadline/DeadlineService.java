package com.pangochain.backend.deadline;

import com.pangochain.backend.audit.AuditService;
import com.pangochain.backend.deadline.DeadlineDtos.CreateDeadlineRequest;
import com.pangochain.backend.deadline.DeadlineDtos.DeadlineDto;
import com.pangochain.backend.deadline.DeadlineDtos.UpdateDeadlineRequest;
import com.pangochain.backend.user.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class DeadlineService {

    private final CaseDeadlineRepository repository;
    private final AuditService auditService;

    @Transactional(readOnly = true)
    public List<DeadlineDto> list(UUID caseId) {
        return repository.findByCaseIdOrderByDeadlineDateAsc(caseId).stream().map(this::toDto).toList();
    }

    @Transactional
    public DeadlineDto create(UUID caseId, CreateDeadlineRequest req, User author) {
        CaseDeadline d = repository.save(CaseDeadline.builder()
                .caseId(caseId)
                .title(req.title())
                .description(req.description())
                .deadlineType(parseType(req.deadlineType()))
                .deadlineDate(Instant.ofEpochMilli(req.deadlineDateEpochMs()))
                .linkedDocId(req.linkedDocId())
                .createdBy(author.getId())
                .build());
        auditService.log("DEADLINE_ADDED", author.getId(), "CASE", caseId.toString(), null,
                "{\"title\":\"" + req.title().replace("\"", "'") + "\",\"type\":\"" + d.getDeadlineType() + "\"}");
        return toDto(d);
    }

    @Transactional
    public DeadlineDto update(UUID caseId, UUID deadlineId, UpdateDeadlineRequest req, User actor) {
        CaseDeadline d = require(caseId, deadlineId);
        if (req.title() != null && !req.title().isBlank()) d.setTitle(req.title());
        if (req.description() != null) d.setDescription(req.description());
        if (req.deadlineType() != null) d.setDeadlineType(parseType(req.deadlineType()));
        if (req.deadlineDateEpochMs() != null) d.setDeadlineDate(Instant.ofEpochMilli(req.deadlineDateEpochMs()));
        if (req.completed() != null) {
            d.setCompleted(req.completed());
            d.setCompletedAt(req.completed() ? Instant.now() : null);
        }
        d = repository.save(d);
        auditService.log("DEADLINE_UPDATED", actor.getId(), "CASE", caseId.toString(), null,
                "{\"deadline\":\"" + d.getTitle().replace("\"", "'") + "\",\"completed\":" + d.isCompleted() + "}");
        return toDto(d);
    }

    @Transactional
    public void delete(UUID caseId, UUID deadlineId, User actor) {
        repository.delete(require(caseId, deadlineId));
        auditService.log("DEADLINE_DELETED", actor.getId(), "CASE", caseId.toString(), null, null);
    }

    private CaseDeadline require(UUID caseId, UUID deadlineId) {
        CaseDeadline d = repository.findById(deadlineId)
                .orElseThrow(() -> new IllegalArgumentException("Deadline not found"));
        if (!d.getCaseId().equals(caseId)) {
            throw new IllegalArgumentException("Deadline does not belong to this case");
        }
        return d;
    }

    private CaseDeadline.Type parseType(String raw) {
        if (raw == null || raw.isBlank()) return CaseDeadline.Type.CUSTOM;
        try { return CaseDeadline.Type.valueOf(raw.toUpperCase()); }
        catch (IllegalArgumentException e) { return CaseDeadline.Type.CUSTOM; }
    }

    private DeadlineDto toDto(CaseDeadline d) {
        return new DeadlineDto(d.getId(), d.getCaseId(), d.getTitle(), d.getDescription(),
                d.getDeadlineType().name(), d.getDeadlineDate(), d.getLinkedDocId(),
                d.isCompleted(), d.getCompletedAt(), d.getCreatedAt());
    }
}

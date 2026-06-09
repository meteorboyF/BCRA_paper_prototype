package com.pangochain.backend.milestone;

import com.pangochain.backend.audit.AuditService;
import com.pangochain.backend.milestone.MilestoneDtos.CreateMilestoneRequest;
import com.pangochain.backend.milestone.MilestoneDtos.MilestoneDto;
import com.pangochain.backend.milestone.MilestoneDtos.UpdateMilestoneRequest;
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
public class MilestoneService {

    private final CaseMilestoneRepository repository;
    private final AuditService auditService;

    @Transactional(readOnly = true)
    public List<MilestoneDto> list(UUID caseId) {
        return repository.findByCaseIdOrderBySortOrderAscCreatedAtAsc(caseId).stream()
                .map(this::toDto).toList();
    }

    @Transactional
    public MilestoneDto create(UUID caseId, CreateMilestoneRequest req, User author) {
        CaseMilestone.Status status = parseStatus(req.status(), CaseMilestone.Status.PENDING);
        CaseMilestone m = repository.save(CaseMilestone.builder()
                .caseId(caseId)
                .title(req.title())
                .description(req.description())
                .status(status)
                .targetDate(req.targetDateEpochMs() != null ? Instant.ofEpochMilli(req.targetDateEpochMs()) : null)
                .completedAt(status == CaseMilestone.Status.COMPLETED ? Instant.now() : null)
                .sortOrder(req.sortOrder() != null ? req.sortOrder() : 0)
                .createdBy(author.getId())
                .build());
        auditService.log("MILESTONE_ADDED", author.getId(), "CASE", caseId.toString(), null,
                "{\"title\":\"" + req.title().replace("\"", "'") + "\",\"status\":\"" + status + "\"}");
        return toDto(m);
    }

    @Transactional
    public MilestoneDto update(UUID caseId, UUID milestoneId, UpdateMilestoneRequest req, User actor) {
        CaseMilestone m = repository.findById(milestoneId)
                .orElseThrow(() -> new IllegalArgumentException("Milestone not found"));
        if (!m.getCaseId().equals(caseId)) {
            throw new IllegalArgumentException("Milestone does not belong to this case");
        }
        if (req.title() != null && !req.title().isBlank()) m.setTitle(req.title());
        if (req.description() != null) m.setDescription(req.description());
        if (req.sortOrder() != null) m.setSortOrder(req.sortOrder());
        if (req.targetDateEpochMs() != null) m.setTargetDate(Instant.ofEpochMilli(req.targetDateEpochMs()));
        if (req.status() != null) {
            CaseMilestone.Status status = parseStatus(req.status(), m.getStatus());
            m.setStatus(status);
            // Stamp/clear the completion time as the status crosses the COMPLETED boundary.
            if (status == CaseMilestone.Status.COMPLETED && m.getCompletedAt() == null) m.setCompletedAt(Instant.now());
            if (status != CaseMilestone.Status.COMPLETED) m.setCompletedAt(null);
        }
        m = repository.save(m);
        auditService.log("MILESTONE_UPDATED", actor.getId(), "CASE", caseId.toString(), null,
                "{\"milestone\":\"" + m.getTitle().replace("\"", "'") + "\",\"status\":\"" + m.getStatus() + "\"}");
        return toDto(m);
    }

    @Transactional
    public void delete(UUID caseId, UUID milestoneId, User actor) {
        CaseMilestone m = repository.findById(milestoneId)
                .orElseThrow(() -> new IllegalArgumentException("Milestone not found"));
        if (!m.getCaseId().equals(caseId)) {
            throw new IllegalArgumentException("Milestone does not belong to this case");
        }
        repository.delete(m);
        auditService.log("MILESTONE_DELETED", actor.getId(), "CASE", caseId.toString(), null, null);
    }

    private CaseMilestone.Status parseStatus(String raw, CaseMilestone.Status fallback) {
        if (raw == null || raw.isBlank()) return fallback;
        try { return CaseMilestone.Status.valueOf(raw.toUpperCase()); }
        catch (IllegalArgumentException e) { return fallback; }
    }

    private MilestoneDto toDto(CaseMilestone m) {
        return new MilestoneDto(m.getId(), m.getCaseId(), m.getTitle(), m.getDescription(),
                m.getStatus().name(), m.getTargetDate(), m.getCompletedAt(), m.getSortOrder(), m.getCreatedAt());
    }
}

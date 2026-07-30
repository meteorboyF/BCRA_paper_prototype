package com.pangochain.backend.access;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface PendingAnchorRepository extends JpaRepository<PendingAnchor, UUID> {

    List<PendingAnchor> findByStatusAndNextAttemptAtBefore(
            PendingAnchor.Status status, Instant cutoff, Pageable pageable);
}

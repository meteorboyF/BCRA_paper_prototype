package com.pangochain.backend.cases.conflict;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface ConflictCheckLogRepository extends JpaRepository<ConflictCheckLog, UUID> {
}

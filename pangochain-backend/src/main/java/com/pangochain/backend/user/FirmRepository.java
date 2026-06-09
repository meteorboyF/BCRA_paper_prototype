package com.pangochain.backend.user;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface FirmRepository extends JpaRepository<Firm, UUID> {
    Optional<Firm> findByMspId(String mspId);
}

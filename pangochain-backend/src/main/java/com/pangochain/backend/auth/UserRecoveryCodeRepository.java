package com.pangochain.backend.auth;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface UserRecoveryCodeRepository extends JpaRepository<UserRecoveryCode, UUID> {

    List<UserRecoveryCode> findByUserIdAndUsedFalse(UUID userId);

    long countByUserIdAndUsedFalse(UUID userId);

    @Modifying
    @Query("DELETE FROM UserRecoveryCode c WHERE c.userId = :userId")
    void deleteAllForUser(@Param("userId") UUID userId);
}

package com.pangochain.backend.reminder;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.UUID;

public interface ReminderRepository extends JpaRepository<Reminder, UUID> {
    // JOIN FETCH sender + legalCase so ReminderDto.from works after the session closes
    // (open-in-view=false). recipient is set from the already-loaded principal context.
    @Query("SELECT r FROM Reminder r JOIN FETCH r.sender LEFT JOIN FETCH r.legalCase " +
           "WHERE r.recipient.id = :recipientId ORDER BY r.createdAt DESC")
    List<Reminder> findByRecipientIdOrderByCreatedAtDesc(UUID recipientId);
    long countByRecipientIdAndReadFalse(UUID recipientId);
}

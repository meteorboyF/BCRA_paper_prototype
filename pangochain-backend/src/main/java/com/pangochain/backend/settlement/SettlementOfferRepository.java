package com.pangochain.backend.settlement;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface SettlementOfferRepository extends JpaRepository<SettlementOffer, UUID> {
    List<SettlementOffer> findByCaseIdOrderByCreatedAtDesc(UUID caseId);
}

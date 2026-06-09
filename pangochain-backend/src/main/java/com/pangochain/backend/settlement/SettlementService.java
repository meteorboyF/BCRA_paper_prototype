package com.pangochain.backend.settlement;

import com.pangochain.backend.audit.AuditService;
import com.pangochain.backend.notification.NotificationService;
import com.pangochain.backend.settlement.SettlementDtos.*;
import com.pangochain.backend.user.User;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class SettlementService {

    private final SettlementOfferRepository offerRepository;
    private final AuditService auditService;
    private final NotificationService notificationService;

    @PersistenceContext
    private EntityManager em;

    @Transactional
    public OfferDto addOffer(UUID caseId, CreateOfferRequest req, User author) {
        SettlementOffer offer = offerRepository.save(SettlementOffer.builder()
                .caseId(caseId)
                .title(req.title())
                .monetaryValueCents(req.monetaryValueCents())
                .currency(req.currency() != null && !req.currency().isBlank() ? req.currency() : "USD")
                .nonMonetaryTerms(req.nonMonetaryTerms())
                .analysis(req.analysis())
                .createdBy(author.getId())
                .build());
        auditService.log("SETTLEMENT_OFFER_ADDED", author.getId(), "CASE", caseId.toString(), null,
                String.format("{\"offer\":\"%s\",\"valueCents\":%d}", offer.getId(), req.monetaryValueCents()));
        return toDto(offer);
    }

    @Transactional(readOnly = true)
    public List<OfferDto> listForCase(UUID caseId) {
        return offerRepository.findByCaseIdOrderByCreatedAtDesc(caseId).stream().map(this::toDto).toList();
    }

    /** Client accepts or rejects an offer. Verifies the responder is a client on the case, anchors
     *  the response on the ledger, and notifies the lawyer who created the offer. */
    @Transactional
    public OfferDto respond(UUID offerId, RespondRequest req, User client) {
        SettlementOffer offer = offerRepository.findById(offerId)
                .orElseThrow(() -> new IllegalArgumentException("Settlement offer not found"));
        if (!isClientOnCase(offer.getCaseId(), client.getId()))
            throw new AccessDeniedException("You are not a client on this case");
        if (!"PROPOSED".equals(offer.getStatus()))
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "This offer has already been " + offer.getStatus().toLowerCase());

        offer.setStatus(req.response());
        offer.setRespondedAt(Instant.now());
        offer.setRespondedBy(client.getId());
        offerRepository.save(offer);

        auditService.log("RECORD_SETTLEMENT_RESPONSE", client.getId(), "CASE", offer.getCaseId().toString(), null,
                String.format("{\"offer\":\"%s\",\"response\":\"%s\"}", offer.getId(), req.response()));

        if (offer.getCreatedBy() != null) {
            notificationService.push(offer.getCreatedBy(), "SETTLEMENT_RESPONSE",
                    "Client " + req.response().toLowerCase() + " the settlement offer: " + offer.getTitle());
        }
        return toDto(offer);
    }

    @SuppressWarnings("unchecked")
    private boolean isClientOnCase(UUID caseId, UUID clientId) {
        List<?> rows = em.createNativeQuery(
                "SELECT 1 FROM case_clients WHERE case_id = :c AND client_id = :u")
                .setParameter("c", caseId).setParameter("u", clientId).getResultList();
        return !rows.isEmpty();
    }

    private OfferDto toDto(SettlementOffer o) {
        return new OfferDto(o.getId(), o.getCaseId(), o.getTitle(), o.getMonetaryValueCents(), o.getCurrency(),
                o.getNonMonetaryTerms(), o.getAnalysis(), o.getStatus(),
                o.getRespondedAt(), o.getRespondedBy(), o.getCreatedBy(), o.getCreatedAt());
    }
}

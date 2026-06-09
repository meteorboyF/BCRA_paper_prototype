--liquibase formatted sql

-- Sprint 3: Settlement Offer Comparison. The lawyer adds structured settlement offers to a case;
-- the client compares them side by side and marks one Accepted or Rejected. The response is anchored
-- on the ledger (RECORD_SETTLEMENT_RESPONSE audit event) and pushed to the lawyer as a notification.
-- Monetary values are stored in integer cents to avoid floating-point drift.

--changeset pangochain:019-settlement-offers
CREATE TABLE settlement_offers (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id              UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    title                VARCHAR(160) NOT NULL,
    monetary_value_cents BIGINT NOT NULL DEFAULT 0,
    currency             VARCHAR(8) NOT NULL DEFAULT 'USD',
    non_monetary_terms   TEXT,
    analysis             TEXT,
    status               VARCHAR(16) NOT NULL DEFAULT 'PROPOSED',
    responded_at         TIMESTAMPTZ,
    responded_by         UUID REFERENCES users(id),
    created_by           UUID REFERENCES users(id),
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_settlement_offers_case ON settlement_offers(case_id);
--rollback DROP TABLE settlement_offers;

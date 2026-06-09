--liquibase formatted sql

-- Sprint 2: GDPR privacy dashboard. Clients can see an inventory of the data the firm holds
-- about them and submit an erasure request, tracked through a review workflow. Ledger entries
-- are immutable by design (disclosed to the client); only non-ledger data is in scope.

--changeset pangochain:016-deletion-requests
CREATE TABLE deletion_requests (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status        VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    reason        TEXT,
    resolution    TEXT,
    processed_by  UUID REFERENCES users(id),
    processed_at  TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_deletion_requests_status ON deletion_requests(status);
CREATE INDEX idx_deletion_requests_user ON deletion_requests(user_id);
--rollback DROP TABLE deletion_requests;

--liquibase formatted sql

-- Durable outbox for chaincode submits that must eventually reach the ledger.
-- Fixes bcra_peer_review.md M1 / Experiment 16: RevokeAccess previously caught a Fabric
-- submit failure, logged it, and returned success — leaving the on-chain grant ACTIVE
-- forever with no reconciliation once the orderers recovered. AccessControlService#revoke
-- now writes a row here in the same transaction as the operational DB update, and
-- AnchorReconciliationWorker drains PENDING rows on a schedule with backoff until they commit.

--changeset pangochain:027-pending-anchor
CREATE TABLE pending_anchor (
    id                 UUID PRIMARY KEY,
    chaincode_function VARCHAR(64)  NOT NULL,
    doc_id             UUID         NOT NULL,
    target_user_id     UUID         NOT NULL,
    revoker_id         UUID         NOT NULL,
    status             VARCHAR(16)  NOT NULL,
    attempts           INTEGER      NOT NULL DEFAULT 0,
    next_attempt_at    TIMESTAMPTZ,
    created_at         TIMESTAMPTZ  NOT NULL,
    committed_at       TIMESTAMPTZ,
    fabric_tx_id       VARCHAR(128),
    last_error         TEXT
);
--rollback DROP TABLE pending_anchor;

--changeset pangochain:027-idx-pending-anchor-poll
-- The reconciliation worker's hot query: pending rows due for retry.
CREATE INDEX IF NOT EXISTS idx_pending_anchor_poll
    ON pending_anchor(status, next_attempt_at);
--rollback DROP INDEX IF EXISTS idx_pending_anchor_poll;

--changeset pangochain:027-idx-pending-anchor-doc
-- Look up an anchor's status by document/user for the audit trail and UI.
CREATE INDEX IF NOT EXISTS idx_pending_anchor_doc
    ON pending_anchor(doc_id, target_user_id);
--rollback DROP INDEX IF EXISTS idx_pending_anchor_doc;

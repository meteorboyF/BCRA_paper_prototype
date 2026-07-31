--liquibase formatted sql

-- Checkpoint table for batched audit anchoring (Experiment 14b, reviewer M3).
--
-- audit_log is append-only, enforced by the audit_log_no_modify trigger, so anchoring
-- status cannot be stamped onto the audit rows themselves - and weakening that trigger to
-- make anchoring easier would trade away the tamper-evidence the design depends on. The
-- anchoring metadata therefore lives beside the log instead of inside it.
--
-- Each row records a contiguous audit_log id range, the digest computed over it, and the
-- ledger transaction that anchored that digest. The highest committed last_audit_id acts as
-- a watermark: everything above it is the anchoring backlog. Because audit rows are written
-- to PostgreSQL before any anchoring is attempted, that backlog is durable and survives
-- restart, which is the property the fire-and-forget pipeline lacked.

--changeset pangochain:028-audit-anchor-batch
CREATE TABLE audit_anchor_batch (
    id              BIGSERIAL PRIMARY KEY,
    first_audit_id  BIGINT       NOT NULL,
    last_audit_id   BIGINT       NOT NULL,
    event_count     INTEGER      NOT NULL,
    digest          VARCHAR(64)  NOT NULL,
    status          VARCHAR(16)  NOT NULL,
    attempts        INTEGER      NOT NULL DEFAULT 0,
    fabric_tx_id    VARCHAR(128),
    last_error      TEXT,
    created_at      TIMESTAMPTZ  NOT NULL,
    committed_at    TIMESTAMPTZ
);
--rollback DROP TABLE audit_anchor_batch;

--changeset pangochain:028-idx-audit-anchor-watermark
-- Hot query: the current watermark, i.e. the highest anchored audit id.
CREATE INDEX IF NOT EXISTS idx_audit_anchor_watermark
    ON audit_anchor_batch(status, last_audit_id DESC);
--rollback DROP INDEX IF EXISTS idx_audit_anchor_watermark;

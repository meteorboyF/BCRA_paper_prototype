--liquibase formatted sql

-- Extends the durable outbox (027) from RevokeAccess to GrantAccess.
-- Experiment 16 established that a revocation issued during an ordering outage was
-- silently dropped; 027/16b bounded that divergence with a transactional outbox.
-- grant() retained the original fire-and-forget behavior: a grant issued during an
-- outage updated the operational ACL and was never anchored, the same defect on the
-- other write path. GrantAccess replay needs the full argument set at drain time
-- (capability, expiry, wrapped key reference, grantee MSP), which the 027 columns do
-- not carry; they are stored as a JSON payload so future anchored functions can reuse
-- the column without further migrations.

--changeset pangochain:029-grant-anchor-payload
ALTER TABLE pending_anchor ADD COLUMN payload TEXT;
--rollback ALTER TABLE pending_anchor DROP COLUMN payload;

--changeset pangochain:029-idx-pending-anchor-fifo
-- The reconciliation worker drains anchors for the same (doc, user) in creation order,
-- so a grant queued before a revoke can never be replayed after it. This index backs
-- the older-sibling existence check on that path.
CREATE INDEX IF NOT EXISTS idx_pending_anchor_fifo
    ON pending_anchor(doc_id, target_user_id, status, created_at);
--rollback DROP INDEX IF EXISTS idx_pending_anchor_fifo;

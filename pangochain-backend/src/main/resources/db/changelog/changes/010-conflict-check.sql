--liquibase formatted sql

-- Sprint 1: Conflict-of-interest checker. Cases gain structured party names so a new
-- matter can be fuzzy-matched against existing/closed matters for the same or related
-- parties. Every check is recorded with its result and the acknowledging user.

--changeset pangochain:010-case-parties
ALTER TABLE cases ADD COLUMN client_name VARCHAR(300);
ALTER TABLE cases ADD COLUMN opposing_party VARCHAR(300);
ALTER TABLE cases ADD COLUMN related_parties TEXT;

--changeset pangochain:010-conflict-check-log
CREATE TABLE conflict_check_log (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firm_id          UUID,
    requested_by     UUID REFERENCES users(id),
    query_terms      TEXT,
    match_count      INT NOT NULL DEFAULT 0,
    matched_case_ids TEXT,
    acknowledged     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_conflict_log_firm ON conflict_check_log(firm_id);
--rollback DROP TABLE conflict_check_log; ALTER TABLE cases DROP COLUMN client_name; ALTER TABLE cases DROP COLUMN opposing_party; ALTER TABLE cases DROP COLUMN related_parties;

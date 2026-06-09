--liquibase formatted sql

-- Sprint 2: client satisfaction & feedback. Clients rate service (1–5 + free text), optionally
-- tied to a case and a context (hearing, case closure, general). Managing Partner sees aggregates.

--changeset pangochain:017-feedback
CREATE TABLE feedback_responses (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    case_id     UUID REFERENCES cases(id) ON DELETE SET NULL,
    rating      INT NOT NULL,
    comment     TEXT,
    context     VARCHAR(30) NOT NULL DEFAULT 'GENERAL',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_feedback_case ON feedback_responses(case_id);
--rollback DROP TABLE feedback_responses;

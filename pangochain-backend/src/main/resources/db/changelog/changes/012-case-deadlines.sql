--liquibase formatted sql

-- Sprint 1: deadline & statute-of-limitations tracker. Per-case tracked dates with type and
-- optional linked evidence; the UI colour-codes urgency. Missing a legal deadline is malpractice,
-- so creation is audited.

--changeset pangochain:012-case-deadlines
CREATE TABLE case_deadlines (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id        UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    title          VARCHAR(200) NOT NULL,
    description    TEXT,
    deadline_type  VARCHAR(40) NOT NULL DEFAULT 'CUSTOM',
    deadline_date  TIMESTAMPTZ NOT NULL,
    linked_doc_id  UUID,
    completed      BOOLEAN NOT NULL DEFAULT FALSE,
    completed_at   TIMESTAMPTZ,
    created_by     UUID REFERENCES users(id),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_case_deadlines_case ON case_deadlines(case_id);
CREATE INDEX idx_case_deadlines_date ON case_deadlines(deadline_date);
--rollback DROP TABLE case_deadlines;

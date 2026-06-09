--liquibase formatted sql

-- Sprint 1: client-facing case progress timeline. Lawyer-managed milestones (Intake,
-- Discovery, Pre-Trial, Hearing, Resolution …) give clients visibility into where their
-- matter stands. Lawyer write / client read.

--changeset pangochain:011-case-milestones
CREATE TABLE case_milestones (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id        UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    title          VARCHAR(200) NOT NULL,
    description    TEXT,
    status         VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    target_date    TIMESTAMPTZ,
    completed_at   TIMESTAMPTZ,
    sort_order     INT NOT NULL DEFAULT 0,
    created_by     UUID REFERENCES users(id),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_case_milestones_case ON case_milestones(case_id);
--rollback DROP TABLE case_milestones;

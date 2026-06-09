--liquibase formatted sql

--changeset pangochain:002-hearings
CREATE TABLE hearings (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id       UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    title         VARCHAR(500) NOT NULL,
    hearing_date  TIMESTAMPTZ NOT NULL,
    location      VARCHAR(500),
    court_name    VARCHAR(500),
    hearing_type  VARCHAR(100) NOT NULL DEFAULT 'COURT_HEARING',
    notes         TEXT,
    created_by    UUID REFERENCES users(id),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_hearings_case ON hearings(case_id);
CREATE INDEX idx_hearings_date ON hearings(hearing_date);

--changeset pangochain:002-reminders
CREATE TABLE reminders (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id       UUID REFERENCES cases(id) ON DELETE CASCADE,
    sender_id     UUID NOT NULL REFERENCES users(id),
    recipient_id  UUID NOT NULL REFERENCES users(id),
    title         VARCHAR(500) NOT NULL,
    body          TEXT,
    due_at        TIMESTAMPTZ,
    is_read       BOOLEAN NOT NULL DEFAULT false,
    priority      VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_reminders_recipient ON reminders(recipient_id);
CREATE INDEX idx_reminders_case ON reminders(case_id);

--changeset pangochain:002-case-events
CREATE TABLE case_events (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id       UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    event_type    VARCHAR(100) NOT NULL,
    title         VARCHAR(500) NOT NULL,
    description   TEXT,
    fabric_tx_id  VARCHAR(255),
    actor_id      UUID REFERENCES users(id),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_case_events_case ON case_events(case_id);

--changeset pangochain:002-document-category
ALTER TABLE documents
    ADD COLUMN IF NOT EXISTS category VARCHAR(100) NOT NULL DEFAULT 'GENERAL',
    ADD COLUMN IF NOT EXISTS confidential BOOLEAN NOT NULL DEFAULT false;

--changeset pangochain:002-case-client-link
-- Stores which client user is associated with which case (for client portal)
CREATE TABLE IF NOT EXISTS case_clients (
    case_id     UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    client_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    added_by    UUID REFERENCES users(id),
    added_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (case_id, client_id)
);

--changeset pangochain:002-varchar-enum-casts
-- Allow Hibernate (EnumType.STRING) to bind varchar parameters to PostgreSQL custom enum columns
CREATE CAST (VARCHAR AS user_role) WITH INOUT AS IMPLICIT;
CREATE CAST (VARCHAR AS account_status) WITH INOUT AS IMPLICIT;
CREATE CAST (VARCHAR AS case_status) WITH INOUT AS IMPLICIT;
CREATE CAST (VARCHAR AS doc_status) WITH INOUT AS IMPLICIT;
CREATE CAST (VARCHAR AS capability) WITH INOUT AS IMPLICIT;

--rollback DROP CAST (VARCHAR AS user_role); DROP CAST (VARCHAR AS account_status); DROP CAST (VARCHAR AS case_status); DROP CAST (VARCHAR AS doc_status); DROP CAST (VARCHAR AS capability);

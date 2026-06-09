--liquibase formatted sql

-- Sprint 2: billing matter integration & time tracking. Time entries link billable work to a
-- case (and optionally a document); invoices snapshot an amount per case. Amounts are stored in
-- integer cents to avoid floating-point drift.

--changeset pangochain:015-time-entries
CREATE TABLE time_entries (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id        UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    user_id        UUID REFERENCES users(id),
    description    VARCHAR(500) NOT NULL,
    minutes        INT NOT NULL DEFAULT 0,
    rate_cents     INT NOT NULL DEFAULT 0,
    linked_doc_id  UUID,
    entry_date     TIMESTAMPTZ NOT NULL DEFAULT now(),
    invoiced       BOOLEAN NOT NULL DEFAULT FALSE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_time_entries_case ON time_entries(case_id);

--changeset pangochain:015-invoices
CREATE TABLE invoices (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id        UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    invoice_number VARCHAR(40) NOT NULL,
    status         VARCHAR(20) NOT NULL DEFAULT 'SENT',
    amount_cents   BIGINT NOT NULL DEFAULT 0,
    minutes_total  INT NOT NULL DEFAULT 0,
    created_by     UUID REFERENCES users(id),
    issued_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_invoices_case ON invoices(case_id);
--rollback DROP TABLE invoices; DROP TABLE time_entries;

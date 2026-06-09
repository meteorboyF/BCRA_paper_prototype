--liquibase formatted sql

-- Sprint 2: AI document classification & auto-tagging. Records each category suggestion and
-- (if known) the category the user accepted, for transparency and future model feedback.
-- The classifier itself is a server-side heuristic stub behind a clean interface — no
-- ciphertext is ever sent to it (only filename + a user-supplied plaintext-side preview).

--changeset pangochain:013-doc-classification-log
CREATE TABLE document_classification_log (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doc_id             UUID,
    file_name          TEXT,
    suggested_category VARCHAR(50),
    confidence         INT NOT NULL DEFAULT 0,
    accepted_category  VARCHAR(50),
    requested_by       UUID REFERENCES users(id),
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_doc_classification_user ON document_classification_log(requested_by);
--rollback DROP TABLE document_classification_log;

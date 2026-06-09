--liquibase formatted sql

-- Sprint 3: Client-Side Document Redaction. A lawyer produces a redacted copy of a document entirely
-- in the browser (the server never sees the pre-redaction plaintext). The redacted copy is encrypted
-- with a fresh key and uploaded as a new document/CID; this table records the parent->child CID pair
-- and the redacting user, and the relationship is anchored on the ledger (RECORD_REDACTION).

--changeset pangochain:022-document-redactions
CREATE TABLE document_redactions (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    original_doc_id   UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    redacted_doc_id   UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    original_cid      VARCHAR(128),
    redacted_cid      VARCHAR(128),
    redaction_count   INT NOT NULL DEFAULT 0,
    redacting_user_id UUID REFERENCES users(id),
    fabric_tx_id      VARCHAR(128),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_doc_redactions_original ON document_redactions(original_doc_id);
--rollback DROP TABLE document_redactions;

--liquibase formatted sql

--changeset pangochain:003-key-rotation-pending
-- Tracks whether a document requires key rotation after a revocation event.
-- Set by FabricEventHandler on KEY_ROTATION_REQUIRED chaincode event.
ALTER TABLE documents
    ADD COLUMN IF NOT EXISTS key_rotation_pending BOOLEAN NOT NULL DEFAULT FALSE;

--rollback ALTER TABLE documents DROP COLUMN IF EXISTS key_rotation_pending;

--changeset pangochain:003-token-obsolete
-- Marks document_access tokens that are no longer trustworthy after key rotation.
-- Old tokens remain in the table for audit purposes but must not be used.
ALTER TABLE document_access
    ADD COLUMN IF NOT EXISTS token_obsolete BOOLEAN NOT NULL DEFAULT FALSE;

--rollback ALTER TABLE document_access DROP COLUMN IF EXISTS token_obsolete;

--changeset pangochain:003-esignatures-document-hash
-- Add the plaintext document hash to esignatures so the signed hash is verifiable.
ALTER TABLE esignatures
    ADD COLUMN IF NOT EXISTS document_hash VARCHAR(128);

--rollback ALTER TABLE esignatures DROP COLUMN IF EXISTS document_hash;

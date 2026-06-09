--liquibase formatted sql

--changeset pangochain:004-user-signing-public-key
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS signing_public_key TEXT;
--rollback ALTER TABLE users DROP COLUMN IF EXISTS signing_public_key;

--changeset pangochain:004-esignatures-signature-hash-nullable
-- Make old ECDH-proof column nullable to allow new ECDSA-only rows
ALTER TABLE esignatures
    ALTER COLUMN signature_hash DROP NOT NULL;
--rollback ALTER TABLE esignatures ALTER COLUMN signature_hash SET NOT NULL;

--changeset pangochain:004-esignatures-ecdsa-columns
ALTER TABLE esignatures
    ADD COLUMN IF NOT EXISTS signature_b64        TEXT,
    ADD COLUMN IF NOT EXISTS document_hash_b64    TEXT,
    ADD COLUMN IF NOT EXISTS signing_public_key   TEXT,
    ADD COLUMN IF NOT EXISTS verification_status  VARCHAR(20) DEFAULT 'PENDING';
--rollback ALTER TABLE esignatures DROP COLUMN IF EXISTS signature_b64; ALTER TABLE esignatures DROP COLUMN IF EXISTS document_hash_b64; ALTER TABLE esignatures DROP COLUMN IF EXISTS signing_public_key; ALTER TABLE esignatures DROP COLUMN IF EXISTS verification_status;

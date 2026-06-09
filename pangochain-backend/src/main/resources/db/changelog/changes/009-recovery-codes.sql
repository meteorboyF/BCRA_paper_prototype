--liquibase formatted sql

-- Sprint 1: TOTP recovery codes. Ten single-use codes issued at MFA enrolment, stored
-- only as PBKDF2-SHA256 hashes (never plaintext). A code lets a locked-out user complete
-- one login and is then consumed; using one forces MFA re-enrolment.

--changeset pangochain:009-recovery-codes
CREATE TABLE user_recovery_codes (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code_hash   TEXT NOT NULL,
    salt        TEXT NOT NULL,
    used        BOOLEAN NOT NULL DEFAULT FALSE,
    used_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_recovery_codes_user ON user_recovery_codes(user_id);
--rollback DROP TABLE user_recovery_codes;

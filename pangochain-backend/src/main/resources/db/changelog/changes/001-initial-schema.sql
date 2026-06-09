--liquibase formatted sql

--changeset pangochain:001-firms
CREATE TABLE firms (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(255) NOT NULL UNIQUE,
    msp_id      VARCHAR(100) UNIQUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

--rollback DROP TABLE firms;

--changeset pangochain:001-insert-default-firms
INSERT INTO firms (name, msp_id) VALUES
    ('Law Firm A', 'FirmAMSP'),
    ('Law Firm B', 'FirmBMSP'),
    ('Law Firm C', 'FirmCMSP'),
    ('Regulator Office', 'RegulatorMSP');

--rollback DELETE FROM firms WHERE msp_id IN ('FirmAMSP','FirmBMSP','FirmCMSP','RegulatorMSP');

--changeset pangochain:001-users
CREATE TYPE user_role AS ENUM (
    'MANAGING_PARTNER', 'PARTNER_SENIOR', 'PARTNER_JUNIOR',
    'ASSOCIATE_SENIOR', 'ASSOCIATE_JUNIOR', 'SECRETARY',
    'IT_ADMIN', 'PARALEGAL', 'REGULATOR',
    'CLIENT_PRIMARY', 'CLIENT_SECONDARY', 'CLIENT_CORP_ADMIN'
);

CREATE TYPE account_status AS ENUM (
    'PENDING_APPROVAL', 'ACTIVE', 'SUSPENDED', 'DEACTIVATED'
);

CREATE TABLE users (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email               VARCHAR(320) NOT NULL UNIQUE,
    password_hash       VARCHAR(512) NOT NULL,
    salt                VARCHAR(128) NOT NULL,
    full_name           VARCHAR(255) NOT NULL,
    role                user_role NOT NULL,
    firm_id             UUID REFERENCES firms(id),
    fabric_identity_id  VARCHAR(255),
    public_key_ecies    TEXT,
    mfa_secret          VARCHAR(128),
    mfa_enabled         BOOLEAN NOT NULL DEFAULT FALSE,
    status              account_status NOT NULL DEFAULT 'PENDING_APPROVAL',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_login_at       TIMESTAMPTZ
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_firm_id ON users(firm_id);
CREATE INDEX idx_users_role ON users(role);

--rollback DROP TABLE users; DROP TYPE account_status; DROP TYPE user_role;

--changeset pangochain:001-cases
CREATE TYPE case_status AS ENUM ('ACTIVE', 'CLOSED', 'ARCHIVED');

CREATE TABLE cases (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title         VARCHAR(500) NOT NULL,
    description   TEXT,
    case_type     VARCHAR(100),
    firm_id       UUID NOT NULL REFERENCES firms(id),
    created_by    UUID NOT NULL REFERENCES users(id),
    status        case_status NOT NULL DEFAULT 'ACTIVE',
    fabric_tx_id  VARCHAR(128),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    closed_at     TIMESTAMPTZ
);

CREATE INDEX idx_cases_firm ON cases(firm_id);
CREATE INDEX idx_cases_status ON cases(status);

CREATE TABLE case_members (
    case_id      UUID NOT NULL REFERENCES cases(id),
    user_id      UUID NOT NULL REFERENCES users(id),
    role_in_case VARCHAR(100),
    added_by     UUID REFERENCES users(id),
    added_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY  (case_id, user_id)
);

--rollback DROP TABLE case_members; DROP TABLE cases; DROP TYPE case_status;

--changeset pangochain:001-documents
CREATE TYPE doc_status AS ENUM ('ACTIVE', 'DELETED', 'SUPERSEDED');

CREATE TABLE documents (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id               UUID NOT NULL REFERENCES cases(id),
    file_name             VARCHAR(500) NOT NULL,
    ipfs_cid              VARCHAR(128) NOT NULL,
    document_hash_sha256  VARCHAR(64) NOT NULL,
    fabric_tx_id          VARCHAR(128),
    owner_id              UUID NOT NULL REFERENCES users(id),
    version               INTEGER NOT NULL DEFAULT 1,
    previous_version_id   UUID REFERENCES documents(id),
    status                doc_status NOT NULL DEFAULT 'ACTIVE',
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_docs_case ON documents(case_id);
CREATE INDEX idx_docs_owner ON documents(owner_id);

CREATE TYPE capability AS ENUM ('owner', 'write', 'read');

CREATE TABLE document_access (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doc_id        UUID NOT NULL REFERENCES documents(id),
    user_id       UUID NOT NULL REFERENCES users(id),
    capability    capability NOT NULL,
    granted_by    UUID REFERENCES users(id),
    granted_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at    TIMESTAMPTZ,
    revoked_at    TIMESTAMPTZ,
    revoked_by    UUID REFERENCES users(id),
    -- Base64-encoded ECIES-wrapped AES-256 document key
    wrapped_key_token TEXT NOT NULL
);

CREATE INDEX idx_doc_access_doc ON document_access(doc_id);
CREATE INDEX idx_doc_access_user ON document_access(user_id);
CREATE UNIQUE INDEX idx_doc_access_unique ON document_access(doc_id, user_id)
    WHERE revoked_at IS NULL;

--rollback DROP TABLE document_access; DROP TABLE documents; DROP TYPE capability; DROP TYPE doc_status;

--changeset pangochain:001-messages
CREATE TABLE messages (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id         UUID NOT NULL REFERENCES users(id),
    recipient_id      UUID NOT NULL REFERENCES users(id),
    case_id           UUID REFERENCES cases(id),
    encrypted_payload TEXT NOT NULL,
    wrapped_key_token TEXT NOT NULL,
    read_at           TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_case ON messages(case_id);
CREATE INDEX idx_messages_recipient ON messages(recipient_id);

--rollback DROP TABLE messages;

--changeset pangochain:001-esignatures
CREATE TABLE esignatures (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id    UUID NOT NULL REFERENCES documents(id),
    signer_id      UUID NOT NULL REFERENCES users(id),
    signature_hash VARCHAR(128) NOT NULL,
    fabric_tx_id   VARCHAR(128),
    signed_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

--rollback DROP TABLE esignatures;

--changeset pangochain:001-notifications
CREATE TABLE notifications (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES users(id),
    type         VARCHAR(100) NOT NULL,
    message      TEXT NOT NULL,
    read         BOOLEAN NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, read);

--rollback DROP TABLE notifications;

--changeset pangochain:001-audit-log
-- Append-only audit shadow log (P4-A requirement)
CREATE TABLE audit_log (
    id             BIGSERIAL PRIMARY KEY,
    event_type     VARCHAR(100) NOT NULL,
    actor_id       UUID,
    actor_role     VARCHAR(100),
    resource_type  VARCHAR(100),
    resource_id    VARCHAR(255),
    fabric_tx_id   VARCHAR(128),
    timestamp      TIMESTAMPTZ NOT NULL DEFAULT now(),
    metadata_json  TEXT,
    ip_address     VARCHAR(45)
);

CREATE INDEX idx_audit_actor ON audit_log(actor_id);
CREATE INDEX idx_audit_resource ON audit_log(resource_id);
CREATE INDEX idx_audit_timestamp ON audit_log(timestamp DESC);

--rollback DROP TABLE audit_log;

--changeset pangochain:001-audit-append-only-trigger splitStatements:false
-- INSERT-only trigger: blocks UPDATE and DELETE on audit_log (P4-A append-only guarantee)
CREATE OR REPLACE FUNCTION audit_log_prevent_modification()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        RAISE EXCEPTION 'audit_log is append-only: UPDATE not permitted';
    ELSIF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'audit_log is append-only: DELETE not permitted';
    END IF;
    RETURN NULL;
END;
$$;

CREATE TRIGGER audit_log_no_modify
    BEFORE UPDATE OR DELETE ON audit_log
    FOR EACH ROW EXECUTE FUNCTION audit_log_prevent_modification();

--rollback DROP TRIGGER audit_log_no_modify ON audit_log; DROP FUNCTION audit_log_prevent_modification();

--changeset pangochain:001-billing
CREATE TABLE billing_matters (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id       UUID NOT NULL REFERENCES cases(id),
    client_id     UUID NOT NULL REFERENCES users(id),
    total_amount  NUMERIC(12,2),
    status        VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

--rollback DROP TABLE billing_matters;

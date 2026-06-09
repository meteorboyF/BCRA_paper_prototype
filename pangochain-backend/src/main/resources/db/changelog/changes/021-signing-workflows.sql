--liquibase formatted sql

-- Sprint 3: Multi-Party Digital Signature Workflow. A lawyer initiates an ordered signing ceremony
-- on a document; each signatory applies an ECDSA P-256 signature over a composite of the document
-- hash, workflow id and signer id (binding the signature to this ceremony). When every signer has
-- signed, the workflow completes and the aggregate proof is anchored on the ledger. A Signing
-- Certificate PDF lists all signatures, timestamps and Fabric tx IDs.

--changeset pangochain:021-signing-workflows
CREATE TABLE signing_workflows (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id       UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    case_id           UUID REFERENCES cases(id) ON DELETE CASCADE,
    title             VARCHAR(200) NOT NULL,
    document_hash_b64 TEXT NOT NULL,
    initiated_by      UUID REFERENCES users(id),
    status            VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    fabric_tx_id      VARCHAR(128),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at      TIMESTAMPTZ
);
CREATE INDEX idx_signing_workflows_doc ON signing_workflows(document_id);

--changeset pangochain:021-signing-requests
CREATE TABLE signing_requests (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id        UUID NOT NULL REFERENCES signing_workflows(id) ON DELETE CASCADE,
    signer_id          UUID NOT NULL REFERENCES users(id),
    sign_order         INT NOT NULL DEFAULT 0,
    status             VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    signature_b64      TEXT,
    signing_public_key TEXT,
    fabric_tx_id       VARCHAR(128),
    signed_at          TIMESTAMPTZ
);
CREATE INDEX idx_signing_requests_workflow ON signing_requests(workflow_id, sign_order);
CREATE INDEX idx_signing_requests_signer ON signing_requests(signer_id, status);
--rollback DROP TABLE signing_requests; DROP TABLE signing_workflows;

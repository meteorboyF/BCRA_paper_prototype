--liquibase formatted sql

-- Sprint 3: Real-Time Collaborative Document Annotation. Authorised case-team members add margin
-- comments to a document; replies thread under a parent; comments can be resolved. Each annotation
-- is bound to a specific document version_hash so comments remain anchored as new versions upload.
-- Live fan-out is over STOMP (/topic/documents/{id}/annotations); this table is the source of truth.

--changeset pangochain:020-document-annotations
CREATE TABLE document_annotations (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id   UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    version_hash  VARCHAR(64),
    parent_id     UUID REFERENCES document_annotations(id) ON DELETE CASCADE,
    page          INT,
    position_json TEXT,
    body          TEXT NOT NULL,
    author_id     UUID REFERENCES users(id),
    status        VARCHAR(16) NOT NULL DEFAULT 'OPEN',
    resolved_by   UUID REFERENCES users(id),
    resolved_at   TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_doc_annotations_doc ON document_annotations(document_id, created_at);
--rollback DROP TABLE document_annotations;

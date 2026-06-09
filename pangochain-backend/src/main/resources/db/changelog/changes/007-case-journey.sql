--liquibase formatted sql

-- Feature 3: case-journey tree. A branching graph of findings/notes/evidence per case.
-- parent_id forms the tree (root = case opening); merge_into_id is an optional dashed
-- "convergence" edge toward a hearing/filing node (visual only in phase 1).

--changeset pangochain:007-case-nodes
CREATE TABLE case_nodes (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id        UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    parent_id      UUID REFERENCES case_nodes(id) ON DELETE CASCADE,
    merge_into_id  UUID REFERENCES case_nodes(id) ON DELETE SET NULL,
    author_id      UUID REFERENCES users(id),
    node_type      VARCHAR(30) NOT NULL DEFAULT 'FINDING',
    title          VARCHAR(300) NOT NULL,
    description    TEXT,
    linked_doc_id  UUID,
    node_date      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_case_nodes_case ON case_nodes(case_id);
CREATE INDEX idx_case_nodes_parent ON case_nodes(parent_id);
--rollback DROP TABLE case_nodes;

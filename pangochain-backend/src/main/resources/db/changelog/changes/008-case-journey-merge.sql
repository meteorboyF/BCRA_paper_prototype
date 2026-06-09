--liquibase formatted sql

-- Feature 3 (phase 2): operational journey merge. The merge_into_id convergence edge
-- becomes a real, audited consolidation: a hearing/filing node can "consolidate" every
-- branch node that converges into it. Consolidated contributors are flagged merged with a
-- timestamp so the visualiser can show a sealed bundle rather than a purely visual hint.

--changeset pangochain:008-case-nodes-merge
ALTER TABLE case_nodes ADD COLUMN merged BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE case_nodes ADD COLUMN merged_at TIMESTAMPTZ;
CREATE INDEX idx_case_nodes_merge_into ON case_nodes(merge_into_id);
--rollback ALTER TABLE case_nodes DROP COLUMN merged; ALTER TABLE case_nodes DROP COLUMN merged_at; DROP INDEX idx_case_nodes_merge_into;

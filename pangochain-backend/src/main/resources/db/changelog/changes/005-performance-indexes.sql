--liquibase formatted sql

-- Performance indexes for hot query paths. Several single-column indexes already exist
-- (001-initial-schema, 002-client-features): idx_audit_actor, idx_audit_resource,
-- idx_audit_timestamp, idx_docs_case, idx_cases_*, idx_messages_recipient/case,
-- idx_hearings_case/date, idx_notifications_user. This changeset adds only the indexes
-- that are missing and back genuinely hot lookups.

--changeset pangochain:005-idx-audit-event-type
-- Audit trail filtered by event type (e.g. ACL_FABRIC_FALLBACK highlighting).
CREATE INDEX IF NOT EXISTS idx_audit_event_type ON audit_log(event_type);
--rollback DROP INDEX IF EXISTS idx_audit_event_type;

--changeset pangochain:005-idx-documents-category
-- Documents page category filter.
CREATE INDEX IF NOT EXISTS idx_docs_category ON documents(category);
--rollback DROP INDEX IF EXISTS idx_docs_category;

--changeset pangochain:005-idx-case-clients-client
-- "Cases for a client" lookup. case_clients PK is (case_id, client_id), so case_id is
-- already covered by the PK; client_id is the trailing column and needs its own index.
CREATE INDEX IF NOT EXISTS idx_case_clients_client ON case_clients(client_id);
--rollback DROP INDEX IF EXISTS idx_case_clients_client;

--changeset pangochain:005-idx-messages-sender
-- Conversation list grouped by sender.
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
--rollback DROP INDEX IF EXISTS idx_messages_sender;

--changeset pangochain:005-idx-messages-unread
-- Unread-count query: WHERE recipient_id = ? AND read_at IS NULL. Composite index lets the
-- planner satisfy both predicates from a single index scan.
CREATE INDEX IF NOT EXISTS idx_messages_unread ON messages(recipient_id, read_at);
--rollback DROP INDEX IF EXISTS idx_messages_unread;

--changeset pangochain:005-idx-hearings-case-date
-- Upcoming hearings per case ordered by date.
CREATE INDEX IF NOT EXISTS idx_hearings_case_date ON hearings(case_id, hearing_date);
--rollback DROP INDEX IF EXISTS idx_hearings_case_date;

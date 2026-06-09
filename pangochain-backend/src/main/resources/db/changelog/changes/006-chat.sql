--liquibase formatted sql

-- Real-time team chat (Slack/Teams-style). Channel messages are encrypted at rest
-- (AES-256-GCM, server-held key) and travel over TLS — distinct from the per-recipient
-- E2E `messages` table, which is unchanged. Conversation types: CASE | FIRM | DIRECT.

--changeset pangochain:006-conversations
CREATE TABLE conversations (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type        VARCHAR(20) NOT NULL,
    firm_id     UUID REFERENCES firms(id) ON DELETE CASCADE,
    case_id     UUID REFERENCES cases(id) ON DELETE CASCADE,
    title       VARCHAR(255),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- One channel per case, one per firm (DIRECT conversations leave both null/keyed differently).
CREATE UNIQUE INDEX uq_conversations_case ON conversations(case_id) WHERE case_id IS NOT NULL;
CREATE UNIQUE INDEX uq_conversations_firm ON conversations(firm_id) WHERE type = 'FIRM';
--rollback DROP TABLE conversations;

--changeset pangochain:006-conversation-members
CREATE TABLE conversation_members (
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    last_read_at    TIMESTAMPTZ,
    added_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (conversation_id, user_id)
);
CREATE INDEX idx_conv_members_user ON conversation_members(user_id);
--rollback DROP TABLE conversation_members;

--changeset pangochain:006-chat-messages
CREATE TABLE chat_messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id       UUID NOT NULL REFERENCES users(id),
    -- AES-256-GCM ciphertext (IV prepended), base64. Encrypted at rest, server-readable.
    body_ciphertext TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_chat_messages_conv ON chat_messages(conversation_id, created_at);
--rollback DROP TABLE chat_messages;

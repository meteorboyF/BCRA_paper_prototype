--liquibase formatted sql

--changeset pangochain:026-ai-chat-sessions
ALTER TABLE ai_conversations
    ADD COLUMN IF NOT EXISTS session_id UUID,
    ADD COLUMN IF NOT EXISTS session_title VARCHAR(160);

WITH grouped_sessions AS (
    SELECT case_id, user_id, gen_random_uuid() AS generated_session_id
    FROM ai_conversations
    WHERE session_id IS NULL
    GROUP BY case_id, user_id
)
UPDATE ai_conversations c
SET session_id = g.generated_session_id,
    session_title = COALESCE(c.session_title, 'Previous AI chat')
FROM grouped_sessions g
WHERE c.session_id IS NULL
  AND c.case_id = g.case_id
  AND c.user_id = g.user_id;

ALTER TABLE ai_conversations
    ALTER COLUMN session_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ai_conv_session
    ON ai_conversations(case_id, user_id, session_id, created_at ASC);

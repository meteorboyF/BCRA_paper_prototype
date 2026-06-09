--liquibase formatted sql

--changeset pangochain:024-ai-conversations
CREATE TABLE IF NOT EXISTS ai_conversations (
    id          BIGSERIAL PRIMARY KEY,
    case_id     UUID REFERENCES cases(id) ON DELETE CASCADE,
    user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
    role        VARCHAR(20) NOT NULL CHECK (role IN ('user','assistant','system')),
    content     TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ai_conv_case ON ai_conversations(case_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_conv_user ON ai_conversations(user_id);

--changeset pangochain:024-ai-case-insights
CREATE TABLE IF NOT EXISTS ai_case_insights (
    id              BIGSERIAL PRIMARY KEY,
    case_id         UUID REFERENCES cases(id) ON DELETE CASCADE,
    insight_type    VARCHAR(50) NOT NULL,
    content_json    JSONB NOT NULL,
    generated_by    UUID REFERENCES users(id),
    generated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours'
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_ai_insights_case_type ON ai_case_insights(case_id, insight_type);
CREATE INDEX IF NOT EXISTS idx_ai_insights_case ON ai_case_insights(case_id, insight_type);


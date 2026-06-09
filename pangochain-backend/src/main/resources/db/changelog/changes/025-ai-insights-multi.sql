--liquibase formatted sql

--changeset pangochain:025-ai-insights-multi
ALTER TABLE ai_case_insights DROP CONSTRAINT IF EXISTS ai_case_insights_case_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_ai_insights_case_type ON ai_case_insights(case_id, insight_type);

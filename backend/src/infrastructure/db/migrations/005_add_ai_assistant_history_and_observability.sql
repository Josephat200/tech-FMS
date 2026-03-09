CREATE TABLE IF NOT EXISTS tech_rica.assistant_interactions (
  interaction_id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES tech_rica.users(user_id) ON DELETE CASCADE,
  route TEXT,
  prompt TEXT NOT NULL,
  response TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('provider', 'rules')),
  model TEXT,
  latency_ms INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assistant_interactions_user_created
  ON tech_rica.assistant_interactions(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_assistant_interactions_source_created
  ON tech_rica.assistant_interactions(source, created_at DESC);

INSERT INTO tech_rica.system_settings(setting_key, setting_value)
VALUES (
  'ASSISTANT_POLICY',
  jsonb_build_object(
    'systemPrompt', 'You are FLORANTE RECH assistant. Help users with any question across finance, accounting, operations, technical topics, and general knowledge. Be accurate, concise, and explicit when uncertain. Never fabricate confidential data.',
    'temperature', 0.2,
    'maxTokens', 350
  )
)
ON CONFLICT (setting_key) DO NOTHING;

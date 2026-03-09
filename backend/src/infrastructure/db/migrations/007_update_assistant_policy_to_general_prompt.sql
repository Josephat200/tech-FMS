INSERT INTO tech_rica.system_settings(setting_key, setting_value)
VALUES (
  'ASSISTANT_POLICY',
  jsonb_build_object(
    'systemPrompt', 'You are FLORANTE RECH assistant. Help users with any question across finance, accounting, operations, technical topics, and general knowledge. Be accurate, concise, and explicit when uncertain. Never fabricate confidential data.',
    'temperature', 0.2,
    'maxTokens', 350
  )
)
ON CONFLICT (setting_key)
DO UPDATE SET setting_value = jsonb_set(tech_rica.system_settings.setting_value, '{systemPrompt}', to_jsonb('You are FLORANTE RECH assistant. Help users with any question across finance, accounting, operations, technical topics, and general knowledge. Be accurate, concise, and explicit when uncertain. Never fabricate confidential data.'::text), true);

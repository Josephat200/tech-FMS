import { httpClient } from './httpClient';

type ApiEnvelope<T> = {
  success: boolean;
  data: T;
};

export type AssistantHistoryItem = {
  interactionId: number;
  prompt: string;
  response: string;
  source: 'provider' | 'rules';
  route?: string;
  createdAt: string;
};

export type AssistantConfig = {
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  updatedAt?: string;
};

export type AssistantMetrics = {
  totalInteractions: number;
  providerInteractions: number;
  rulesInteractions: number;
  avgLatencyMs: number;
  last24Hours: number;
};

export type AssistantHealth = {
  mode: 'rules' | 'provider';
  configured: boolean;
  reachable: boolean;
  provider: string;
  model?: string;
  latencyMs?: number;
  message: string;
};

export const assistantApi = {
  ask: (payload: { prompt: string; route?: string }) =>
    httpClient.post<ApiEnvelope<{ answer: string; source: 'provider' | 'rules' }>, typeof payload>('/assistant/ask', payload),

  history: (limit = 25) =>
    httpClient.get<ApiEnvelope<AssistantHistoryItem[]>>(`/assistant/history?limit=${limit}`),

  getConfig: () => httpClient.get<ApiEnvelope<AssistantConfig>>('/assistant/config'),

  updateConfig: (payload: { systemPrompt: string; temperature: number; maxTokens: number }) =>
    httpClient.put<ApiEnvelope<AssistantConfig>, typeof payload>('/assistant/config', payload),

  getMetrics: (days = 30) =>
    httpClient.get<ApiEnvelope<AssistantMetrics>>(`/assistant/metrics?days=${days}`),

  getHealth: () => httpClient.get<ApiEnvelope<AssistantHealth>>('/assistant/health'),
};

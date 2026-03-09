import { env } from '../../../../config/env';
import { pgPool } from '../../../../infrastructure/db/postgres';
import { logger } from '../../../../infrastructure/logger/logger';

type AskAssistantInput = {
  userId: string;
  prompt: string;
  route?: string;
  userRoles: string[];
};

type AskAssistantResult = {
  answer: string;
  source: 'provider' | 'rules';
};

export type AssistantConfig = {
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  updatedAt?: string;
};

type AssistantHistoryItem = {
  interactionId: number;
  prompt: string;
  response: string;
  source: 'provider' | 'rules';
  route?: string;
  createdAt: string;
};

type AssistantMetrics = {
  totalInteractions: number;
  providerInteractions: number;
  rulesInteractions: number;
  avgLatencyMs: number;
  last24Hours: number;
};

const defaultConfig: AssistantConfig = {
  systemPrompt:
    'You are FLORANTE TECH assistant. Help users with any question across finance, accounting, operations, technical topics, and general knowledge. Be accurate, concise, and explicit when uncertain. Never fabricate confidential data.',
  temperature: 0.2,
  maxTokens: 350,
};

function buildRuleBasedReply(input: AskAssistantInput): string {
  const originalPrompt = input.prompt.trim();
  const text = originalPrompt.toLowerCase();
  const route = (input.route ?? '').toLowerCase();

  const topicFrom = (prefix: string): string | null => {
    const idx = text.indexOf(prefix);
    if (idx === -1) {
      return null;
    }

    const topic = originalPrompt.slice(idx + prefix.length).trim().replace(/[?.!]+$/, '');
    return topic.length > 0 ? topic : null;
  };

  if (text.includes('explain') || text.includes('what is') || text.includes('define')) {
    const topic = topicFrom('what is ') ?? topicFrom('define ') ?? topicFrom('explain ');
    if (topic) {
      return `${topic}: this is best understood as a concept with a clear purpose, core mechanics, and practical impact. Start with the definition, identify the main components, and test it on one real-world example. If you want, I can go deeper with a step-by-step breakdown for ${topic}.`;
    }

    return 'Here is a concise explanation structure: definition, how it works, why it matters, and one practical example. Share the exact topic and I will provide a specific explanation.';
  }

  if (text.includes('compare') || text.includes('difference between')) {
    return 'Use this comparison structure: purpose, key differences, pros/cons, when to use each, and a recommendation based on your context.';
  }

  if (text.startsWith('how do i ') || text.startsWith('how to ')) {
    const topic = topicFrom('how do i ') ?? topicFrom('how to ');
    return `To ${topic ?? 'do this'}, follow this sequence: 1) clarify the goal and constraints, 2) break the task into small steps, 3) execute one step at a time with checks, 4) validate the outcome, and 5) document the final result. Share your exact scenario and I can tailor each step.`;
  }

  if (text.startsWith('why ')) {
    return 'A strong way to answer "why" questions is to cover root cause, contributing factors, and impact. Share the exact topic and I will provide a direct causal explanation.';
  }

  if (text.includes('summarize') || text.includes('summary')) {
    return 'I can summarize it in three formats: one-line summary, executive bullet points, and detailed summary with action items. Paste the text or topic to summarize.';
  }

  if (text.includes('write') || text.includes('draft') || text.includes('email')) {
    return 'I can draft it. Share audience, objective, tone, and length; I will produce a polished version and a shorter alternative.';
  }

  if (text.includes('math') || text.includes('calculate') || /\d+\s*[+\-*/]/.test(text)) {
    return 'For calculations, provide the exact numbers and expected precision. I can solve it step by step and validate the result.';
  }

  if (text.includes('code') || text.includes('bug') || text.includes('debug')) {
    return 'For coding help, share the language, expected behavior, current error, and code snippet. I can provide a fix and explain why it works.';
  }

  if (text.includes('print')) {
    return 'Use the Print button on the current page. The print stylesheet removes sidebars/widgets for clean PDF or printer output.';
  }

  if (route.includes('reports') || text.includes('report') || text.includes('analysis')) {
    return 'For report analysis, compare revenue trend with operating cashflow and highlight periods where cashflow weakens while revenue grows.';
  }

  if (route.includes('ledger') || text.includes('ledger') || text.includes('journal')) {
    return 'For ledger review, reconcile debit/credit totals, then filter unusual postings by amount spikes, non-business-day entries, and late adjustments.';
  }

  if (route.includes('invoices') || text.includes('invoice') || text.includes('ar') || text.includes('ap')) {
    return 'For invoices, prioritize near-due receivables, review overdue buckets weekly, and track approval bottlenecks on payables.';
  }

  if (route.includes('payroll') || text.includes('payroll')) {
    return 'For payroll, verify gross-to-net movement, tax deductions, and approval status before release, then compare month-over-month totals for anomalies.';
  }

  if (route.includes('budgets') || text.includes('budget')) {
    return 'For budgets, monitor variance percentage by department and investigate categories exceeding the threshold for two consecutive periods.';
  }

  if (text.includes('password') || text.includes('login')) {
    if (input.userRoles.includes('ADMIN')) {
      return 'Admins can reset other users passwords in Settings > User Access Management using the Reset Password action.';
    }

    return 'If you cannot sign in, contact an administrator to reset your password.';
  }

  return 'I can help with both system tasks and general questions. Ask any topic directly and I will provide a concise answer, step-by-step guidance, or a draft depending on what you need.';
}

async function callProvider(
  input: AskAssistantInput,
  config: AssistantConfig,
  history: Array<{ prompt: string; response: string }>,
): Promise<string | null> {
  const apiKey = env.AI_ASSISTANT_API_KEY ?? env.OPENAI_API_KEY;
  const baseUrl = env.AI_ASSISTANT_BASE_URL;
  const model = env.AI_ASSISTANT_MODEL;

  if (!baseUrl || !model) {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Some OpenAI-compatible providers (for local/self-hosted usage) do not require auth headers.
    if (apiKey) {
      headers.Authorization = `Bearer ${apiKey}`;
    }

    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        temperature: config.temperature,
        max_tokens: config.maxTokens,
        messages: [
          {
            role: 'system',
            content: config.systemPrompt,
          },
          ...history.flatMap((item) => [
            { role: 'user', content: item.prompt },
            { role: 'assistant', content: item.response },
          ]),
          {
            role: 'user',
            content: `Route: ${input.route ?? 'n/a'}\nRoles: ${input.userRoles.join(', ') || 'n/a'}\nQuestion: ${input.prompt}`,
          },
        ],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      logger.warn({ status: response.status }, 'AI provider responded with non-OK status');
      return null;
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      output_text?: string;
    };

    const content = (payload.choices?.[0]?.message?.content ?? payload.output_text)?.trim();
    return content || null;
  } catch (error) {
    logger.warn({ err: error }, 'AI provider call failed, using fallback');
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export class AiAssistantService {
  async getHealth(): Promise<{
    mode: 'rules' | 'provider';
    configured: boolean;
    reachable: boolean;
    provider: string;
    model?: string;
    latencyMs?: number;
    message: string;
  }> {
    const mode = env.AI_ASSISTANT_MODE;
    const baseUrl = env.AI_ASSISTANT_BASE_URL;
    const model = env.AI_ASSISTANT_MODEL;
    const apiKey = env.AI_ASSISTANT_API_KEY ?? env.OPENAI_API_KEY;

    if (mode === 'rules') {
      return {
        mode,
        configured: true,
        reachable: true,
        provider: 'rules-fallback',
        message: 'Assistant is running in rules mode.',
      };
    }

    if (!baseUrl || !model) {
      return {
        mode,
        configured: false,
        reachable: false,
        provider: 'openai-compatible',
        model,
        message: 'Provider mode is enabled but base URL or model is missing.',
      };
    }

    const requiresApiKey = /api\.openai\.com/i.test(baseUrl);
    if (requiresApiKey && !apiKey) {
      return {
        mode,
        configured: false,
        reachable: false,
        provider: 'openai-compatible',
        model,
        message: 'Missing API key. Set AI_ASSISTANT_API_KEY or OPENAI_API_KEY for cloud provider access.',
      };
    }

    const startedAt = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const headers: Record<string, string> = {};
      if (apiKey) {
        headers.Authorization = `Bearer ${apiKey}`;
      }

      const response = await fetch(`${baseUrl.replace(/\/$/, '')}/models`, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });

      const latencyMs = Date.now() - startedAt;

      if (!response.ok) {
        return {
          mode,
          configured: true,
          reachable: false,
          provider: 'openai-compatible',
          model,
          latencyMs,
          message: `Provider returned status ${response.status}.`,
        };
      }

      return {
        mode,
        configured: true,
        reachable: true,
        provider: 'openai-compatible',
        model,
        latencyMs,
        message: 'Provider is reachable and ready.',
      };
    } catch (error) {
      logger.warn({ err: error }, 'Assistant health probe failed');
      return {
        mode,
        configured: true,
        reachable: false,
        provider: 'openai-compatible',
        model,
        latencyMs: Date.now() - startedAt,
        message: 'Provider is not reachable from backend runtime.',
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  private async getPolicyConfig(): Promise<AssistantConfig> {
    const result = await pgPool.query<{ setting_value: AssistantConfig; updated_at: Date }>(
      `
        SELECT setting_value, updated_at
        FROM tech_rica.system_settings
        WHERE setting_key = 'ASSISTANT_POLICY'
        LIMIT 1
      `,
    );

    if (!result.rowCount) {
      return defaultConfig;
    }

    const row = result.rows[0];
    return {
      systemPrompt: row.setting_value?.systemPrompt || defaultConfig.systemPrompt,
      temperature: Number(row.setting_value?.temperature ?? defaultConfig.temperature),
      maxTokens: Number(row.setting_value?.maxTokens ?? defaultConfig.maxTokens),
      updatedAt: row.updated_at.toISOString(),
    };
  }

  private async getRecentConversation(
    userId: string,
    limit = 6,
  ): Promise<Array<{ prompt: string; response: string }>> {
    const result = await pgPool.query<{ prompt: string; response: string }>(
      `
        SELECT prompt, response
        FROM tech_rica.assistant_interactions
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2
      `,
      [userId, limit],
    );

    return [...result.rows].reverse();
  }

  async getConfig(): Promise<AssistantConfig> {
    return this.getPolicyConfig();
  }

  async updateConfig(input: {
    systemPrompt: string;
    temperature: number;
    maxTokens: number;
    updatedByUserId: string;
  }): Promise<AssistantConfig> {
    const result = await pgPool.query<{ updated_at: Date }>(
      `
        INSERT INTO tech_rica.system_settings(setting_key, setting_value, updated_by, updated_at)
        VALUES (
          'ASSISTANT_POLICY',
          jsonb_build_object('systemPrompt', $1, 'temperature', $2, 'maxTokens', $3),
          $4,
          now()
        )
        ON CONFLICT (setting_key)
        DO UPDATE SET
          setting_value = EXCLUDED.setting_value,
          updated_by = EXCLUDED.updated_by,
          updated_at = now()
        RETURNING updated_at
      `,
      [input.systemPrompt, input.temperature, input.maxTokens, input.updatedByUserId],
    );

    return {
      systemPrompt: input.systemPrompt,
      temperature: input.temperature,
      maxTokens: input.maxTokens,
      updatedAt: result.rows[0].updated_at.toISOString(),
    };
  }

  private async recordInteraction(input: {
    userId: string;
    route?: string;
    prompt: string;
    response: string;
    source: 'provider' | 'rules';
    latencyMs: number;
  }): Promise<void> {
    await pgPool.query(
      `
        INSERT INTO tech_rica.assistant_interactions (
          user_id,
          route,
          prompt,
          response,
          source,
          model,
          latency_ms
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        input.userId,
        input.route ?? null,
        input.prompt,
        input.response,
        input.source,
        env.AI_ASSISTANT_MODEL ?? null,
        input.latencyMs,
      ],
    );
  }

  async getHistory(userId: string, limit = 25): Promise<AssistantHistoryItem[]> {
    const result = await pgPool.query<{
      interaction_id: number;
      prompt: string;
      response: string;
      source: 'provider' | 'rules';
      route: string | null;
      created_at: Date;
    }>(
      `
        SELECT interaction_id, prompt, response, source, route, created_at
        FROM tech_rica.assistant_interactions
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2
      `,
      [userId, limit],
    );

    return result.rows.map((row) => ({
      interactionId: row.interaction_id,
      prompt: row.prompt,
      response: row.response,
      source: row.source,
      route: row.route ?? undefined,
      createdAt: row.created_at.toISOString(),
    }));
  }

  async getMetrics(days = 30): Promise<AssistantMetrics> {
    const result = await pgPool.query<{
      total_interactions: string;
      provider_interactions: string;
      rules_interactions: string;
      avg_latency_ms: string;
      last_24_hours: string;
    }>(
      `
        SELECT
          COUNT(*)::text AS total_interactions,
          COUNT(*) FILTER (WHERE source = 'provider')::text AS provider_interactions,
          COUNT(*) FILTER (WHERE source = 'rules')::text AS rules_interactions,
          COALESCE(ROUND(AVG(latency_ms)), 0)::text AS avg_latency_ms,
          COUNT(*) FILTER (WHERE created_at >= now() - INTERVAL '24 hours')::text AS last_24_hours
        FROM tech_rica.assistant_interactions
        WHERE created_at >= now() - ($1::int || ' days')::interval
      `,
      [days],
    );

    const row = result.rows[0];
    return {
      totalInteractions: Number(row.total_interactions),
      providerInteractions: Number(row.provider_interactions),
      rulesInteractions: Number(row.rules_interactions),
      avgLatencyMs: Number(row.avg_latency_ms),
      last24Hours: Number(row.last_24_hours),
    };
  }

  async ask(input: AskAssistantInput): Promise<AskAssistantResult> {
    const mode = env.AI_ASSISTANT_MODE;
    const startedAt = Date.now();
    const config = await this.getPolicyConfig();
    const history = await this.getRecentConversation(input.userId, 6);
    let response: AskAssistantResult;

    if (mode === 'provider') {
      const providerReply = await callProvider(input, config, history);
      if (providerReply) {
        response = {
          answer: providerReply,
          source: 'provider',
        };

        await this.recordInteraction({
          userId: input.userId,
          route: input.route,
          prompt: input.prompt,
          response: response.answer,
          source: response.source,
          latencyMs: Date.now() - startedAt,
        });

        return response;
      }
    }

    response = {
      answer: buildRuleBasedReply(input),
      source: 'rules',
    };

    await this.recordInteraction({
      userId: input.userId,
      route: input.route,
      prompt: input.prompt,
      response: response.answer,
      source: response.source,
      latencyMs: Date.now() - startedAt,
    });

    return response;
  }
}

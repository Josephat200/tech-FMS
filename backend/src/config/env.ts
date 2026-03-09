import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const optionalNonEmptyString = () =>
  z.preprocess((value) => {
    if (typeof value !== 'string') {
      return value;
    }

    const trimmed = value.trim();
    return trimmed.length === 0 ? undefined : trimmed;
  }, z.string().min(1).optional());

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  API_PREFIX: z.string().default('/api/v1'),
  TRUST_PROXY: z.coerce.number().int().nonnegative().default(1),
  CORS_ALLOWED_ORIGINS: z.string().default('http://localhost:5173'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters long'),
  ACCESS_TOKEN_EXPIRES_IN: z.string().default('15m'),
  REFRESH_TOKEN_EXPIRES_DAYS: z.coerce.number().int().positive().default(7),
  DB_SSL_REJECT_UNAUTHORIZED: z.coerce.boolean().default(true),
  DB_SSL_CA: optionalNonEmptyString(),
  SMTP_HOST: optionalNonEmptyString(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_SECURE: z.coerce.boolean().default(false),
  SMTP_USER: optionalNonEmptyString(),
  SMTP_PASS: optionalNonEmptyString(),
  SMTP_FROM: z.preprocess((value) => {
    if (typeof value !== 'string') {
      return value;
    }
    const trimmed = value.trim();
    return trimmed.length === 0 ? undefined : trimmed;
  }, z.string().email().optional()),
  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().int().positive(),
  DB_NAME: z.string().min(1),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().min(1),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  SHUTDOWN_GRACE_PERIOD_MS: z.coerce.number().int().positive().default(10000),
  API_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60000),
  API_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
  AI_ASSISTANT_MODE: z.enum(['rules', 'provider']).default('provider'),
  AI_ASSISTANT_BASE_URL: z.preprocess((value) => {
    if (typeof value !== 'string') {
      return value;
    }
    const trimmed = value.trim();
    return trimmed.length === 0 ? undefined : trimmed;
  }, z.string().url().optional()),
  AI_ASSISTANT_API_KEY: optionalNonEmptyString(),
  OPENAI_API_KEY: optionalNonEmptyString(),
  AI_ASSISTANT_MODEL: optionalNonEmptyString(),
  MFA_ENABLED: z.coerce.boolean().default(true),
  MFA_CODE_EXPIRES_MINUTES: z.coerce.number().int().positive().default(10),
  MFA_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  MFA_DEV_BYPASS_CODE: z.preprocess((value) => {
    if (typeof value !== 'string') {
      return value;
    }
    const trimmed = value.trim();
    return trimmed.length === 0 ? undefined : trimmed;
  }, z.string().regex(/^\d{6}$/).optional()),
});

const parsedEnv = envSchema.parse(process.env);

if (
  parsedEnv.NODE_ENV === 'production' &&
  parsedEnv.JWT_SECRET.toLowerCase().includes('change_me')
) {
  throw new Error('JWT_SECRET must be changed from placeholder value in production');
}

if (parsedEnv.NODE_ENV === 'production' && parsedEnv.MFA_DEV_BYPASS_CODE) {
  throw new Error('MFA_DEV_BYPASS_CODE must be empty in production');
}

if (parsedEnv.NODE_ENV === 'production' && parsedEnv.AI_ASSISTANT_MODE === 'provider') {
  if (!parsedEnv.AI_ASSISTANT_BASE_URL || !parsedEnv.AI_ASSISTANT_MODEL) {
    throw new Error('AI provider mode requires AI_ASSISTANT_BASE_URL and AI_ASSISTANT_MODEL in production');
  }

  const needsApiKey = /api\.openai\.com/i.test(parsedEnv.AI_ASSISTANT_BASE_URL);
  const apiKey = parsedEnv.AI_ASSISTANT_API_KEY ?? parsedEnv.OPENAI_API_KEY;

  if (needsApiKey && !apiKey) {
    throw new Error('Cloud AI provider requires AI_ASSISTANT_API_KEY or OPENAI_API_KEY in production');
  }
}

export const env = parsedEnv;

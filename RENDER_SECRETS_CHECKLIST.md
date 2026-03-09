# Render Secret-by-Secret Checklist

Use this checklist in Render for the backend service (`backend`).

## 1) Required backend secrets (must be set)

- [ ] `NODE_ENV=production`
- [ ] `PORT=4000`
- [ ] `API_PREFIX=/api/v1`
- [ ] `TRUST_PROXY=1`
- [ ] `CORS_ALLOWED_ORIGINS=https://<your-frontend-render-domain>`
- [ ] `JWT_SECRET=<strong-random-secret-min-32-chars>`
- [ ] `ACCESS_TOKEN_EXPIRES_IN=15m`
- [ ] `REFRESH_TOKEN_EXPIRES_DAYS=7`
- [ ] `SHUTDOWN_GRACE_PERIOD_MS=10000`
- [ ] `DB_HOST=<render-postgres-host>`
- [ ] `DB_PORT=<render-postgres-port>`
- [ ] `DB_NAME=<render-postgres-db-name>`
- [ ] `DB_USER=<render-postgres-user>`
- [ ] `DB_PASSWORD=<render-postgres-password>`
- [ ] `LOG_LEVEL=info`
- [ ] `API_RATE_LIMIT_WINDOW_MS=60000`
- [ ] `API_RATE_LIMIT_MAX=300`
- [ ] `MFA_ENABLED=true`
- [ ] `MFA_CODE_EXPIRES_MINUTES=10`
- [ ] `MFA_MAX_ATTEMPTS=5`

## 2) Production safety toggles

- [ ] `MFA_DEV_BYPASS_CODE` is empty or unset in production.
- [ ] `DB_SSL_REJECT_UNAUTHORIZED=true`
- [ ] `DB_SSL_CA=<optional CA cert content>` (set only if required by your DB setup)

## 3) Assistant configuration (choose one mode)

### Option A: Stable fallback mode (recommended baseline)
- [ ] `AI_ASSISTANT_MODE=rules`
- [ ] `AI_ASSISTANT_BASE_URL` empty or unset
- [ ] `AI_ASSISTANT_MODEL` empty or unset
- [ ] `AI_ASSISTANT_API_KEY` empty or unset
- [ ] `OPENAI_API_KEY` empty or unset

### Option B: Cloud provider mode (OpenAI-compatible)
- [ ] `AI_ASSISTANT_MODE=provider`
- [ ] `AI_ASSISTANT_BASE_URL=https://api.openai.com/v1` (or your provider URL)
- [ ] `AI_ASSISTANT_MODEL=gpt-4o-mini` (or your approved model)
- [ ] `AI_ASSISTANT_API_KEY=<provider-key>` or `OPENAI_API_KEY=<openai-key>`

## 4) Email / notification settings (optional but recommended)

- [ ] `SMTP_HOST=<smtp-host>`
- [ ] `SMTP_PORT=<smtp-port>`
- [ ] `SMTP_SECURE=<true|false>`
- [ ] `SMTP_USER=<smtp-user>`
- [ ] `SMTP_PASS=<smtp-password>`
- [ ] `SMTP_FROM=<verified-from-email>`

## 5) One-time bootstrap values (optional, then remove)

Set only when running admin bootstrap, then remove from Render env:

- [ ] `BOOTSTRAP_ADMIN_EMAIL`
- [ ] `BOOTSTRAP_ADMIN_PASSWORD` (min 12 chars)
- [ ] `BOOTSTRAP_ADMIN_USERNAME`
- [ ] `BOOTSTRAP_ADMIN_FIRST_NAME`
- [ ] `BOOTSTRAP_ADMIN_LAST_NAME`

## 6) Frontend Render setting

For frontend service (`frontend`) set:

- [ ] `VITE_API_BASE_URL=/api/v1` (if frontend proxies same domain route)

Or, if frontend calls backend directly by URL:

- [ ] `VITE_API_BASE_URL=https://<your-backend-render-domain>/api/v1`

## 7) Final Render go-live checks

- [ ] Backend build command succeeds (`npm run predeploy`)
- [ ] Backend start command runs migrations and starts API
- [ ] `GET /api/v1/health` returns `status=up`
- [ ] `GET /api/v1/health/ready` returns `status=ready`
- [ ] Assistant health is reachable in chosen mode
- [ ] Frontend loads and can authenticate against backend

# TECH.RICA Pre-Deployment Productivity Guide

## 1) One-time setup

### Backend
- Copy `backend/.env.example` to `backend/.env` and fill all values.
- For production deployments, start from `backend/.env.production.example` and inject real secrets via your deploy platform.
- Install dependencies: `cd backend && npm install`
- Validate migrations state: `npm run migrate:status`

### Frontend
- Copy `frontend/.env.example` to `frontend/.env`
- Install dependencies: `cd frontend && npm install`

## 2) Local pre-deploy checks

### Backend quality gate
- `cd backend`
- `npm run predeploy`
- `npm run migrate:status`

### Frontend quality gate
- `cd frontend`
- `npm run build`

## 3) Run full stack in production mode with Docker

From repository root:

1. Set required environment variables in your shell (minimum: `JWT_SECRET`, optional overrides: `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `CORS_ALLOWED_ORIGINS`)
2. Start services:
  - `docker compose up --build -d`
3. Verify health:
  - Frontend: `http://localhost:8080`
  - Backend: `http://localhost:4000/api/v1/health`
  - Backend liveness: `http://localhost:4000/api/v1/health/live`
  - Backend readiness: `http://localhost:4000/api/v1/health/ready`
  - PostgreSQL: `localhost:5432`

The backend container applies DB migrations automatically on startup before serving traffic.

## 4) CI/CD workflows added

- `.github/workflows/ci.yml`
  - Builds/tests backend + frontend on PR and main push.
- `.github/workflows/deploy-render.yml`
  - Runs backend tests/build/migrations then triggers Render deploy hook.
- `.github/workflows/deploy-aws-ecs.yml`
  - Builds image, pushes to ECR, deploys ECS task definition.
- `.github/workflows/rds-backup.yml`
  - Scheduled/manual RDS snapshot automation.

## 5) Required GitHub secrets

### Common backend secrets
- `JWT_SECRET`
- `CORS_ALLOWED_ORIGINS`
- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`
- `DB_SSL_CA` (optional, but recommended)

### Assistant provider secrets/config (production)
- `AI_ASSISTANT_MODE=provider` (set this only after provider URL/model and key are configured)
- `AI_ASSISTANT_BASE_URL` (OpenAI-compatible endpoint)
- `AI_ASSISTANT_MODEL` (for example `gpt-4o-mini`)
- `AI_ASSISTANT_API_KEY` or `OPENAI_API_KEY` (required for cloud OpenAI endpoint)

If you need guaranteed availability without external dependencies, keep `AI_ASSISTANT_MODE=rules`.

### Render deploy
- `RENDER_DEPLOY_HOOK`

### AWS ECS deploy
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_REGION`
- `ECR_REPOSITORY`
- `ECS_CLUSTER`
- `ECS_SERVICE`

### RDS backup workflow
- `RDS_DB_INSTANCE_IDENTIFIER`

## 6) Migration automation

- Migration runner: `backend/src/scripts/migrate.ts`
- Run migrations: `npm run migrate`
- Check migration status: `npm run migrate:status`

Migrations are tracked in `tech_rica.schema_migrations`.

## 7) Production hardening already in code

- CORS allowlist (`CORS_ALLOWED_ORIGINS`)
- Proxy awareness (`TRUST_PROXY`)
- Auth endpoint rate limiting
- JWT auth + RBAC
- Refresh token rotation in DB
- Configurable DB SSL verification

## 8) Pre-go-live checklist

- [ ] All required secrets configured in deploy platform/GitHub
- [ ] Backend `npm run predeploy` passes
- [ ] Frontend `npm run build` passes
- [ ] `npm run migrate` executed against production DB
- [ ] Backup automation workflow verified
- [ ] Smoke test `/api/v1/health` and auth/report/accounting endpoints
- [ ] Validate `/api/v1/health/ready` returns `database.connected=true`
- [ ] Validate assistant provider health in Settings > Assistant Provider Status

## 9) Production container artifacts

- Backend image: `backend/Dockerfile`
- Frontend image: `frontend/Dockerfile`
- Frontend reverse proxy config: `frontend/nginx.conf`
- Full stack orchestration: `docker-compose.yml`

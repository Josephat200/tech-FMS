# TECH.RICA FMS Backend

Production-ready Node.js (Express + TypeScript) backend scaffold with clean architecture and MVC delivery layer.

## Run

1. Copy `.env.example` to `.env`
2. Install dependencies: `npm install`
3. Start in dev mode: `npm run dev`

## Productivity Scripts

- `npm run predeploy` - Runs tests then production build
- `npm run migrate` - Applies pending SQL migrations
- `npm run migrate:prod` - Applies pending migrations from compiled `dist` output
- `npm run migrate:status` - Shows applied/pending migrations
- `npm run migrate:status:prod` - Shows migration status from compiled `dist` output
- `npm run bootstrap:admin` - Creates/ensures an ADMIN account (idempotent)

### Bootstrap first admin (production-safe)

Set these environment variables and run the bootstrap script once:

- `BOOTSTRAP_ADMIN_EMAIL`
- `BOOTSTRAP_ADMIN_PASSWORD` (minimum 12 chars)
- `BOOTSTRAP_ADMIN_USERNAME` (optional, defaults to email prefix)
- `BOOTSTRAP_ADMIN_FIRST_NAME` (optional, default: `System`)
- `BOOTSTRAP_ADMIN_LAST_NAME` (optional, default: `Administrator`)

Example:

`BOOTSTRAP_ADMIN_EMAIL=admin@yourdomain.com BOOTSTRAP_ADMIN_PASSWORD='YourStrongPassword123!' npm run bootstrap:admin`

## API

- Health: `GET /api/v1/health`
- Auth register: `POST /api/v1/auth/register`
- Auth login: `POST /api/v1/auth/login`
- Auth refresh: `POST /api/v1/auth/refresh`
- Auth logout: `POST /api/v1/auth/logout`
- Auth me: `GET /api/v1/auth/me`
- Auth admin-only: `GET /api/v1/auth/admin-only`
- Accounting post journal: `POST /api/v1/accounting/journal-entries` (ADMIN/ACCOUNTANT)
- Reports trial balance: `GET /api/v1/reports/trial-balance?asOf=YYYY-MM-DD`
- Reports income statement: `GET /api/v1/reports/income-statement?from=YYYY-MM-DD&to=YYYY-MM-DD`
- Reports balance sheet: `GET /api/v1/reports/balance-sheet?asOf=YYYY-MM-DD`
- Reports cash flow: `GET /api/v1/reports/cash-flow?from=YYYY-MM-DD&to=YYYY-MM-DD`

## Security Notes

- Password hashing uses bcrypt with cost factor 12.
- Access tokens are short-lived JWTs.
- Refresh tokens are opaque random values stored as SHA-256 hashes in PostgreSQL.
- Refresh tokens are rotated on each refresh and sent as `httpOnly`, `sameSite=strict` cookies.
- Authentication endpoints are rate-limited (`/auth/register`, `/auth/login`, `/auth/refresh`).
- CORS uses an allowlist from `CORS_ALLOWED_ORIGINS` (comma-separated).
- Production DB SSL verification is configurable with `DB_SSL_REJECT_UNAUTHORIZED` and optional `DB_SSL_CA`.
- Graceful shutdown timeout is configurable with `SHUTDOWN_GRACE_PERIOD_MS`.

## Database Migration

Run SQL migration files under `src/infrastructure/db/migrations` (at least `001_create_refresh_tokens.sql`, `002_create_accounting_engine.sql`, and `003_add_reporting_indexes_and_cash_flag.sql`) before using auth refresh, accounting, and reporting endpoints.

# tipa.taska.uz — Project Guide for Claude

## What this project is

Full-stack CRM / Task Management SaaS ("Taska") for Uzbekistan market.

- **Backend:** FastAPI + SQLAlchemy 2 async + PostgreSQL 16 + Redis 7
- **Frontend:** React 19 + TypeScript + Vite 6 + Tailwind CSS
- **Bot:** Telegram bot auxiliary service
- **Infra:** Docker Compose, Alembic migrations, AWS S3, SMTP

## Repo structure

```
apps/
  api/        FastAPI backend (Python)
  web/        React frontend (TypeScript)
  bot/        Telegram bot
docs/         Architecture and entity documentation — read before making changes
ops/          Deployment configs
scripts/      Utility scripts
docker-compose.yml
```

## Always read first

Before modifying any feature, check `docs/` for relevant entity or API spec.
Key docs:

- `docs/ENTITIES.md` — data model for all domain entities
- `docs/API.md` — API contract, status codes, pagination format
- `docs/ARCHITECTURE.md` — system architecture, queue topology, NFR (**§3** слои, **§13** current vs target)
- `apps/api/CLAUDE.md` / `apps/web/CLAUDE.md` — соглашения стека (синхронизировать с кодом при смене структуры)

## Cross-app conventions

### IDs

All entity IDs are strings (UUID v4 or human-readable like `"funnel-123"`).
Never use integer primary keys.

### Dates/Times

- Store as ISO 8601 strings (not native Date objects in DB)
- Timezone: `Asia/Tashkent` (UTC+5) for calendar exports
- Frontend sends camelCase field names; backend maps to snake_case

### Soft delete

Entities are archived, never hard-deleted. Use `is_archived = True`.
Only exceptions: audit logs (INSERT-only), refresh tokens (revoked).

### Currency

Default `"UZS"`. Amount stored as string/Decimal in DB, float in API responses.

## Environment files

- `.env.example` — root template
- `apps/api/.env.example` — API-specific template
- Never commit `.env` or `.env.local`

## Running locally

```bash
docker-compose up -d          # PostgreSQL + Redis
cd apps/api && uvicorn app.main:app --reload
cd apps/web && npm run dev
```


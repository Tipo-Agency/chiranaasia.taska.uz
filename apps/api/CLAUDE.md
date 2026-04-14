# API — Claude Guide

## Stack

- Python 3.12, FastAPI 0.115, SQLAlchemy 2 async, Pydantic v2
- PostgreSQL 16 via asyncpg, Redis 7 via redis-py async
- Alembic for migrations, SlowAPI for rate limiting

## Project layout

```
app/
  api/routers/     HTTP only — тонкие обработчики (Depends, `response_model`), без тяжёлой предметной логики
  core/            auth, config, mappers, password policy, rate_limit, redis, seed_data
  db/              AsyncSession factory (get_db dependency)
  domain/          Чистые правила без FastAPI и AsyncSession в сигнатурах (`deals`, `finance_requests`, …)
  middleware/      http_security, idempotency (order matters — see main.py)
  models/          SQLAlchemy ORM models
  schemas/         Pydantic request/response schemas
  services/        Оркестрация, I/O, доменные события, cursor pagination, audit log
  services/integration_domains/  Изолированные контуры интеграций (1C, EDO, banking, telephony, …)
  main.py          App assembly: middleware stack, router registration, lifespan
```

Публичный API домена — `app/domain/__init__.py`. Большая часть сценариев по-прежнему в **`services/`**; новые инварианты по возможности выносятся в **`domain/`** (см. `docs/ARCHITECTURE.md`, `docs/MODULES.md`).

---

## Auth — critical rules

### JWT in HttpOnly cookie (NOT Authorization header)

```python
# core/auth.py — how the token is read:
# 1. HttpOnly cookie "access_token" — primary
# 2. Bearer header — only if AUTH_ALLOW_BEARER_HEADER=True in config (default False)
token = request.cookies.get(settings.ACCESS_TOKEN_COOKIE_NAME)
```

### Router-level protection (default for all routers)

```python
router = APIRouter(prefix="/foo", dependencies=[Depends(get_current_user)])
```

**Every router must have this** except `auth.py` (which has per-endpoint auth).

### Exceptions — public endpoints

When a router has mixed public/private endpoints, do NOT use router-level dependency.
Instead add `_user=Depends(get_current_user)` to each private endpoint individually.
Example: `tables.py` has `/public/content-plan/{id}` that must stay unauthenticated.

### Token version (`tv` claim)

JWT contains `tv` (token_version). On login/password change, `token_version` increments.
`get_current_user` validates `tv` against DB — this is how forced logout on all devices works.

### CSRF Double Submit Cookie

- `csrf_token` cookie (NOT HttpOnly) — frontend reads and sends as `X-CSRF-Token` header
- `CSRFMiddleware` validates with `hmac.compare_digest`
- Exemptions: `/api/auth/login`, `/api/auth/refresh`, `/api/auth/logout`, Telegram webhooks, site lead forms
- Config: `CSRF_PROTECTION_ENABLED` (default True)

---

## Pydantic schemas — anti-pattern rules

### BANNED: `list[dict]` as request body

```python
# ❌ NEVER do this:
async def update_statuses(statuses: list[dict], ...):

# ✅ Always use typed schema:
async def update_statuses(statuses: list[StatusOptionItem], ...):
```

All bulk PUT endpoints must use schemas from `app/schemas/`.

### Schema files (what's in each)


| File                     | Contains                                                                                                        |
| ------------------------ | --------------------------------------------------------------------------------------------------------------- |
| `settings.py`            | StatusOptionItem, PriorityOptionItem, ProjectItem, DepartmentItem, FolderItem, TableItem, AutomationRuleItem    |
| `content.py`             | DocItem, ContentPostItem, ActivityLogItem, ContentPostRead, DocRead, ActivityLogRead                            |
| `accounts_receivable.py` | AccountsReceivableItem, AccountsReceivableRead                                                                  |
| `finance_bulk.py`        | FinanceCategoryItem, FundItem, FinancialPlanDocItem, FinancialPlanningItem, BankStatementItem, IncomeReportItem |
| `weekly_plans.py`        | WeeklyPlanItem, ProtocolItem, WeeklyPlanRead, ProtocolRead                                                      |
| `shoot_plans.py`         | ShootPlanItem, ShootPlanRead                                                                                    |
| `inventory.py`           | WarehouseItem, InventoryItemSchema, StockMovementItem, InventoryRevisionItem                                    |
| `bpm_bulk.py`            | OrgPositionItem, BusinessProcessBulkItem, BpmStepBulkItem                                                       |
| `meetings.py`            | MeetingBulkItem, MeetingRead                                                                                    |
| `auth_users.py`          | UserBulkItem, AuthUserOut                                                                                       |
| `employees.py`           | EmployeeCreate, EmployeeUpdate, EmployeeBulkItem, EmployeeListResponse                                          |
| `funnels.py`             | FunnelBulkItem, FunnelStageItem, FunnelSourcesRoot                                                              |
| `clients.py`             | ClientCreate, ClientUpdate, ClientRead, ClientBulkItem, ClientListResponse                                      |
| `deals.py`               | DealCreate, DealUpdate, DealRead, DealBulkItem, DealListResponse                                                |
| `tasks.py`               | TaskCreate, TaskUpdate, TaskRead, TaskListResponse                                                              |
| `finance_requests.py`    | FinanceRequestCreate, FinanceRequestPatch, FinanceRequestRead, FinanceRequestListResponse                       |


### Schema config conventions

- `extra="ignore"` — legacy clients may send unknown fields (most bulk PUT)
- `extra="forbid"` — strict endpoints where unexpected fields mean client bug
- `extra="allow"` — JSONB blobs (AutomationRuleItem, FunnelStageItem)

---

## Cursor pagination

All list endpoints use **Fernet-encrypted keyset cursor** (NOT offset).

```python
# services/list_cursor_page.py
encode_list_cursor({"r": "resource", "sp": sort_parts, "op": order_parts, "fh": fingerprint, "vals": values})
decode_list_cursor(cursor_string)  # raises ListCursorError on tamper
assert_cursor_matches(payload, resource=..., sort_parts=..., order_parts=..., fingerprint=...)
build_seek_after(cols, dirs, vals)  # generates recursive OR predicate
```

Response format:

```json
{ "items": [...], "total": 1234, "limit": 50, "next_cursor": "encrypted..." }
```

`next_cursor` is null when no more pages.

---

## Domain events / audit

### Audit log (INSERT-only, immutable)

```python
from app.services.audit_log import log_mutation
await log_mutation(db, "create"|"update"|"delete", entity_type, entity_id,
                   actor_id=user.id, source="router-name",
                   request_id=request_id, payload={...})
```

### Domain events (Redis Streams → integrations)

```python
from app.services.domain_events import log_entity_mutation, emit_domain_event
await log_entity_mutation(db, event_type="client.created", entity_type="client",
                          entity_id=id, source="clients-router", payload={...})
```

---

## Middleware stack (order in main.py, outer→inner)

1. `RequestIDMiddleware` — injects `request_id` into ContextVar
2. `SlowAPIMiddleware` — rate limiting (2000/min default, 5/min for `/auth/login`)
3. `AuthCacheControlMiddleware` — `Cache-Control: no-store` for `/api/auth/*`
4. `SecurityHeadersMiddleware` — CSP, X-Frame-Options: DENY, HSTS optional
5. `CSRFMiddleware` — double-submit cookie validation
6. `IdempotencyMiddleware` — Redis-backed; scope **METHOD + path + Idempotency-Key**; SHA-256 тела; 409 при другом теле; replay с `Idempotent-Replayed: true`
7. `MaxRequestBodyMiddleware` — 5MB default, 10MB for webhooks
8. `CORSMiddleware` — explicit origins, no wildcard

---

## Idempotency

Клиент шлёт `Idempotency-Key` на **POST** под `/api/*` (см. `IdempotencyMiddleware`).

- Тот же ключ **на том же пути** + то же тело → replay кэшированного ответа (`Idempotent-Replayed: true`)
- Тот же ключ + другое тело → `409`
- Тот же ключ на **другом** пути — отдельная запись Redis (не пересекается с другим маршрутом)
- TTL: 24h (`IDEMPOTENCY_TTL_SECONDS = 86400`)

## Rate limit (slowapi)

Ключ: `rate_limit_key` в `core/rate_limit.py` — для `POST` login / refresh / logout / `integrations/site/leads` считается **по IP**; при валидном JWT на остальных маршрутах — **по `sub`**; иначе IP. При `429` slowapi отдаёт `Retry-After` и `X-RateLimit-*` (`headers_enabled=True`).

---

## Config (core/config.py)

### Blocked placeholder values for SECRET_KEY

`"change-me"`, `"changeme"`, `"secret"`, `"placeholder"`, `"your-secret-key"` — all rejected at startup.
SECRET_KEY must be ≥32 chars and not a known placeholder.

### Key boolean flags

```python
AUTH_ALLOW_BEARER_HEADER = False   # Never enable in prod
CSRF_PROTECTION_ENABLED = True
IDEMPOTENCY_ENABLED = True
COOKIE_SECURE = False              # Set True in prod (HTTPS)
```

---

## Redis Streams (queue names)


| Stream                    | Purpose                                        |
| ------------------------- | ---------------------------------------------- |
| `queue.domain.v1` (`REDIS_EVENTS_STREAM`) | Доменные события (XADD) + async hub (`notification_hub`) |
| `integrations.stream.v1`  | Incoming integration messages (Telegram, Meta) |
| `notifications.stream.v1` | Notification delivery                          |


All stream names end in `.v1` — version suffix is intentional for schema evolution.
Dead-letter queue: `DeadLetterQueue` model in DB for failed async jobs.

---

## Models

All models in `app/models/`. Key files:

- `user.py` — User, with `token_version` for forced logout
- `role.py` — Role with `permissions: list[str]` (JSONB)
- `client.py` — Client, EmployeeInfo, AccountsReceivable
- `task.py` — Task, Project, TaskComment
- `finance.py` — FinanceCategory, Fund, FinancePlan, FinancialPlanDocument, FinancialPlanning, Department
- `funnel.py` — SalesFunnel (stages + sources as JSONB)
- `notification.py` — Notification, AutomationRule
- `settings.py` — StatusOption, PriorityOption, ActivityLog, TableCollection
- `system_log.py` — AuditLog (INSERT-only), DeadLetterQueue

### AuditLog is INSERT-only

Never UPDATE or DELETE rows in `audit_logs`. It's an append-only audit trail.

---

## Alembic migrations

```bash
cd apps/api
alembic revision --autogenerate -m "description"
alembic upgrade head
```

Migrations run automatically on startup (lifespan).

---

## Common mistakes to avoid

1. **Don't** use `list[dict]` as request body type — always create a Pydantic schema
2. **Don't** use `sessionStorage` for tokens — JWT is in HttpOnly cookie
3. **Don't** read `Authorization: Bearer` header unless `AUTH_ALLOW_BEARER_HEADER=True`
4. **Don't** hard-delete entities — set `is_archived = True`
5. **Don't** create new routers without `dependencies=[Depends(get_current_user)]`
6. **Don't** UPDATE or DELETE `AuditLog` rows
7. **Don't** bypass CSRF with `verify=False` patterns
8. **Don't** use `select `* — always specify columns or use ORM models
9. **Don't** write business logic in routers — put it in `services/`
10. **Don't** use synchronous SQLAlchemy operations — everything is `async/await`


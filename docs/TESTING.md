# Тестирование

---

## 1. Стратегия

```
          /\
         /E2E\          Playwright: критичные user flows (5-10 сценариев)
        /------\
       /Интеграц\       pytest + реальная БД: API endpoints
      /----------\
     /  Юниты     \     pytest (domain/services) + Vitest (frontend utils)
    /--------------\
```

**Принципы:**
- Тесты интеграционного слоя **используют реальную БД** (PostgreSQL в Docker), не mock
- Domain-слой тестируется **без HTTP и без БД** — чистые юниты
- Тесты должны работать в CI за < 2 мин

---

## 2. Структура тестов (Backend) — факт

Сейчас в репозитории **smoke-тесты** против **уже запущенного** API (по умолчанию `http://localhost:8000`; порт Docker Compose для backend на хосте часто **8003** — задайте `TEST_API_URL`).

```
apps/api/tests/
├── conftest.py       # httpx.Client, BASE_URL из TEST_API_URL
├── test_health.py    # GET /health
├── test_auth.py      # логин, refresh_token в ответе
└── test_tasks.py     # задачи + пример запроса с Bearer к /admin/logs
```

Целевая структура (`unit/`, `integration/` с ASGI, изолированная БД) описана ниже как **[TARGET]** — к ней можно мигрировать постепенно.

---

## 3. Текущий conftest (smoke)

```python
# apps/api/tests/conftest.py
import os
import pytest
import httpx

BASE_URL = os.environ.get("TEST_API_URL", "http://localhost:8000")

@pytest.fixture
def api_client():
    with httpx.Client(base_url=BASE_URL, timeout=10.0) as client:
        yield client
```

**Запуск:** поднять `docker compose up -d` (или `backend` локально), применить миграции, затем:

```bash
export TEST_API_URL=http://localhost:8003   # если API на 8003
pytest apps/api/tests/ -v
```

**CSRF / Origin:** браузерный фронт шлёт `Origin` и заголовок `X-CSRF-Token`. Клиент **httpx** в smoke-тестах обычно **не** шлёт `Origin`; мутации **с** заголовком `Authorization: Bearer …` проходят проверку middleware (небраузерный клиент). См. [SECURITY.md](./SECURITY.md).

---

## 3.1 [TARGET] Конфигурация pytest + ASGI (интеграция в процессе)

Пример для будущих тестов **без** поднятого сервера: `httpx.AsyncClient` + `ASGITransport(app=app)`, отдельная БД `tipa_test`, фикстуры `db` / `auth_client`. Реальные импорты: `from app.db import Base`, `from app.core.auth import get_password_hash`, модели из `app.models`, создание пользователя с `role_id`.

```python
# Черновик целевого conftest — не копировать слепо, сверить с кодом
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from app.main import app

@pytest_asyncio.fixture
async def client():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
```

---

## 4. Примеры тестов (Backend)

### Unit: Domain

```python
# tests/unit/test_task_domain.py
from app.domain.task import TaskStatus, can_transition

def test_todo_to_in_progress():
    assert can_transition(TaskStatus.todo, TaskStatus.in_progress) is True

def test_done_to_todo_forbidden():
    assert can_transition(TaskStatus.done, TaskStatus.todo) is False

def test_cancelled_is_terminal():
    for target in TaskStatus:
        if target != TaskStatus.cancelled:
            assert can_transition(TaskStatus.cancelled, target) is False
```

```python
# tests/unit/test_deal_domain.py
from app.domain.deal import DealStage, validate_stage_transition

def test_new_to_negotiation():
    validate_stage_transition(DealStage.new, DealStage.negotiation)  # не raises

def test_won_to_new_raises():
    with pytest.raises(ValueError, match="Cannot transition from won"):
        validate_stage_transition(DealStage.won, DealStage.new)
```

### Integration: API

```python
# tests/integration/test_tasks.py
import pytest

@pytest.mark.asyncio
async def test_create_task(auth_client, test_user):
    table = await create_test_table(auth_client)
    
    resp = await auth_client.post("/api/tasks", json={
        "title": "Test task",
        "table_id": str(table["id"]),
        "status": "todo",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "Test task"
    assert data["status"] == "todo"
    assert "id" in data

@pytest.mark.asyncio
async def test_update_task_invalid_status(auth_client, test_task):
    resp = await auth_client.patch(f"/api/tasks/{test_task['id']}", json={
        "status": "unknown_status"
    })
    assert resp.status_code == 422

@pytest.mark.asyncio
async def test_list_tasks_pagination(auth_client, test_table):
    # Создать 60 задач
    for i in range(60):
        await auth_client.post("/api/tasks", json={
            "title": f"Task {i}",
            "table_id": test_table["id"],
        })
    
    resp = await auth_client.get(f"/api/tasks?table_id={test_table['id']}&limit=50&offset=0")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["items"]) == 50
    assert data["total"] == 60
    assert data["limit"] == 50

@pytest.mark.asyncio
async def test_task_requires_permission(client):
    """Без авторизации — 401."""
    resp = await client.post("/api/tasks", json={"title": "x", "table_id": "uuid"})
    assert resp.status_code == 401

@pytest.mark.asyncio  
async def test_delete_without_permission(db, client):
    """С правами только на view — нельзя удалить."""
    readonly_user = await create_user(db, permissions=["tasks.view"])
    auth = await login(client, readonly_user)
    
    task = await create_test_task(db)
    resp = await auth.delete(f"/api/tasks/{task.id}")
    assert resp.status_code == 403
```

### Integration: Auth (актуальный контракт API)

Логин — **`POST /api/auth/login`** с телом `{"login": "...", "password": "..."}` (не `email`). В ответе JSON:

- `access_token`, `refresh_token`, `token_type`, `user`.

Set-Cookie с **`csrf_token`** (не HttpOnly) выставляется бэкендом; access/refresh в продакшен-цели должны переехать в HttpOnly — пока в SPA они ещё в `sessionStorage`.

```python
def test_login_returns_tokens(api_client):
    r = api_client.post("/api/auth/login", json={"login": "demo", "password": ""})
    assert r.status_code == 200
    data = r.json()
    assert "access_token" in data and "refresh_token" in data
    assert data.get("token_type") == "bearer"
```

**Refresh:** `POST /api/auth/refresh` с `{"refresh_token": "<opaque>"}` → новая пара токенов + новый csrf cookie.

**Logout:** `POST /api/auth/logout` с `{"refresh_token": "..."}`.

**Rate limit** на логин: slowapi (например 30/min с IP) + Redis lockout после серии неудач — в smoke-тестах учитывайте окружение.

**CSRF в браузере:** мутирующие запросы с фронта идут с `Origin` из `CORS_ORIGINS` и заголовком `X-CSRF-Token`, совпадающим с cookie. Тесты через httpx без Origin, но с Bearer — см. §3.

---

## 5. Структура тестов (Frontend)

```
apps/web/
├── vitest.config.ts
└── src/__tests__/
    ├── stores/
    │   ├── tasksStore.test.ts
    │   └── authStore.test.ts
    ├── utils/
    │   ├── permissions.test.ts
    │   ├── sanitize.test.ts        # КРИТИЧНО: DOMPurify работает?
    │   └── format.test.ts
    └── components/
        ├── TaskCard.test.tsx
        └── FunnelCard.test.tsx
```

### Конфигурация Vitest

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.ts'],
    coverage: {
      reporter: ['text', 'lcov'],
      thresholds: {
        lines: 50,
        functions: 50,
      },
    },
  },
});
```

### Примеры тестов (Frontend)

```typescript
// src/__tests__/utils/sanitize.test.ts
import { sanitizeHtml } from '@/utils/sanitize';

describe('sanitizeHtml', () => {
  it('removes script tags', () => {
    const input = '<p>Hello</p><script>alert("xss")</script>';
    expect(sanitizeHtml(input)).not.toContain('<script>');
  });

  it('removes onerror attributes', () => {
    const input = '<img onerror="alert(1)" src="x">';
    expect(sanitizeHtml(input)).not.toContain('onerror');
  });

  it('keeps allowed formatting', () => {
    const input = '<b>Bold</b> and <i>italic</i>';
    expect(sanitizeHtml(input)).toBe('<b>Bold</b> and <i>italic</i>');
  });

  it('removes javascript: hrefs', () => {
    const input = '<a href="javascript:alert(1)">click</a>';
    expect(sanitizeHtml(input)).not.toContain('javascript:');
  });
});
```

```typescript
// src/__tests__/utils/permissions.test.ts
import { hasPermission } from '@/utils/permissions';

const adminUser = { role: 'admin', permissions: [] };
const managerUser = { role: 'manager', permissions: ['crm.deals.edit', 'tasks.view'] };

describe('hasPermission', () => {
  it('admin has all permissions', () => {
    expect(hasPermission(adminUser, 'finance.approve')).toBe(true);
  });

  it('manager with explicit permission', () => {
    expect(hasPermission(managerUser, 'crm.deals.edit')).toBe(true);
  });

  it('manager without permission', () => {
    expect(hasPermission(managerUser, 'finance.approve')).toBe(false);
  });
});
```

---

## 6. E2E (Playwright)

```
apps/web/e2e/
├── playwright.config.ts
├── auth.spec.ts               # логин, логаут
├── tasks.spec.ts              # создание и изменение задачи
├── crm.spec.ts                # воронка, смена стадии
└── helpers/
    └── fixtures.ts            # фикстуры: авторизованная страница
```

```typescript
// e2e/tasks.spec.ts
import { test, expect } from '@playwright/test';

test('create task and change status', async ({ page }) => {
  await page.goto('/');
  // Логин
  await page.fill('[name=email]', 'test@example.com');
  await page.fill('[name=password]', 'testpassword123');
  await page.click('button[type=submit]');
  
  // Перейти в задачи
  await page.click('text=Задачи');
  
  // Создать задачу
  await page.click('button:has-text("Создать")');
  await page.fill('[placeholder*="Название"]', 'E2E Test Task');
  await page.click('button:has-text("Сохранить")');
  
  // Проверить что появилась
  await expect(page.locator('text=E2E Test Task')).toBeVisible();
  
  // Сменить статус
  await page.locator('text=E2E Test Task').click();
  await page.locator('text=В работе').click();
  await expect(page.locator('[data-status="in_progress"]')).toBeVisible();
});
```

---

## 7. Покрытие (цели)

| Слой | Текущее | Цель | Инструмент |
|------|---------|------|-----------|
| Domain (бизнес-правила) | ~0% | 90%+ | pytest |
| Services (use cases) | ~20% | 70%+ | pytest |
| Routers (API) | smoke (`test_auth`, `test_tasks`, `test_health`) | 60%+ | pytest + httpx / ASGI |
| Frontend utils | ~0% | 70%+ | Vitest |
| Frontend components | ~0% | 40%+ | Vitest + RTL |
| E2E критичные flows | ~0% | 5 сценариев | Playwright |

---

## 8. CI pipeline

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  backend-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_DB: tipa_test
          POSTGRES_PASSWORD: test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
      redis:
        image: redis:7
        options: --health-cmd "redis-cli ping"
    
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: '3.11' }
      
      - name: Install deps
        run: pip install -r apps/api/requirements.txt pytest httpx

      # Smoke-тесты бьют в HTTP: нужен запущенный backend + миграции.
      # Варианты: docker compose up + sleep + pytest с TEST_API_URL=http://localhost:8003
      # либо отказ от smoke в CI до появления ASGI-фикстур (§3.1).
      - name: Run smoke tests
        env:
          TEST_API_URL: http://localhost:8003
        run: pytest apps/api/tests/ -v
      
      - name: Coverage check
        run: |
          coverage report --fail-under=50

  frontend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npm run test -- --coverage
      - run: npm run typecheck
      - run: npm run lint
```

---

## 9. Запуск локально

```bash
# Backend smoke (нужен запущенный API, см. docker compose / uvicorn)
export TEST_API_URL=http://localhost:8003   # или 8000
cd apps/api
pip install -r requirements.txt pytest httpx
pytest tests/ -v

# После появления unit/integration по §3.1:
# pytest tests/unit/ -v
# pytest tests/integration/ -v
# pytest tests/ --cov=app --cov-report=html

# Frontend тесты
npm run test                            # watch mode
npm run test -- --run                   # один прогон
npm run test -- --coverage              # с покрытием

# E2E
npm run test:e2e                        # Playwright
```

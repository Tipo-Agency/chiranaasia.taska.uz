# Безопасность

Документ фиксирует **политику**, **что уже сделано в репозитории**, **что на стороне эксплуатации** и **что сознательно не автоматизировано** (с краткой аргументацией).

Пункты **P0** по-прежнему блокируют выход в прод без осознанного решения.

---

## Сводка: статус рекомендаций

| Тема | Статус |
|------|--------|
| **CSP** (без inline scripts, self + Meta/Telegram) | Заголовок в **FastAPI** (`SECURITY_CSP` или дефолт) и в **nginx** (HTTPS server). Для JSON-ответов API CSP почти не влияет на XSS; критичен для HTML/SPA — задаётся nginx. |
| **HSTS** `max-age=31536000; includeSubDomains; preload` | В **nginx** (только HTTPS server). В API — `SECURITY_ENABLE_HSTS=1` при прямом TLS к uvicorn. **Не** добавлять HSTS на чистый HTTP. |
| **X-Frame-Options, X-Content-Type-Options, Referrer-Policy** | FastAPI middleware + nginx. |
| **JWT access короткий + refresh rotating** | **Сделано:** `ACCESS_TOKEN_EXPIRE_MINUTES` (дефолт 60), refresh в таблице `refresh_tokens`, rotation при `POST /auth/refresh`, отзыв при `POST /auth/logout`. |
| **Logout / инвалидация refresh** | Отзыв строки refresh в БД; при смене пароля — `token_version++` + удаление всех refresh пользователя. |
| **CSRF: случайный токен на login** | **Сделано:** cookie `csrf_token` (не HttpOnly) пересоздаётся на login и refresh. |
| **CSRF: Origin/Referer** | **Сделано:** для мутирующих `/api/*` проверка allowlist из `CORS_ORIGINS`; исключения: login, refresh, webhooks, `integrations/site`, WS, `.ics` календаря. |
| **Клиенты без Origin + Bearer** (бот, curl, скрипты) | Не требуют CSRF-cookie (не браузерная сессия SPA). |
| **Cookies HttpOnly для access/refresh** | **Сделано:** логин/refresh выставляют HttpOnly cookies; SPA ходит с `credentials: 'include'` (`apps/web/services/apiClient.ts`). |
| **Cookie domain** | `COOKIE_DOMAIN` в настройках API (для csrf cookie). |
| **Password policy** | При **установке** пароля через API: ≥8 символов, ≤128, минимум одна цифра и одна буква. Старые слабые пароли не ломаются до смены. |
| **bcrypt cost ≥ 12** | `BCRYPT_ROUNDS` (дефолт 12). |
| **Brute-force логина** | После **N** неудач — блок на **M** секунд (Redis: `LOGIN_MAX_ATTEMPTS`, `LOGIN_LOCKOUT_SECONDS`). Без Redis блокировка отключается (логируется предупреждение). |
| **Смена пароля → все refresh недействительны** | `token_version` + `DELETE` refresh для пользователя. |
| **Лимит размера body** | Middleware: `MAX_REQUEST_BODY_BYTES`, для `/webhook/*` — `WEBHOOK_MAX_BODY_BYTES`. |
| **Invalid JSON → не 500** | Явный разбор ошибок валидации — `422` с `request_id`. Полностью битое тело без схемы может по-прежнему давать 422/400 на уровне Starlette — не считается утечкой. |
| **Ошибки в проде без stack trace** | Ответ 500: `detail` + `request_id`; стек только в логах. |
| **PII / секреты в логах** | **Частично:** в `apps/api/app/core/observability.py` structlog перед JSON-рендером рекурсивно маскирует значения по имени ключа (фрагменты вроде `password`, `token`, `authorization`, `secret`, `cookie`, `api_key`). Полный аудит всех логгеров и полей — **[TARGET]**. |
| **AuditLog без паролей/токенов** | **Политика:** не класть секреты в `payload`/`old_values`/`new_values`; при расширении аудита фильтровать поля. |
| **Rate limiting** | **slowapi:** см. [API.md §6](./API.md); для авторизованных запросов ключ — **`user_id` из JWT** (`rate_limit_key` в `apps/api/app/core/rate_limit.py`), для login/refresh/site leads — по IP. |
| **Загрузка файлов** (размер, mime, uuid, path traversal, sniffing) | В API нет универсального upload-роутера — правила зафиксированы для будущих эндпоинтов. |
| **Ротация ENCRYPTION_KEY** | **Документ / [TARGET]:** dual-key период; в коде Fernet одноключевой. |
| **Секреты только в env** | Политика; в API CI — узкий скан `ops/scripts/check_api_secrets.sh` (PEM private key, шаблон AWS AKIA в `apps/api/app`). Полноценный secret scanning — **[TARGET]** / внешние инструменты. |
| **Разделение секретов по сервисам** | Оркестрация/K8s secrets — вне этого репозитория. |
| **Webhooks: replay, rate limit, размер** | Размер — лимит body. **Meta POST `/webhook/meta`:** после валидации JSON — дедуп по **SHA256(raw body)** с Redis `SET NX` TTL **600 с** (`taska:webhook:meta:dedup:<hex>`); повтор того же тела — **200** без повторного `XADD`. Иные провайдеры / nonce+timestamp — **[TARGET]** по контракту. Rate limit на `/webhook/*` — частично глобальный slowapi. |
| **SQL: только ORM/параметры** | Политика; не вводить raw с интерполяцией. |
| **DB least privilege + бэкапы** | Эксплуатация (роль БД, pg_dump, тест восстановления). |
| **Cache-Control на auth** | `no-store` для `/api/auth/login`, `/refresh`, `/me`. |
| **Frontend XSS / dangerouslySetInnerHTML** | **Сделано для редактора документов:** `sanitizeDocHtml` / `setDocEditorHtml` (DOMPurify), см. §1. |
| **Meta CSP в index.html для dev** | **Не добавляем:** Vite HMR требует ослабленной политики; в dev полагаемся на отсутствие nginx CSP или отдельный профиль. |
| **npm audit / lockfile / supply chain** | **Частично:** в [`.github/workflows/ci-web.yml`](../.github/workflows/ci-web.yml) шаг `npm audit --audit-level=high` с `continue-on-error: true` (видимость без блокировки merge при обнаружении moderate и ниже у транзитивов). Локально — `npm audit` / `npm audit fix`. |
| **Мониторинг security events + алерты** | **[TARGET]** (SIEM / метрики по логам). |
| **DoS: workers / concurrent** | Настройка uvicorn/gunicorn — эксплуатация. |
| **Timeouts внешних HTTP** | Вызовы через httpx с timeout где используется; единая политика — **[TARGET]** для всех интеграций. |
| **Circuit breaker** | **[TARGET]** для внешних сервисов. |
| **Zero trust: проверки на backend** | Политика: фронт не является границей доверия. |
| **Публичный `GET /health`** | Намеренно без auth для пробы балансировщика/деплоя. В ответе только `status` (`ok` / `unavailable` при 503); **не** отдаём версию приложения, детали ошибок БД и стек — они доступны только в `GET /api/admin/health` под RBAC. |

---

## Конфигурация API (переменные окружения)

| Переменная | Назначение |
|------------|------------|
| `ENVIRONMENT` | `production` — рекомендуется для прода (влияет на ожидания в доке). |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Жизнь access JWT (минуты). |
| `REFRESH_TOKEN_EXPIRE_DAYS` | Жизнь refresh (дни). |
| `BCRYPT_ROUNDS` | Раунды bcrypt (≥12). |
| `CORS_ORIGINS` | Список через запятую; используется и для CORS, и для проверки Origin мутирующих запросов. |
| `CSRF_PROTECTION_ENABLED` | `0` отключает CSRF middleware (только отладка). |
| `SECURITY_CSP` | Непустая строка заменяет дефолтный CSP в ответах API. |
| `SECURITY_ENABLE_HSTS` | `1` — заголовок HSTS на API (если клиент ходит напрямую по HTTPS). |
| `MAX_REQUEST_BODY_BYTES` | Лимит тела запроса (байты). |
| `WEBHOOK_MAX_BODY_BYTES` | Лимит для `/webhook/*`. |
| `COOKIE_SECURE`, `COOKIE_SAMESITE`, `COOKIE_DOMAIN`, `CSRF_COOKIE_NAME` | Параметры Set-Cookie для CSRF. |
| `LOGIN_MAX_ATTEMPTS`, `LOGIN_LOCKOUT_SECONDS` | Блокировка логина через Redis. |

Эндпоинты: `POST /api/auth/login`, `POST /api/auth/refresh`, `POST /api/auth/logout`, `GET /api/auth/csrf` (bootstrap cookie при существующем access).

---

## 1. XSS (Cross-Site Scripting)

### Редактор документов (as-built)

Любая запись HTML в DOM идёт через **`apps/web/utils/sanitizeDocHtml.ts`** (DOMPurify: `setDocEditorHtml`, `sanitizeDocHtml`, `takeDocEditorHtml`). Вставка из буфера — `handleEditorPaste` в `DocEditor.tsx` с санитизацией.

### Остальное SPA

Новые места с `innerHTML` / `dangerouslySetInnerHTML` — только с явной санитизацией или статическим контентом; для пользовательского HTML — тот же подход, что в `sanitizeDocHtml`.

### ESLint (рекомендация)

Имеет смысл включить правила против прямого присваивания `innerHTML` (см. исторический пример в git-истории этого файла).

---

## 2. JWT и сессии (текущая реализация)

- Access JWT содержит `sub`, `exp`, `tv` (`token_version`). Несовпадение `tv` → 401.
- Refresh — opaque строка в БД (только SHA-256), ротация при обмене.
- **Браузерный клиент:** access/refresh в **HttpOnly** cookies; CSRF — отдельная cookie + заголовок на мутациях; `credentials: 'include'` в `apiClient.ts`.

---

## 3. CSRF (double-submit + Origin)

Реализовано в `app/middleware/http_security.py`: для небезопасных методов под `/api/*` проверяются allowlist Origin/Referer и совпадение `X-CSRF-Token` с cookie (если защита включена).

---

## 4. CORS

В `main.py`: явные `allow_methods`, `allow_headers`, список origins из `CORS_ORIGINS` (без `*` вместе с credentials).

---

## 5. Rate limiting

Используется **slowapi**: общий лимит на IP и отдельный на `POST /auth/login`.

---

## 6. Входная валидация (Pydantic)

См. запрещённые паттерны и правильные схемы в исторических разделах ниже — без изменений по смыслу.

---

## 7. Секреты и конфигурация

`SECRET_KEY`, `DATABASE_URL`, `REDIS_URL` — обязательны в `app.core.config` (без дефолтов в коде); `SECRET_KEY` ≥ 32 символов и не должен содержать шаблонных подстрок (`change-me` и т.п.). `ENCRYPTION_KEY` — при использовании Fernet в интеграциях.

---

## 8. Аудит-лог

Не записывать в `old_values` / `new_values` / `payload`: пароли, refresh/access токены, сырой `Authorization`, API keys в открытом виде.

---

## 9. Безопасность интеграций

Верификация подписи Meta webhook, constant-time сравнение API keys — по существующим разделам проекта; при изменении роутов сохранять исключения в CSRF middleware.

---

## 10. Чеклист перед деплоем

```
КРИТИЧНО:
[x] DOMPurify для редактора документов (`sanitizeDocHtml` / `DocEditor`)
[ ] SECRET_KEY надёжный; для шифрования интеграций — ENCRYPTION_KEY
[ ] CORS_ORIGINS = конкретные origin'ы продакшена
[ ] COOKIE_SECURE=1 и HTTPS (nginx)
[ ] SECURITY_ENABLE_HSTS=1 на TLS-терминации (nginx уже задаёт HSTS)
[ ] Redis для блокировки логина (или осознанно принять отключение)
[ ] Миграции БД применены (в т.ч. refresh_tokens, token_version)

ВАЖНО:
[ ] Meta webhook: подпись X-Hub-Signature-256
[ ] Аудит мутаций без секретов в payload
[ ] Пароли новых пользователей — по политике сложности

ДАЛЬШЕ:
[x] HttpOnly cookies для JWT (браузерный SPA-клиент)
[ ] Per-user rate limits / burst
[ ] Маскирование PII в логах, security-алерты
[ ] Webhook replay protection по контракту провайдера
```

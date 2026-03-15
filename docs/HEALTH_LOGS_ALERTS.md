# Health, логи и алерты (Типа задачи)

## Health-эндпоинт

**GET /health** (без префикса `/api`) — проверка живости backend'а и подключения к БД.

Ответ при нормальной работе:

```json
{
  "status": "ok",
  "version": "1.0.0",
  "db": "ok"
}
```

При недоступности Postgres поле `db` будет `"error"`, в ответ добавится `db_error` с текстом ошибки.

Использование:

- Мониторинг (UptimeRobot, Healthchecks.io, свой cron).
- Проверка после деплоя (CI/CD).
- Фронт может опционально показывать индикатор состояния API.

---

## Системные логи (system_logs)

Все сообщения уровня **ERROR**, **CRITICAL** и **WARNING** от корневого логгера Python записываются в таблицу БД **system_logs**.

Поля:

| Поле         | Описание                          |
|-------------|-----------------------------------|
| id          | Идентификатор                     |
| created_at  | Время события (UTC)               |
| level       | ERROR / CRITICAL / WARNING        |
| message     | Текст сообщения                   |
| logger_name | Имя логгера                       |
| path        | Путь запроса или модуль (если есть) |
| request_id  | Идентификатор запроса (если есть)  |
| payload     | Доп. данные (например, traceback) |

Необработанные исключения в FastAPI перехватываются глобальным exception handler'ом и логируются как CRITICAL.

### Просмотр логов

- **В приложении:** Настройки → вкладка **«Система / Логи»** — таблица последних записей, фильтр по уровню, кнопка «Обновить».
- **По API:** `GET /api/system/logs?limit=50&level=ERROR` — JSON-список записей.

---

## Telegram-алерты

При записи в лог уровня **CRITICAL** отправляется короткое сообщение в Telegram (чат для уведомлений сотрудников).

Настройка (только на сервере, в `.env` backend'а):

- `TELEGRAM_EMPLOYEE_BOT_TOKEN` — токен бота (получить у @BotFather).
- `TELEGRAM_ALERT_CHAT_ID` — ID чата или группы (например, `-1001234567890`).

Токен и chat_id **не** вводятся в браузере и не хранятся во фронте. Если переменные не заданы, алерты просто не отправляются.

---

## Запуск проекта локально (кратко)

1. **Backend + БД:**
   ```bash
   docker-compose up -d
   ```
2. **Сидирование БД (один раз, если нужно демо-данные):**
   ```bash
   docker-compose exec backend python seed.py
   ```
3. **Фронт:**
   ```bash
   npm install
   npm run dev:web
   ```
4. Открыть: фронт — `http://localhost:3000`, API — `http://localhost:8000`, health — `http://localhost:8000/health`.

---

## Автотесты (smoke)

Тесты обращаются к уже запущенному backend'у (например, в Docker).

```bash
cd apps/api
pip install -r requirements-dev.txt
pytest tests/ -v
```

Переменная окружения **TEST_API_URL** (по умолчанию `http://localhost:8000`) задаёт базовый URL API.

Проверяются:

- `GET /health` — статус и наличие `db`.
- `POST /api/auth/login` — успешный вход (демо-пользователь `demo` с пустым паролем после seed).
- `GET /api/auth/users`, `GET /api/tasks`, `GET /api/system/logs` — ответ 200 и тип данных.

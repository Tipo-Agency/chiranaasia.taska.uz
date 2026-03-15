# Миграция данных: Firestore → Postgres (Taska backend)

Цель: **полностью уйти с Firestore** и перенести данные в ваш Python backend (`apps/api/`) + PostgreSQL.

В этом репозитории структура Postgres уже соответствует вашим коллекциям Firestore (см. Alembic миграции в `apps/api/alembic/versions/`), поэтому миграцию проще всего делать **через API** бэкенда (upsert), а не писать “ручные INSERT”.

## Готовый скрипт миграции

В репозитории есть скрипт **однократного** переноса данных. Запускается после первой установки нового бэкенда на сервере.

- Описание и переменные: [scripts/README.md](../scripts/README.md)
- Запуск из корня репо:
  ```bash
  pip install -r scripts/requirements-migrate.txt
  export BACKEND_URL=http://localhost:8000
  export FIREBASE_CREDENTIALS=/path/to/firebase-service-account.json
  python scripts/migrate_firestore_to_postgres.py
  ```
- Режим «только проверить»: `python scripts/migrate_firestore_to_postgres.py --dry-run`
- Импорт из уже экспортированных JSON: `python scripts/migrate_firestore_to_postgres.py --from-json ./export`

---

## 1) Что переносим (минимальный набор)

Коллекции Firestore, которые у вас точно есть в `apps/web/services/firestoreService.ts` (или были в старом проекте):

- `users`
- `projects`
- `tables`
- `tasks`
- `statuses`, `priorities`
- `activity`
- `notificationPrefs`
- `clients`, `deals`, `accountsReceivable`, `employeeInfos`
- `docs`, `folders`, `meetings`, `contentPosts`
- `departments`, `financeCategories`, `financePlan`, `purchaseRequests`, `financialPlanDocuments`, `financialPlannings`
- `orgPositions`, `businessProcesses`, `automationRules`
- `warehouses`, `inventoryItems`, `stockMovements`
- `salesFunnels`
- `partnerLogos`, `news`, `cases`, `tags`

---

## 2) Подготовка нового бэка

1. Поднимите Postgres + backend:

```bash
docker-compose up -d
```

2. Проверьте, что API живое:
- `GET /health` → `{"status":"ok"}`
- Swagger: `http://localhost:8000/docs`

---

## 3) Экспорт из Firestore (в JSON)

Самый надежный формат для миграции: **JSON с сохранением `id`** для каждого документа.

Вариант A (рекомендуется): скрипт на Node.js с `firebase-admin`, который:
- логинится по service account,
- читает коллекции,
- пишет `export/*.json` (массив объектов `{ id, ...data }`).

Псевдокод (идея):

```ts
// export-firestore.ts (идея)
// 1) admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })
// 2) db.collection("tasks").get()
// 3) writeFileSync("export/tasks.json", JSON.stringify(docs, null, 2))
```

Важно:
- Firestore `Timestamp` конвертируйте в ISO-строки (у вас уже есть похожая логика в `services/firestoreService.ts`).
- Вложенные структуры (например `comments`, `attachments`) оставляйте как JSON — в Postgres они лежат в `JSONB`.

---

## 4) Импорт в Postgres через API (upsert)

### Почему через API
В ваших роутерах бэка уже есть логика:
- camelCase → snake_case
- апсерт по `id`
- JSONB поля (`comments`, `attachments`, `assigneeIds` и т.п.)

Это резко снижает шанс “кривых” полей при миграции.

### Общий алгоритм импорта

1) **Справочники/настройки** (создаем первыми):
- `statuses`, `priorities`, `tables`, `projects`, `departments`, `financeCategories`, `salesFunnels`, `tags`

2) **Пользователи**:
- `users`

3) **Основные сущности**:
- `clients`, `deals`, `employeeInfos`, `accountsReceivable`
- `docs`, `folders`, `meetings`, `contentPosts`
- `tasks`

4) **Служебное**:
- `notificationPrefs`, `automationRules`, `activity`
- `businessProcesses`, `orgPositions`
- `warehouses`, `inventoryItems`, `stockMovements`

### Маппинг “коллекция → endpoint”

Базовый принцип: почти везде это `GET/PUT` по префиксу роутера.
Список роутеров смотрите в Swagger (`/docs`) или в `apps/api/app/main.py`.

Примеры:
- `users` → `PUT /api/auth/users`
- `tasks` → `PUT /api/tasks`
- `projects` → `PUT /api/projects`
- `tables` → `PUT /api/tables`

Если где-то endpoint отличается (например `notification-prefs` может быть не “updateAll”, а “update single”), ориентируйтесь на Swagger — это самый быстрый способ не гадать.

---

## 5) Файлы/картинки (Firebase Storage)

В Firestore у вас часто хранятся **URL** (например `logoUrl`, `imageUrl`, `mediaUrl`, `attachments[].url`).

Есть два сценария:
- **Быстрый**: оставить URL как есть (будут продолжать указывать на Firebase Storage).
- **Полный переезд**: скачать файлы из Firebase Storage и загрузить в ваш Storage (S3/MinIO/Cloudflare R2), затем обновить URL в Postgres.

---

## 6) Переключение (cutover) без потери данных

Рекомендуемая схема:
- **Шаг 1**: прогон миграции на тестовый Postgres → сверка количества документов по коллекциям.
- **Шаг 2**: “заморозка” записи в Firestore (на время миграции) или короткое окно обслуживания.
- **Шаг 3**: финальный экспорт/импорт “последней дельты”.
- **Шаг 4**: переключение фронта на новый backend.

---

## 7) Проверка (валидируем)

Минимальный чек:
- количество записей в Firestore коллекции ≈ количество строк в таблице Postgres
- выборочно 10–20 сущностей: `id`, даты, JSON-поля, связи (`*_id`)
- авторизация (`/api/auth/login`) и базовые экраны (tasks, crm, content)


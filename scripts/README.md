# Скрипты

## Миграция Firestore → Postgres

Скрипт **однократного** переноса данных из Firebase Firestore в PostgreSQL через API бэкенда (Taska). Запускается после первой установки новой версии с Python на сервере.

### Требования

- Python 3.10+
- Поднятый backend + Postgres (например `docker-compose up -d`)
- Доступ к Firestore (ключ сервисного аккаунта) **или** заранее экспортированные JSON-файлы

### Переменные окружения

| Переменная | Описание |
|------------|----------|
| `BACKEND_URL` | URL API (например `https://api.tipa.taska.uz` или `http://localhost:8000`) |
| `FIREBASE_CREDENTIALS` или `GOOGLE_APPLICATION_CREDENTIALS` | Путь к JSON с ключом сервисного аккаунта Firebase (только при чтении из Firestore) |
| `FIREBASE_PROJECT_ID` | (опционально) ID проекта Firebase |

`.env` можно положить в корень репозитория или в `apps/api/`. Скрипт подхватит его сам.

### Установка зависимостей для миграции

```bash
pip install -r scripts/requirements-migrate.txt
```

### Запуск (чтение из Firestore)

```bash
# Из корня репозитория
export BACKEND_URL=http://localhost:8000
export FIREBASE_CREDENTIALS=/path/to/firebase-service-account.json
python scripts/migrate_firestore_to_postgres.py
```

### Запуск (чтение из JSON)

Если Firestore уже экспортирован в файлы (например, через панель Firebase или отдельный скрипт), можно передать папку с JSON:

```bash
export BACKEND_URL=http://localhost:8000
python scripts/migrate_firestore_to_postgres.py --from-json ./export
```

В папке `export` ожидаются файлы: `users.json`, `tasks.json`, `clients.json`, `deals.json` и т.д. (имена коллекций Firestore в camelCase).

### Режим проверки (dry-run)

Только прочитать данные из Firestore и вывести счётчики, в API ничего не отправлять:

```bash
python scripts/migrate_firestore_to_postgres.py --dry-run
```

Подробнее о шагах миграции и проверке см. [docs/MIGRATION_FROM_FIRESTORE_TO_POSTGRES.md](../docs/MIGRATION_FROM_FIRESTORE_TO_POSTGRES.md).

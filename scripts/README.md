# Скрипты репозитория

Утилиты **разовой** или редкой нагрузки; не входят в runtime приложения.

## Миграция Firestore → PostgreSQL

Однократный перенос исторических данных из Firebase Firestore в API (актуально после перехода на Postgres).

**Требования:** Python 3.10+, поднятый backend и Postgres, доступ к Firestore **или** заранее экспортированные JSON.

**Зависимости:**

```bash
pip install -r scripts/requirements-migrate.txt
```

**Пример (из Firestore):**

```bash
export BACKEND_URL=http://localhost:8000
export FIREBASE_CREDENTIALS=/path/to/service-account.json
python scripts/migrate_firestore_to_postgres.py
```

**Из папки JSON:** `python scripts/migrate_firestore_to_postgres.py --from-json ./export`

**Dry-run:** `python scripts/migrate_firestore_to_postgres.py --dry-run`

Переменные окружения и имена файлов экспорта — см. комментарии в скрипте.

## Прочее

Другие файлы в `scripts/` — см. заголовки и комментарии внутри. Полная документация продукта: **[docs/README.md](../docs/README.md)**.

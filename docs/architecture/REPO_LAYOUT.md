# Структура репозитория

```
.
├── apps/
│   ├── web/                 # React + Vite + TypeScript + Tailwind (PostCSS)
│   │   ├── components/      # Экраны, модули, UI
│   │   ├── frontend/hooks/  # useAppLogic и слайсы (auth, finance, …)
│   │   ├── services/        # apiClient.ts, интеграции
│   │   └── utils/
│   ├── api/                 # FastAPI
│   │   ├── app/
│   │   │   ├── main.py      # Точка входа, подключение роутеров, lifespan + Alembic
│   │   │   ├── config.py    # Settings из env
│   │   │   ├── auth.py      # JWT, пароли (bcrypt)
│   │   │   ├── models/      # SQLAlchemy-модели
│   │   │   └── routers/     # Эндпоинты по доменам
│   │   └── alembic/         # Миграции
│   └── bot/                 # Telegram-бот (python-telegram-bot, scheduler)
├── ops/
│   ├── nginx/nginx.conf     # Шаблон для сервера (копируется деплоем)
│   └── scripts/deploy.sh    # Скрипт деплоя на сервере
├── docs/                    # Документация (этот каталог)
├── scripts/                 # Одноразовые скрипты (миграция Firestore→Postgres и т.д.)
├── docker-compose.yml       # db + backend (+ опционально tools)
├── package.json             # workspaces: apps/web; скрипты build:web, dev:web
└── README.md                # Краткая выжимка для разработчика
```

## Зависимости между приложениями

- **web** зависит только от **HTTP API** (базовый URL тот же origin в проде через `/api`).
- **bot** зависит от **api** по `BACKEND_URL`.
- **api** зависит от **PostgreSQL** (`DATABASE_URL`).

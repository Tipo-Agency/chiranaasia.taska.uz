# ТЗ текущее (актуальные договорённости)

## Общее

- На сервере код обновляется только по изменениям (`git fetch` + `git merge origin/main --ff-only`), без `git reset --hard` и без `git clean`. БД при деплое не чистится (Docker volumes сохраняются).
- Миграция Firestore → Postgres уже выполнена, при деплое не запускается.
- Создание/обновление админа при деплое отключено; админ создаётся вручную при необходимости.

## Деплой и сервер

- **Порты:** Postgres — 5433, бэкенд — 8003. Nginx раздаёт статику из `/var/www/frontend` и проксирует `/api/` и `/health` на `127.0.0.1:8003`.
- **Nginx:** конфиг в `ops/nginx/nginx.conf`, `server_name tipa.taska.uz`, HTTP (80) и HTTPS (443) с сертификатами Certbot. При каждом деплое конфиг копируется в `/etc/nginx/sites-available/$NGINX_SITE_NAME`, выполняется `nginx -t` и `reload`.
- **Секреты GitHub:** `SERVER_HOST`, `SERVER_USER`, `SERVER_SSH_KEY`, `SERVER_PATH`, `TELEGRAM_BOT_TOKEN`, `BACKEND_URL`, `NGINX_SITE_NAME` (по умолчанию `tipa.taska.uz`).
- **Скрипт деплоя** `ops/scripts/deploy.sh`: обновление кода через `git fetch` + `git merge origin/main --ff-only`, поднятие Docker (db + backend), сборка фронта, деплой бота, копирование nginx и reload.

## Бэкенд (apps/api)

- **Авторизация:** bcrypt в `app/auth.py` (`verify_password`, `get_password_hash`).
- **Выписки и справки (функционал из Учётграм Наутилус):**
  - Модели: `BankStatement`, `BankStatementLine`, `IncomeReport` в `app/models/finance.py`.
  - Роуты: `GET/PUT/DELETE /finance/bank-statements`, `GET/PUT /finance/income-reports`.
  - Миграция Alembic: `004_bank_statements_income_reports.py`.

## Фронт (apps/web)

- **Вход:** только форма по логину и паролю (`LoginView`). Кнопки быстрого входа без пароля нет; отладочные логи по Auth убраны.
- **Tailwind:** в проде сборка через PostCSS (`tailwind.config.js`, `postcss.config.js`, в CSS — `@tailwind`). CDN из `index.html` не используется.
- **URL при навигации:** при переходах по разделам меняется pathname (/, /задачи, /входящие, /клиенты, /фин-планирование и т.д.). Инициализация вида из URL при загрузке, `popstate` для кнопок Назад/Вперёд. Реализация в useSettingsLogic: `VIEW_TO_PATH`, `PATH_TO_VIEW`, `setCurrentView` с `pushState`.
- **Рабочий стол:** вкладки «Входящие / Исходящие / Сообщения» в одном стиле с остальными (светлая «таблетка» для активной вкладки, как Таблица/Канбан/Гант). Увеличены отступы и структура страницы.
- **Финансы:** вкладка «Выписки и сверка». Загрузка Excel-выписок (парсер в `utils/bankStatementParser.ts`, зависимость `xlsx`), список выписок с раскрытием строк, сверка по датам (приходы по дням из выписок). Типы: `BankStatement`, `BankStatementLine`, `IncomeReport`. API и состояние в useFinanceLogic и useAppLogic.

## Файлы для контекста

- Деплой: `.github/workflows/deploy.yml`, `ops/scripts/deploy.sh`, `ops/nginx/nginx.conf`
- Выписки: `apps/api/app/models/finance.py`, `apps/api/app/routers/finance.py`, `apps/web/components/finance/BankStatementsView.tsx`, `apps/web/utils/bankStatementParser.ts`
- Настройка: README.md, docs/DEPLOY_FLOW.md, docs/DEPLOY_AND_MIGRATION.md

# Деплой и миграция Firestore → Postgres

Краткий чеклист: заливка нового кода с Python-бэкендом, миграция данных, проверка и исправление багов.

## 1. Подготовка

- В GitHub → Settings → Secrets and variables → Actions заданы:
  - `SERVER_HOST`, `SERVER_USER`, `SERVER_SSH_KEY`, `SERVER_PATH`
  - `TELEGRAM_BOT_TOKEN`
  - `BACKEND_URL` — URL вашего API (например `https://tipa.taska.uz/api` или `http://127.0.0.1:8000` для бота на том же сервере)
- **На сервере обязательно:** Docker + Docker Compose, Node.js, nginx.
- **Порты проекта:** бэкенд на хосте — **8003** (конфликта с занятыми 5432/8000 нет). Фронт отдаёт nginx с 80/443; при необходимости дебаг/превью на портах из списка (3002, 3003 и т.д.) настраивается отдельно.

### Установка Docker на сервере (Ubuntu/Debian)

Если в логах деплоя: «Docker Compose не найден» — зайдите по SSH и выполните:

```bash
# Docker Engine + Compose plugin
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Выйти из SSH и зайти снова, чтобы группа docker применилась
sudo apt-get update && sudo apt-get install -y docker-compose-plugin
```

Проверка: `docker compose version` или `docker-compose --version` должны выполняться без ошибок.

- Один раз положите на сервер ключ Firebase (для миграции): например скопируйте `firebase-service-account.json` в `$SERVER_PATH/firebase-key.json` и в Secrets добавьте `FIREBASE_CREDENTIALS=/var/www/tipa.taska.uz/firebase-key.json` (и при первом деплое — `RUN_MIGRATE_FIRESTORE=1`).

## 2. Деплой

Пуш в `main` запускает автодеплой:

1. Обновление кода (git pull).
2. Запуск Docker: Postgres + backend (`docker compose up -d db backend`).
3. Сборка фронта (`npm ci`, `npm run build:web`), копирование в `/var/www/frontend`.
4. Деплой Telegram-бота (systemd, .env с `TELEGRAM_BOT_TOKEN` и `BACKEND_URL`).
5. Если заданы `RUN_MIGRATE_FIRESTORE` и `FIREBASE_CREDENTIALS` — запуск скрипта миграции Firestore → Postgres.
6. Перезагрузка nginx.

## 3. Миграция данных (если не автоматически)

Если миграция не запускалась при деплое, зайдите на сервер и выполните один раз:

```bash
cd $SERVER_PATH   # например /var/www/tipa.taska.uz
pip install -r scripts/requirements-migrate.txt
export BACKEND_URL=http://127.0.0.1:8000
export FIREBASE_CREDENTIALS=/var/www/tipa.taska.uz/firebase-key.json
python3 scripts/migrate_firestore_to_postgres.py
```

Проверка без записи в API: добавьте `--dry-run`.

## 4. Проверка после деплоя

- **Backend:** `curl http://127.0.0.1:8000/health` → `{"status":"ok","db":"ok"}`.
- **Сайт:** открыть в браузере, авторизация, список задач, CRM, контент — всё открывается и сохраняется.
- **Бот:** написать боту в Telegram, убедиться, что он отвечает и видит данные (после миграции — из Postgres).
- **Логи:** в приложении «Настройки → Система / Логи» или `GET /api/system/logs?limit=50` — смотреть ошибки.

## 5. Пошаговая проверка: «ничего не обновилось на фронте»

Если после пуша в main сайт выглядит по-старому (даже в инкогнито), проверяй по порядку.

### Шаг 1: Деплой вообще запустился?

- Зайди в репо **tipa.taska.uz** на GitHub → вкладка **Actions**.
- Есть ли зелёный запуск workflow по последнему коммиту? Если нет или он красный — деплой не прошёл или упал, смотри логи в Actions.

### Шаг 2: На сервере — обновился ли код?

Зайди по SSH на сервер и выполни:

```bash
cd $SERVER_PATH   # например /var/www/tipa.taska.uz
git log -1 --oneline
git status
```

- `git log` должен показывать последний коммит с деплоем (например «Deploy: Python backend + Postgres...»).
- Если коммит старый — на сервере не сделали pull. Вручную: `git fetch origin && git reset --hard origin/main`.

### Шаг 3: Поднялись ли Docker (БД и бэкенд)?

На сервере:

```bash
cd $SERVER_PATH
docker compose ps
# или: docker-compose ps
```

Должны быть контейнеры **db** и **backend** в статусе **Up**. Если их нет или они Exited:

```bash
docker compose up -d db backend
docker compose logs backend --tail 50
```

Если в логах ошибки (БД недоступна, порт занят) — исправь и перезапусти.

### Шаг 4: Бэкенд отвечает?

На сервере или с твоего компа (если порт проброшен или открыт):

```bash
curl http://127.0.0.1:8000/health
# с компа, если есть доступ: curl https://tipa.taska.uz/health
```

Ожидаемо: `{"status":"ok","version":"1.0.0","db":"ok"}`. Если connection refused / 502 — бэкенд не слушает 8000 или nginx не проксирует (см. шаг 6).

### Шаг 5: Фронт собран и скопирован?

На сервере:

```bash
ls -la /var/www/frontend/
ls -la $SERVER_PATH/apps/web/dist/
```

- В `/var/www/frontend/` должны быть `index.html`, папка `assets/` с JS/CSS (дата/время — свежие после деплоя).
- Если `/var/www/frontend/` пустой или старый — деплой не скопировал сборку (права? путь?). Проверь логи GitHub Actions на шаге «Deploy frontend» и при необходимости вручную:  
  `sudo rsync -a --delete $SERVER_PATH/apps/web/dist/ /var/www/frontend/`

### Шаг 6: Nginx отдаёт новый фронт и проксирует API?

На сервере:

```bash
nginx -t
sudo systemctl status nginx
# конфиг: обычно /etc/nginx/sites-enabled/ или /etc/nginx/conf.d/
```

В конфиге должно быть:

- `root /var/www/frontend;` (или путь, куда реально скопирован фронт).
- `location /api/ { proxy_pass http://127.0.0.1:8000; ... }`
- `location /health { proxy_pass http://127.0.0.1:8000; }`

После правок: `sudo systemctl reload nginx`.

### Шаг 7: Кэш браузера и CDN

- Открой сайт в **режиме инкогнито** или с **жёстким обновлением** (Ctrl+Shift+R / Cmd+Shift+R).
- Если перед сайтом стоит CDN или прокси — сбрось кэш там или подожди TTL.

Итог: если на шаге 1–2 код обновился, на 3–4 бэк и БД работают, на 5–6 фронт лежит в нужном месте и nginx настроен — фронт обязан обновиться. Где шаг впервые ломается — там и править.

---

## 6. Если что-то сломалось

- **502 / API не отвечает:** backend не запущен. На сервере: `docker compose ps`, при необходимости `docker compose up -d db backend` и смотреть `docker compose logs backend`.
- **Фронт пустой или 404:** проверьте, что `/var/www/frontend` заполнен (деплой копирует туда `apps/web/dist`). Или поменяйте в nginx `root` на `$SERVER_PATH/apps/web/dist`.
- **Бот не видит данные:** в `apps/bot/.env` должен быть `BACKEND_URL` (URL API). После миграции бот ходит в Python API, а не в Firestore.
- **Ошибки при миграции:** смотреть вывод скрипта; при несовпадении полей — правки в скрипте или в API (маппинг camelCase ↔ snake_case). Логи API: `docker compose logs backend`.
- **Баги в интерфейсе:** логи фронта (F12 → Console), логи бэкенда и таблица `system_logs` — по ним править код и при необходимости делать хотфикс и повторный пуш в `main`.

После исправлений — коммит, пуш в `main`, автодеплой отработает снова.

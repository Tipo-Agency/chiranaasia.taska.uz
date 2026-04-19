# Порты и статика: одна «правда», без 502

## Backend (API)

| Где задаётся | Переменная | Дефолт |
|--------------|------------|--------|
| `docker-compose.yml` | `BACKEND_PUBLISH_PORT` в корневом `.env` | **8003** |
| Публикация на хост | `ports: "${BACKEND_PUBLISH_PORT:-8003}:8000"` | контейнер слушает 8000, снаружи — ваш порт |
| **nginx** `proxy_pass http://127.0.0.1:XXXX` | **должен совпадать** с тем же портом | см. `ops/nginx/nginx.conf` |
| **`ops/scripts/deploy.sh`** | читает `BACKEND_PUBLISH_PORT` из env или `.env`, ждёт `/health` на этом порту | |

Если на одном сервере **два** compose-стека (например `tipa` и `chiranaasia`), у каждого свой `.env` и свой **`BACKEND_PUBLISH_PORT`** (8003, 8004, …). В **nginx** для каждого `server_name` свой `proxy_pass` на **свой** порт.

**502 Bad Gateway** на `/api/...` почти всегда значит: nginx стучится в порт, где **ничего не слушает** (контейнер не поднят, другой порт, другой хост).

Проверка на сервере:

```bash
grep BACKEND_PUBLISH_PORT /var/www/chiranaasia.taska.uz/.env
curl -s -o /dev/null -w "%{http_code}\n" "http://127.0.0.1:8003/health"   # подставьте свой порт
docker compose -f /var/www/chiranaasia.taska.uz/docker-compose.yml ps
```

## Статика (фронт)

| Что | Путь |
|-----|------|
| Сборка Vite | `<клон>/apps/web/dist/` |
| Что видит nginx `root` | По умолчанию симлинк **`/var/www/frontend` → `…/apps/web/dist`** (создаёт `deploy.sh`) |

`root` в `sites-available/…` и **`FRONTEND_SYMLINK`** в env деплоя должны указывать на **одно и то же** (обычно `/var/www/frontend`).

## Фронт в браузере

`apps/web` ходит в API по **`/api`** (same-origin), если не задан `VITE_API_URL`. Порты nginx/API тут не прописываются — их задаёт только nginx + compose.

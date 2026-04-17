#!/bin/bash
# Скрипт автоматического деплоя для GitHub Actions
# Использование: ./ops/scripts/deploy.sh

set +e  # Не падаем на ошибках, обрабатываем их вручную

SERVER_PATH="${SERVER_PATH:-/var/www/chiranaasia.taska.uz}"
TELEGRAM_BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-}"
META_MARKER="${META_MARKER:-}"
META_TASKA="${META_TASKA:-}"
META_TIPA="${META_TIPA:-}"
META_UCHETGRAM="${META_UCHETGRAM:-}"
TELEGRAM_API_ID="${TELEGRAM_API_ID:-}"
TELEGRAM_API_HASH="${TELEGRAM_API_HASH:-}"
SECRET_KEY="${SECRET_KEY:-}"
BACKEND_URL="${BACKEND_URL:-http://127.0.0.1:8003}"

echo "🚀 Starting deployment..."
echo "👤 Deploy user: $USER"
echo "📁 Server path: $SERVER_PATH"

# Переходим в директорию проекта
cd "$SERVER_PATH" || { echo "❌ Failed to cd to $SERVER_PATH"; exit 1; }

# 1. Исправляем права на всю папку проекта
echo ""
echo "🔧 Step 1: Fixing ownership..."
sudo chown -R "$USER:$USER" "$SERVER_PATH" || true
sudo chmod -R u+rwX "$SERVER_PATH" || true
if [ -d "$SERVER_PATH/.git" ]; then
  sudo chown -R "$USER:$USER" "$SERVER_PATH/.git" || true
  sudo chmod -R u+rwX "$SERVER_PATH/.git" || true
fi
git config --global --add safe.directory "$SERVER_PATH" || true
echo "✅ Ownership fixed"

# 2. Обновляем код только по изменениям (merge, без жёсткой очистки)
echo ""
echo "📥 Step 2: Updating code (git fetch + merge, no reset/clean)..."
git fetch origin || { echo "❌ git fetch failed"; exit 1; }
git merge origin/main --ff-only || { echo "❌ git merge --ff-only failed (не fast-forward? сделайте pull/merge на сервере или перезапустите деплой)"; exit 1; }
sudo chown -R "$USER:$USER" "$SERVER_PATH" || true
echo "✅ Code updated (merge only, DB and untracked files unchanged)"

# 2a. Файл .env в корне репо (для docker compose: backend нужен TELEGRAM_BOT_TOKEN для админки «Тестовая отправка»)
echo ""
echo "🔐 Step 2a: Ensuring .env for Docker (TELEGRAM_BOT_TOKEN for backend)..."
cd "$SERVER_PATH" || exit 1
if [ ! -f ".env" ]; then
  touch .env
fi
if [ -n "$TELEGRAM_BOT_TOKEN" ]; then
  if grep -q "^TELEGRAM_BOT_TOKEN=" .env 2>/dev/null; then
    sed -i "s|^TELEGRAM_BOT_TOKEN=.*|TELEGRAM_BOT_TOKEN=$TELEGRAM_BOT_TOKEN|" .env
  else
    echo "TELEGRAM_BOT_TOKEN=$TELEGRAM_BOT_TOKEN" >> .env
  fi
  echo "   TELEGRAM_BOT_TOKEN written to .env (backend will receive it)"
else
  echo "   ⚠️ TELEGRAM_BOT_TOKEN empty, backend will not have token (set GitHub secret)"
fi

# SECRET_KEY обязателен для backend/воркеров в docker-compose.
if [ -n "$SECRET_KEY" ]; then
  if grep -q "^SECRET_KEY=" .env 2>/dev/null; then
    grep -v "^SECRET_KEY=" .env > .env.tmp && mv .env.tmp .env
  fi
  printf '%s=%s\n' "SECRET_KEY" "$SECRET_KEY" >> .env
  echo "   SECRET_KEY written to .env"
fi

# Meta / Instagram (webhook verify + page tokens для Graph API)
for _meta_key in META_MARKER META_TASKA META_TIPA META_UCHETGRAM; do
  _meta_val="${!_meta_key}"
  if [ -n "$_meta_val" ]; then
    if grep -q "^${_meta_key}=" .env 2>/dev/null; then
      grep -v "^${_meta_key}=" .env > .env.tmp && mv .env.tmp .env
    fi
    printf '%s=%s\n' "$_meta_key" "$_meta_val" >> .env
    echo "   ${_meta_key} written to .env"
  fi
done
if [ -z "$META_MARKER" ]; then
  echo "   ⚠️ META_MARKER пуст — GET /webhook/meta вернёт 503 (задайте тот же секрет, что «Подтверждение маркера» в Meta)"
fi

_secret_from_env="$(grep '^SECRET_KEY=' .env 2>/dev/null | tail -n1 | cut -d'=' -f2-)"
if [ -z "$_secret_from_env" ]; then
  echo "   SECRET_KEY отсутствует в .env — генерируем новый безопасный ключ..."
  _generated_secret=""
  if command -v openssl >/dev/null 2>&1; then
    _generated_secret="$(openssl rand -hex 32 2>/dev/null || true)"
  fi
  if [ -z "$_generated_secret" ] && command -v python3 >/dev/null 2>&1; then
    _generated_secret="$(python3 - <<'PY'
import secrets
print(secrets.token_hex(32))
PY
)"
  fi
  if [ -z "$_generated_secret" ]; then
    _generated_secret="$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')"
  fi
  printf '%s=%s\n' "SECRET_KEY" "$_generated_secret" >> .env
  _secret_from_env="$_generated_secret"
  echo "   SECRET_KEY generated and saved to .env"
fi
if [ "${#_secret_from_env}" -lt 32 ]; then
  echo "❌ SECRET_KEY слишком короткий (${#_secret_from_env} символов). Нужно минимум 32."
  exit 1
fi
# Если GitHub Action передал пустой SECRET_KEY, убираем его из env:
# docker compose иначе берёт пустую переменную окружения и игнорирует .env.
if [ -z "$SECRET_KEY" ]; then
  unset SECRET_KEY
fi

# MTProto (личный Telegram): TELEGRAM_API_ID + TELEGRAM_API_HASH из GitHub Secrets
for _k in TELEGRAM_API_ID TELEGRAM_API_HASH; do
  _val="${!_k}"
  if [ -n "$_val" ]; then
    if grep -q "^${_k}=" .env 2>/dev/null; then
      grep -v "^${_k}=" .env > .env.tmp && mv .env.tmp .env
    fi
    printf '%s=%s\n' "$_k" "$_val" >> .env
    echo "   ${_k} written to .env"
  fi
done
if [ -z "$TELEGRAM_API_ID" ] || [ -z "$TELEGRAM_API_HASH" ]; then
  echo "   ⚠️ TELEGRAM_API_ID / TELEGRAM_API_HASH пусты — личный Telegram в профиле не активируется (задайте в GitHub Actions Secrets)"
fi

sudo chown "$USER:$USER" .env 2>/dev/null || true

# 2b. Поднимаем Postgres + Python backend (Docker)
echo ""
echo "🐳 Step 2b: Starting Postgres + backend (Docker)..."
cd "$SERVER_PATH" || exit 1
if [ ! -f "docker-compose.yml" ]; then
  echo "❌ docker-compose.yml not found"
  exit 1
fi
if docker compose version &>/dev/null; then
  DOCKER_CMD="docker compose"
elif command -v docker-compose &>/dev/null; then
  DOCKER_CMD="docker-compose"
else
  echo "❌ Docker Compose не найден на сервере."
  echo ""
  echo "Установка на Ubuntu/Debian (выполните на сервере по SSH):"
  echo "  curl -fsSL https://get.docker.com | sh"
  echo "  sudo usermod -aG docker \$USER   # затем выйти и зайти по SSH снова"
  echo "  sudo apt-get install -y docker-compose-plugin   # плагин 'docker compose'"
  echo ""
  echo "Или установите standalone: sudo apt-get install -y docker-compose"
  echo "После установки перезапустите деплой (повторный пуш или Re-run job в Actions)."
  exit 1
fi
echo "   Using: $DOCKER_CMD"
# Все сервисы приложения из корневого compose (без profile tools): Redis, API, воркеры очередей.
# См. docs/QUEUES.md и docs/OPERATIONS.md §3.
OPS_COMPOSE_SERVICES="db redis backend integrations-worker domain-events-worker retention-worker notifications-worker"
if ! $DOCKER_CMD up -d --build $OPS_COMPOSE_SERVICES; then
  echo "❌ Docker Compose failed. Вывод выше — смотрите причину (права, порты, образы)."
  echo "   На сервере выполните: $DOCKER_CMD logs backend"
  exit 1
fi
# Пересоздать backend, чтобы подхватить актуальный .env (TELEGRAM_BOT_TOKEN для админки)
$DOCKER_CMD up -d --force-recreate backend 2>/dev/null || true
echo "   Waiting for backend to be ready (port 8003)..."
for i in 1 2 3 4 5 6 7 8 9 10; do
  curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8003/health 2>/dev/null | grep -q 200 && break
  sleep 2
done
if $DOCKER_CMD ps --services --filter "status=running" 2>/dev/null | grep -qx "backend"; then
  if curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8003/health 2>/dev/null | grep -q 200; then
    echo "✅ Backend container running and /health is 200"
  else
    echo "❌ Backend container запущен, но /health != 200"
    echo "📋 Backend logs (last 120 lines):"
    $DOCKER_CMD logs --tail=120 backend || true
    exit 1
  fi
else
  echo "❌ Backend container is not running"
  echo "📋 Backend logs (last 120 lines):"
  $DOCKER_CMD logs --tail=120 backend || true
  exit 1
fi
cd "$SERVER_PATH" || exit 1

# 3. Деплой фронтенда (чистая сборка и затирание старого фронта в /var/www/frontend)
echo ""
echo "🚀 Step 3: Deploying frontend..."
cd "$SERVER_PATH" || exit 1
rm -rf node_modules apps/web/node_modules 2>/dev/null || true
npm ci || { echo "❌ npm ci failed"; exit 1; }
npm run build:web || { echo "❌ npm run build:web failed"; exit 1; }
if [ ! -d "apps/web/dist" ]; then
  echo "❌ apps/web/dist not found after build"
  exit 1
fi
sudo mkdir -p /var/www/frontend
sudo rsync -a --delete apps/web/dist/ /var/www/frontend/ || { sudo cp -r apps/web/dist/. /var/www/frontend/ || { echo "❌ Copy to /var/www/frontend failed"; exit 1; }; }
echo "✅ Frontend deployed to /var/www/frontend (old content wiped)"

# 4. Деплой Telegram бота
echo ""
echo "🤖 Step 4: Deploying Telegram bot..."
if [ -d "apps/bot" ]; then
  if [ -z "$TELEGRAM_BOT_TOKEN" ]; then
    echo "⚠️ TELEGRAM_BOT_TOKEN не передан (пустой или не задан в GitHub Actions Secrets). Задайте секрет TELEGRAM_BOT_TOKEN в репозитории: Settings → Secrets and variables → Actions."
  fi
  cd apps/bot || { echo "❌ Failed to cd to apps/bot"; exit 1; }
  
  # Исправляем права
  sudo chown -R "$USER:$USER" "$(pwd)" || true
  sudo chmod -R u+rwX "$(pwd)" || true
  
  # Обновляем .env (токен бота и URL бэкенда)
  echo "🔐 Updating .env file..."
  if [ ! -f ".env" ]; then
    touch .env
  fi
  if [ -n "$TELEGRAM_BOT_TOKEN" ]; then
    if grep -q "^TELEGRAM_BOT_TOKEN=" .env; then
      sed -i "s|^TELEGRAM_BOT_TOKEN=.*|TELEGRAM_BOT_TOKEN=$TELEGRAM_BOT_TOKEN|" .env
    else
      echo "TELEGRAM_BOT_TOKEN=$TELEGRAM_BOT_TOKEN" >> .env
    fi
  fi
  if [ -n "$BACKEND_URL" ]; then
    if grep -q "^BACKEND_URL=" .env; then
      sed -i "s|^BACKEND_URL=.*|BACKEND_URL=$BACKEND_URL|" .env
    else
      echo "BACKEND_URL=$BACKEND_URL" >> .env
    fi
  fi
  sudo chown "$USER:$USER" .env || true
  chmod 600 .env || true
  echo "✅ .env updated"
  
  # Обновляем systemd сервис
  echo "🔧 Updating systemd service..."
  if [ -f "telegram-bot.service" ]; then
    sudo cp telegram-bot.service /etc/systemd/system/telegram-bot.service
    sudo chmod 644 /etc/systemd/system/telegram-bot.service
    sudo systemctl daemon-reload
    echo "✅ Systemd service updated"
  else
    echo "⚠️ telegram-bot.service not found, skipping..."
  fi
  
  # Запускаем deploy.sh бота
  if [ -f "deploy.sh" ]; then
    chmod +x deploy.sh
    echo "📝 Running bot deploy.sh..."
    DEPLOY_USER="$USER" sudo -E ./deploy.sh || {
      echo "⚠️ Bot deploy.sh exited with error, but checking status..."
      if systemctl is-active --quiet telegram-bot 2>/dev/null; then
        echo "✅ Bot is actually running"
      else
        echo "❌ Bot is NOT running"
      fi
    }
  fi
  
  # Перезапускаем сервис
  echo "🔄 Restarting bot service..."
  sudo systemctl restart telegram-bot.service || echo "⚠️ Failed to restart service"
  sleep 3
  
  # Проверяем статус
  if systemctl is-active --quiet telegram-bot 2>/dev/null; then
    echo "✅ Telegram bot is running"
    # Проверяем на ошибки 409
    if sudo journalctl -u telegram-bot -n 20 --no-pager 2>/dev/null | grep -qi "409\|conflict"; then
      echo "   ⚠️ Found 409/Conflict errors in logs!"
    else
      echo "   ✅ No 409/Conflict errors"
    fi
  else
    echo "❌ Telegram bot is NOT running!"
    echo "📋 Recent logs:"
    sudo journalctl -u telegram-bot -n 10 --no-pager 2>/dev/null || true
  fi
  
  cd ../.. || true
else
  echo "⚠️ apps/bot directory not found, skipping..."
fi

# 5. Деплой конфига nginx и перезагрузка (статика + /api/ на 8003)
echo ""
echo "🌐 Step 5: Deploying nginx config and reloading..."
NGINX_SITE_NAME="${NGINX_SITE_NAME:-chiranaasia.taska.uz}"
if [ -f "ops/nginx/nginx.conf" ]; then
  sudo cp ops/nginx/nginx.conf "/etc/nginx/sites-available/$NGINX_SITE_NAME" || true
  sudo ln -sf "/etc/nginx/sites-available/$NGINX_SITE_NAME" "/etc/nginx/sites-enabled/$NGINX_SITE_NAME" 2>/dev/null || true
  echo "   Config: ops/nginx/nginx.conf → /etc/nginx/sites-available/$NGINX_SITE_NAME"
fi
if sudo nginx -t 2>/dev/null; then
  sudo systemctl reload nginx && echo "✅ Nginx reloaded (root=/var/www/frontend, /api/ → 8003)"
else
  echo "⚠️ nginx -t failed, reload skipped"
fi

# Финальный статус
echo ""
echo "✅ Deployment completed!"
echo "📋 Final status:"
echo "   Frontend: ✅ Built"
if systemctl is-active --quiet telegram-bot 2>/dev/null; then
  echo "   Telegram bot: ✅ Running"
else
  echo "   Telegram bot: ⚠️ Not running"
fi
if systemctl is-active --quiet nginx 2>/dev/null; then
  echo "   Nginx: ✅ Running"
else
  echo "   Nginx: ⚠️ Not running"
fi

exit 0

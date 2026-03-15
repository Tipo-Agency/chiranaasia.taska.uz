#!/bin/bash
# Скрипт автоматического деплоя для GitHub Actions
# Использование: ./ops/scripts/deploy.sh

set +e  # Не падаем на ошибках, обрабатываем их вручную

SERVER_PATH="${SERVER_PATH:-/var/www/tipa.taska.uz}"
TELEGRAM_BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-}"
BACKEND_URL="${BACKEND_URL:-http://127.0.0.1:8000}"
RUN_MIGRATE_FIRESTORE="${RUN_MIGRATE_FIRESTORE:-}"
FIREBASE_CREDENTIALS="${FIREBASE_CREDENTIALS:-}"

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

# 2. Принудительно обновляем код и затираем старые артефакты
echo ""
echo "📥 Step 2: Force-updating code (stale code will be overwritten)..."
git fetch origin || { echo "❌ git fetch failed"; exit 1; }
git reset --hard origin/main || { echo "❌ git reset failed"; exit 1; }
git clean -fd || true
# Затираем корневые папки старой структуры (monorepo: всё в apps/)
for old in backend components constants frontend hooks services utils telegram-bot seed; do
  if [ -d "$old" ]; then
    echo "   Removing legacy dir: $old"
    rm -rf "$old"
  fi
done
sudo chown -R "$USER:$USER" "$SERVER_PATH" || true
echo "✅ Code updated (hard reset + cleanup)"

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
  echo "❌ Docker Compose не найден. Установите: docker compose или docker-compose"
  exit 1
fi
echo "   Using: $DOCKER_CMD"
if ! $DOCKER_CMD up -d --build db backend; then
  echo "❌ Docker Compose failed. Вывод выше — смотрите причину (права, порты, образы)."
  echo "   На сервере выполните: $DOCKER_CMD logs backend"
  exit 1
fi
echo "   Waiting for backend to be ready..."
for i in 1 2 3 4 5 6 7 8 9 10; do
  curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8000/health 2>/dev/null | grep -q 200 && break
  sleep 2
done
if $DOCKER_CMD ps 2>/dev/null | grep -q backend; then
  echo "✅ Backend container running"
else
  echo "⚠️ Backend container не в списке — проверьте: $DOCKER_CMD ps"
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

# 4b. (Однократно) Миграция Firestore → Postgres. После первого успешного прогона можно убрать этот блок и секреты RUN_MIGRATE_FIRESTORE, FIREBASE_CREDENTIALS.
# В GitHub Secrets: RUN_MIGRATE_FIRESTORE=1, FIREBASE_CREDENTIALS=/path/on/server/to/key.json
if [ -n "$RUN_MIGRATE_FIRESTORE" ] && [ -n "$FIREBASE_CREDENTIALS" ] && [ -f "$FIREBASE_CREDENTIALS" ]; then
  echo ""
  echo "📦 Step 4b: Running Firestore → Postgres migration (one-time)..."
  cd "$SERVER_PATH" || exit 1
  export BACKEND_URL="${BACKEND_URL:-http://127.0.0.1:8000}"
  export FIREBASE_CREDENTIALS
  pip install -q -r scripts/requirements-migrate.txt 2>/dev/null || true
  python3 scripts/migrate_firestore_to_postgres.py || echo "⚠️ Migration script failed — запустите вручную: BACKEND_URL=$BACKEND_URL FIREBASE_CREDENTIALS=... python3 scripts/migrate_firestore_to_postgres.py"
else
  echo ""
  echo "ℹ️  Миграция Firestore не запущена (задайте RUN_MIGRATE_FIRESTORE и FIREBASE_CREDENTIALS для автозапуска или выполните вручную после деплоя)"
fi

# 5. Перезагружаем nginx
echo ""
echo "🔄 Step 5: Reloading nginx..."
nginx -t || echo "⚠️ nginx config test failed"
systemctl reload nginx || echo "⚠️ nginx reload failed"

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

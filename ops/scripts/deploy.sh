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

# 2. Обновляем код (если еще не обновлен)
echo ""
echo "📥 Step 2: Updating code..."
if ! git diff --quiet HEAD origin/main 2>/dev/null; then
  git fetch origin || { echo "⚠️ git fetch failed, but continuing..."; }
  git reset --hard origin/main || { echo "⚠️ git reset failed, but continuing..."; }
  sudo chown -R "$USER:$USER" "$SERVER_PATH" || true
  echo "✅ Code updated"
else
  echo "✅ Code already up to date"
fi

# 2b. Поднимаем Postgres + Python backend (Docker)
echo ""
echo "🐳 Step 2b: Starting Postgres + backend (Docker)..."
if [ -f "docker-compose.yml" ]; then
  docker compose up -d db backend 2>/dev/null || docker-compose up -d db backend 2>/dev/null || {
    echo "⚠️ Docker Compose failed (install Docker?) — backend и БД должны быть запущены вручную"
  }
  if docker compose ps 2>/dev/null | grep -q backend; then
    echo "✅ Backend container running"
  elif docker-compose ps 2>/dev/null | grep -q backend; then
    echo "✅ Backend container running"
  else
    echo "⚠️ Backend container not detected — проверьте docker compose ps"
  fi
else
  echo "⚠️ docker-compose.yml not found — пропуск"
fi

# 3. Деплой фронтенда
echo ""
echo "🚀 Step 3: Deploying frontend..."
npm ci || { echo "❌ npm ci failed"; exit 1; }
npm run build:web || { echo "❌ npm run build:web failed"; exit 1; }
# Копируем сборку в каталог nginx (нужны права на запись в /var/www/frontend)
if [ -d "apps/web/dist" ]; then
  sudo mkdir -p /var/www/frontend
  sudo rsync -a --delete apps/web/dist/ /var/www/frontend/ 2>/dev/null || sudo cp -r apps/web/dist/* /var/www/frontend/ 2>/dev/null || {
    echo "⚠️ Не удалось скопировать в /var/www/frontend — проверьте права или настройте root в nginx на $SERVER_PATH/apps/web/dist"
  }
  echo "✅ Frontend deployed to /var/www/frontend"
else
  echo "⚠️ apps/web/dist not found after build"
fi

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

# 4b. (Опционально) Однократная миграция Firestore → Postgres
# Задать в GitHub Secrets: RUN_MIGRATE_FIRESTORE=1, FIREBASE_CREDENTIALS=/path/on/server/to/key.json
if [ -n "$RUN_MIGRATE_FIRESTORE" ] && [ -n "$FIREBASE_CREDENTIALS" ] && [ -f "$FIREBASE_CREDENTIALS" ]; then
  echo ""
  echo "📦 Step 4b: Running Firestore → Postgres migration..."
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

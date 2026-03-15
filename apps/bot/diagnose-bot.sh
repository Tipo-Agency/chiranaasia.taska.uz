#!/bin/bash
# Полная диагностика бота для выявления проблем

echo "=========================================="
echo "🔍 ПОЛНАЯ ДИАГНОСТИКА TELEGRAM БОТА"
echo "=========================================="
echo ""

BOT_DIR="/var/www/tipa.taska.uz/telegram-bot"
SERVICE_NAME="telegram-bot"

# 1. Проверка файлов
echo "1️⃣ ПРОВЕРКА ФАЙЛОВ"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ -f "$BOT_DIR/bot.py" ]; then
    echo "✅ bot.py exists: $BOT_DIR/bot.py"
    VERSION=$(grep -o "CODE_VERSION_AT_START = \"[^\"]*\"" "$BOT_DIR/bot.py" 2>/dev/null | head -1 | cut -d'"' -f2 || echo "NOT FOUND")
    echo "   Version: $VERSION"
    echo "   Size: $(wc -l < "$BOT_DIR/bot.py") lines"
    echo "   Modified: $(stat -c '%y' "$BOT_DIR/bot.py" 2>/dev/null || stat -f '%Sm' "$BOT_DIR/bot.py" 2>/dev/null)"
else
    echo "❌ bot.py NOT FOUND!"
fi

if [ -f "$BOT_DIR/.env" ]; then
    echo "✅ .env exists"
    TOKEN=$(grep "TELEGRAM_BOT_TOKEN" "$BOT_DIR/.env" | cut -d'=' -f2 | tr -d ' ' | tr -d '"' | head -c 20)
    echo "   Token (first 20 chars): $TOKEN..."
else
    echo "❌ .env NOT FOUND!"
fi

if [ -f "$BOT_DIR/firebase-credentials.json" ]; then
    echo "✅ firebase-credentials.json exists"
else
    echo "⚠️ firebase-credentials.json NOT FOUND (may use REST API)"
fi
echo ""

# 2. Проверка процессов
echo "2️⃣ ПРОВЕРКА ПРОЦЕССОВ"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
ALL_PIDS=$(pgrep -f "python.*bot.py" 2>/dev/null || echo "")
if [ -z "$ALL_PIDS" ]; then
    echo "✅ No bot processes running"
else
    echo "⚠️ Found bot processes:"
    for PID in $ALL_PIDS; do
        echo "   PID: $PID"
        ps -p "$PID" -o pid,user,cmd,etime 2>/dev/null || echo "      (process not found)"
    done
    echo ""
    echo "   Total processes: $(echo "$ALL_PIDS" | wc -w)"
    if [ "$(echo "$ALL_PIDS" | wc -w)" -gt 1 ]; then
        echo "   ❌ MULTIPLE PROCESSES DETECTED! This causes 409 Conflict!"
    fi
fi
echo ""

# 3. Проверка systemd
echo "3️⃣ ПРОВЕРКА SYSTEMD"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
    echo "✅ Service is ACTIVE"
    systemctl status "$SERVICE_NAME" --no-pager -l | head -10
else
    echo "❌ Service is NOT ACTIVE"
    systemctl status "$SERVICE_NAME" --no-pager -l | head -10 || true
fi

if [ -f "/etc/systemd/system/$SERVICE_NAME.service" ]; then
    echo ""
    echo "Service file exists. Configuration:"
    echo "   ExecStart: $(grep "ExecStart" /etc/systemd/system/$SERVICE_NAME.service | sed 's/ExecStart=//')"
    echo "   WorkingDirectory: $(grep "WorkingDirectory" /etc/systemd/system/$SERVICE_NAME.service | sed 's/WorkingDirectory=//')"
    echo "   User: $(grep "^User" /etc/systemd/system/$SERVICE_NAME.service | sed 's/User=//')"
else
    echo "❌ Service file NOT FOUND!"
fi
echo ""

# 4. Проверка подключения к Telegram
echo "4️⃣ ПРОВЕРКА ПОДКЛЮЧЕНИЯ К TELEGRAM"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
cd "$BOT_DIR" 2>/dev/null || { echo "❌ Cannot cd to $BOT_DIR"; exit 1; }

if [ -f ".env" ]; then
    BOT_TOKEN=$(grep "TELEGRAM_BOT_TOKEN" .env | cut -d'=' -f2 | tr -d ' ' | tr -d '"')
    
    # Проверка getMe
    echo "Testing getMe..."
    GETME_RESPONSE=$(curl -s "https://api.telegram.org/bot${BOT_TOKEN}/getMe")
    if echo "$GETME_RESPONSE" | grep -q '"ok":true'; then
        echo "✅ getMe: OK"
        BOT_USERNAME=$(echo "$GETME_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['result']['username'])" 2>/dev/null || echo "unknown")
        echo "   Bot username: @$BOT_USERNAME"
    else
        echo "❌ getMe: FAILED"
        echo "$GETME_RESPONSE" | head -5
    fi
    
    # Проверка getUpdates
    echo ""
    echo "Testing getUpdates..."
    GETUPDATES_RESPONSE=$(curl -s "https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?timeout=1")
    if echo "$GETUPDATES_RESPONSE" | grep -q '"ok":true'; then
        echo "✅ getUpdates: OK (no 409 error)"
        UPDATE_COUNT=$(echo "$GETUPDATES_RESPONSE" | python3 -c "import sys, json; print(len(json.load(sys.stdin).get('result', [])))" 2>/dev/null || echo "0")
        echo "   Updates in queue: $UPDATE_COUNT"
    elif echo "$GETUPDATES_RESPONSE" | grep -q "409"; then
        echo "❌ getUpdates: 409 CONFLICT ERROR!"
        echo "   This means multiple bot instances are running!"
        echo "   Response: $(echo "$GETUPDATES_RESPONSE" | head -3)"
    else
        echo "⚠️ getUpdates: Unexpected response"
        echo "$GETUPDATES_RESPONSE" | head -5
    fi
else
    echo "❌ .env file not found, cannot test connection"
fi
echo ""

# 5. Проверка логов
echo "5️⃣ ПРОВЕРКА ЛОГОВ (последние 20 строк)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
sudo journalctl -u "$SERVICE_NAME" -n 20 --no-pager 2>/dev/null | tail -20 || echo "No logs found"
echo ""

# 6. Проверка версии в логах
echo "6️⃣ ПРОВЕРКА ВЕРСИИ В ЛОГАХ"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
VERSION_IN_LOGS=$(sudo journalctl -u "$SERVICE_NAME" --since "10 minutes ago" --no-pager 2>/dev/null | grep -i "code version" | tail -1 || echo "NOT FOUND")
if [ "$VERSION_IN_LOGS" != "NOT FOUND" ]; then
    echo "✅ Version found in logs:"
    echo "   $VERSION_IN_LOGS"
else
    echo "⚠️ Version NOT found in recent logs"
fi
echo ""

# 7. Рекомендации
echo "7️⃣ РЕКОМЕНДАЦИИ"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Проверяем проблемы
HAS_MULTIPLE_PROCESSES=false
HAS_409_ERROR=false
SERVICE_NOT_ACTIVE=false

if [ -n "$ALL_PIDS" ] && [ "$(echo "$ALL_PIDS" | wc -w)" -gt 1 ]; then
    HAS_MULTIPLE_PROCESSES=true
fi

if echo "$GETUPDATES_RESPONSE" | grep -q "409"; then
    HAS_409_ERROR=true
fi

if ! systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
    SERVICE_NOT_ACTIVE=true
fi

if [ "$HAS_MULTIPLE_PROCESSES" = true ] || [ "$HAS_409_ERROR" = true ]; then
    echo "❌ PROBLEM DETECTED: Multiple bot instances"
    echo ""
    echo "SOLUTION:"
    echo "1. Stop all processes:"
    echo "   sudo systemctl stop $SERVICE_NAME"
    echo "   sudo pkill -9 -f 'python.*bot.py'"
    echo ""
    echo "2. Verify all stopped:"
    echo "   ps aux | grep 'python.*bot.py' | grep -v grep"
    echo "   (should be empty)"
    echo ""
    echo "3. Start service:"
    echo "   sudo systemctl start $SERVICE_NAME"
    echo ""
    echo "4. Verify single process:"
    echo "   ps aux | grep 'python.*bot.py' | grep -v grep"
    echo "   (should show exactly 1 process)"
fi

if [ "$SERVICE_NOT_ACTIVE" = true ]; then
    echo "❌ PROBLEM DETECTED: Service is not active"
    echo ""
    echo "SOLUTION:"
    echo "   sudo systemctl start $SERVICE_NAME"
    echo "   sudo systemctl status $SERVICE_NAME"
fi

if [ "$HAS_MULTIPLE_PROCESSES" = false ] && [ "$HAS_409_ERROR" = false ] && [ "$SERVICE_NOT_ACTIVE" = false ]; then
    echo "✅ No obvious problems detected"
    echo ""
    echo "If bot still doesn't respond:"
    echo "1. Check if bot is blocked in Telegram"
    echo "2. Send /start to the bot"
    echo "3. Monitor logs: sudo journalctl -u $SERVICE_NAME -f"
    echo "4. Look for [UPDATE] messages in logs"
fi

echo ""
echo "=========================================="
echo "✅ Диагностика завершена"
echo "=========================================="

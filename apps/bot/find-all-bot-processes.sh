#!/bin/bash
# Скрипт для поиска ВСЕХ процессов, которые могут быть ботом

echo "🔍 ПОИСК ВСЕХ ПРОЦЕССОВ БОТА"
echo "=================================================="
echo ""

# Получаем токен из .env файла или переменной окружения
BOT_DIR="/var/www/tipa.taska.uz/telegram-bot"
if [ -f "$BOT_DIR/.env" ]; then
    BOT_TOKEN=$(grep "TELEGRAM_BOT_TOKEN" "$BOT_DIR/.env" | cut -d'=' -f2 | tr -d ' ' | tr -d '"' | head -1 || echo "")
fi

if [ -z "$BOT_TOKEN" ]; then
    BOT_TOKEN="$TELEGRAM_BOT_TOKEN"
fi

if [ -z "$BOT_TOKEN" ]; then
    echo "❌ Error: TELEGRAM_BOT_TOKEN not found"
    exit 1
fi

# 1. Процессы с bot.py
echo "1️⃣ Процессы с 'bot.py' в команде:"
ps aux | grep "bot.py" | grep -v grep || echo "   (не найдено)"
echo ""

# 2. Все процессы Python
echo "2️⃣ Все процессы Python:"
ps aux | grep python | grep -v grep | grep -v "grep python" | head -20 || echo "   (не найдено)"
echo ""

# 3. Процессы по PID из systemd
echo "3️⃣ Процесс из systemd сервиса:"
MAIN_PID=$(systemctl show telegram-bot --property=MainPID --value 2>/dev/null || echo "")
if [ -n "$MAIN_PID" ] && [ "$MAIN_PID" != "0" ]; then
    echo "   MainPID: $MAIN_PID"
    ps -p "$MAIN_PID" -o pid,user,cmd 2>/dev/null || echo "   (процесс не найден)"
else
    echo "   (MainPID не установлен)"
fi
echo ""

# 4. Проверка через lsof (если доступен)
echo "4️⃣ Процессы, использующие bot.py (через lsof):"
if command -v lsof &> /dev/null; then
    lsof 2>/dev/null | grep "bot.py" || echo "   (не найдено)"
else
    echo "   (lsof не установлен)"
fi
echo ""

# 5. Проверка через netstat (активные соединения к api.telegram.org)
echo "5️⃣ Активные соединения к api.telegram.org:"
if command -v netstat &> /dev/null; then
    netstat -anp 2>/dev/null | grep "api.telegram.org" || echo "   (нет активных соединений)"
elif command -v ss &> /dev/null; then
    ss -anp 2>/dev/null | grep "api.telegram.org" || echo "   (нет активных соединений)"
else
    echo "   (netstat/ss не установлены)"
fi
echo ""

# 6. Проверка через getUpdates (может показать, есть ли другой бот)
echo "6️⃣ Проверка через Telegram API (getUpdates):"
GETUPDATES_RESPONSE=$(curl -s "https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?timeout=1" 2>/dev/null || echo "")
if echo "$GETUPDATES_RESPONSE" | grep -q "409"; then
    echo "   ❌ 409 CONFLICT - есть другой экземпляр бота!"
    echo "   Response: $(echo "$GETUPDATES_RESPONSE" | head -3)"
elif echo "$GETUPDATES_RESPONSE" | grep -q '"ok":true'; then
    echo "   ✅ getUpdates работает (нет конфликта)"
else
    echo "   ⚠️ Неожиданный ответ: $(echo "$GETUPDATES_RESPONSE" | head -3)"
fi
echo ""

# 7. Проверка systemd сервисов
echo "7️⃣ Все systemd сервисы с 'bot' в имени:"
systemctl list-units --type=service --all | grep -i bot || echo "   (не найдено)"
echo ""

# 8. Проверка cron jobs
echo "8️⃣ Cron jobs (для текущего пользователя и root):"
(crontab -l 2>/dev/null | grep -i bot || echo "   (нет cron jobs для текущего пользователя)")
(sudo crontab -l 2>/dev/null | grep -i bot || echo "   (нет cron jobs для root)")
echo ""

# 9. Проверка процессов через /proc
echo "9️⃣ Процессы через /proc (более детально):"
for PID in /proc/[0-9]*; do
    if [ -f "$PID/cmdline" ]; then
        CMDLINE=$(cat "$PID/cmdline" 2>/dev/null | tr '\0' ' ' || echo "")
        if echo "$CMDLINE" | grep -q "bot.py"; then
            PID_NUM=$(basename "$PID")
            echo "   PID: $PID_NUM"
            echo "   CMD: $CMDLINE"
            if [ -f "$PID/environ" ]; then
                echo "   ENV: $(cat "$PID/environ" 2>/dev/null | tr '\0' '\n' | grep -E "(USER|HOME|PWD)" | head -3 || echo "")"
            fi
            echo ""
        fi
    fi
done

echo "=================================================="
echo "✅ Поиск завершен"

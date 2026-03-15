#!/bin/bash
# Агрессивный скрипт для принудительного исправления проблемы Conflict

set -e

BOT_DIR="/var/www/tipa.taska.uz/telegram-bot"
SERVICE_NAME="telegram-bot"

# Получаем токен из .env файла
if [ -f "$BOT_DIR/.env" ]; then
    BOT_TOKEN=$(grep "TELEGRAM_BOT_TOKEN" "$BOT_DIR/.env" | cut -d'=' -f2 | tr -d ' ' | tr -d '"' | head -1 || echo "")
fi

# Если токен не найден в .env, пробуем из переменной окружения
if [ -z "$BOT_TOKEN" ]; then
    BOT_TOKEN="$TELEGRAM_BOT_TOKEN"
fi

# Если токен все еще не найден - ошибка
if [ -z "$BOT_TOKEN" ]; then
    echo "❌ Error: TELEGRAM_BOT_TOKEN not found in .env file or environment variable"
    echo "   Please set TELEGRAM_BOT_TOKEN in $BOT_DIR/.env"
    exit 1
fi

echo "🔧 ПРИНУДИТЕЛЬНОЕ ИСПРАВЛЕНИЕ ПРОБЛЕМЫ CONFLICT"
echo "=================================================="
echo ""
echo "⚠️  ВНИМАНИЕ: Этот скрипт остановит ВСЕ процессы Python с bot.py"
echo ""

read -p "Продолжить? (y/n): " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Отменено"
    exit 0
fi

cd "$BOT_DIR" || exit 1

# 1. Остановка сервиса
echo "1️⃣ Остановка systemd сервиса..."
sudo systemctl stop "$SERVICE_NAME" 2>/dev/null || true
sleep 3

# 2. Убиваем ВСЕ процессы с bot.py
echo ""
echo "2️⃣ Поиск и остановка всех процессов с bot.py..."
ALL_PIDS=$(pgrep -f "bot.py" 2>/dev/null || echo "")
if [ -n "$ALL_PIDS" ]; then
    echo "   Найдено процессов: $(echo "$ALL_PIDS" | wc -w)"
    for PID in $ALL_PIDS; do
        CMD=$(ps -p "$PID" -o cmd= 2>/dev/null || echo "")
        echo "   Убиваем PID $PID: $CMD"
        sudo kill -9 "$PID" 2>/dev/null || true
    done
    sleep 5
else
    echo "   ✅ Процессы не найдены"
fi

# 3. Остановка tipa.uz.backend (может вызывать конфликт)
echo ""
echo "3️⃣ Проверка и остановка tipa.uz.backend..."
TIPA_BACKEND_PIDS=$(ps aux | grep "tipa.uz.backend" | grep -v grep | awk '{print $2}' || echo "")
if [ -n "$TIPA_BACKEND_PIDS" ]; then
    echo "   ⚠️ Найдены процессы tipa.uz.backend: $TIPA_BACKEND_PIDS"
    echo "   Останавливаем их (бэкенд больше не используется)..."
    for PID in $TIPA_BACKEND_PIDS; do
        CMD=$(ps -p "$PID" -o cmd= 2>/dev/null || echo "")
        echo "   Убиваем PID $PID: $CMD"
        sudo kill -9 "$PID" 2>/dev/null || true
    done
    sleep 2
else
    echo "   ✅ Процессы tipa.uz.backend не найдены"
fi

# 4. Дополнительная проверка через /proc
echo ""
echo "4️⃣ Дополнительная проверка через /proc..."
for PID_DIR in /proc/[0-9]*; do
    if [ -f "$PID_DIR/cmdline" ]; then
        PID=$(basename "$PID_DIR")
        CMDLINE=$(cat "$PID_DIR/cmdline" 2>/dev/null | tr '\0' ' ' || echo "")
        if echo "$CMDLINE" | grep -q "bot.py"; then
            echo "   Найден процесс через /proc: PID $PID"
            echo "   CMD: $CMDLINE"
            sudo kill -9 "$PID" 2>/dev/null || true
        fi
    fi
done
sleep 3

# 5. Финальная проверка
echo ""
echo "5️⃣ Финальная проверка процессов..."
REMAINING=$(pgrep -f "bot.py" 2>/dev/null || echo "")
if [ -n "$REMAINING" ]; then
    echo "   ⚠️ Остались процессы: $REMAINING"
    for PID in $REMAINING; do
        sudo kill -9 "$PID" 2>/dev/null || true
    done
    sleep 2
else
    echo "   ✅ Все процессы остановлены"
fi

# 6. Очистка кэша Python
echo ""
echo "6️⃣ Очистка кэша Python..."
find . -type d -name "__pycache__" -exec sudo rm -rf {} + 2>/dev/null || true
find . -type f -name "*.pyc" -delete 2>/dev/null || true
find . -type f -name "*.pyo" -delete 2>/dev/null || true
if [ -d "venv" ]; then
    find venv -type d -name "__pycache__" -exec sudo rm -rf {} + 2>/dev/null || true
    find venv -type f -name "*.pyc" -delete 2>/dev/null || true
fi
echo "   ✅ Кэш очищен"

# 7. Очистка очереди Telegram (КРИТИЧЕСКИ ВАЖНО!)
echo ""
echo "7️⃣ Очистка очереди обновлений Telegram..."
echo "   Это критически важно для устранения Conflict ошибки!"
for i in {1..3}; do
    echo "   Попытка $i/3..."
    CLEAR_RESPONSE=$(curl -s -X POST "https://api.telegram.org/bot${BOT_TOKEN}/getUpdates?offset=-1&timeout=1" 2>/dev/null || echo "")
    if echo "$CLEAR_RESPONSE" | grep -q '"ok":true'; then
        echo "   ✅ Очередь очищена (попытка $i)"
        break
    else
        echo "   ⚠️ Попытка $i не удалась, повторяем..."
        sleep 2
    fi
done
sleep 3

# 8. Запуск бота
echo ""
echo "8️⃣ Запуск бота..."
sudo systemctl start "$SERVICE_NAME"
sleep 10  # Даем больше времени на инициализацию

# 9. Проверка
echo ""
echo "9️⃣ Проверка после запуска..."
RUNNING_COUNT=$(ps aux | grep "python.*bot.py" | grep -v grep | wc -l || echo "0")
if [ "$RUNNING_COUNT" -eq 1 ]; then
    echo "   ✅ Запущен один процесс (правильно)"
else
    echo "   ❌ Проблема: запущено $RUNNING_COUNT процессов"
fi

# 10. Проверка логов
echo ""
echo "🔟 Проверка логов (последние 20 строк)..."
sleep 3
sudo journalctl -u "$SERVICE_NAME" -n 20 --no-pager | tail -10

# 11. Проверка на ошибки Conflict
echo ""
echo "1️⃣1️⃣ Проверка на ошибки Conflict в логах..."
CONFLICT_COUNT=$(sudo journalctl -u "$SERVICE_NAME" -n 50 --no-pager 2>/dev/null | grep -i "conflict" | wc -l || echo "0")
if [ "$CONFLICT_COUNT" -eq 0 ]; then
    echo "   ✅ Ошибок Conflict нет!"
    echo ""
    echo "   🎉 ПРОБЛЕМА РЕШЕНА!"
    echo ""
    echo "   📋 Следующие шаги:"
    echo "   1. Отправьте /start боту в Telegram"
    echo "   2. Следите за логами: sudo journalctl -u $SERVICE_NAME -f"
    echo "   3. В логах должны появиться сообщения [UPDATE] при отправке /start"
else
    echo "   ⚠️ Найдено ошибок Conflict: $CONFLICT_COUNT"
    echo ""
    echo "   💡 ПРОБЛЕМА ВСЕ ЕЩЕ ЕСТЬ!"
    echo ""
    echo "   🔍 ВОЗМОЖНЫЕ ПРИЧИНЫ:"
    echo "   1. Бот запущен на другом сервере/компьютере с тем же токеном"
    echo "   2. Бот запущен локально на вашем компьютере"
    echo ""
    echo "   💡 РЕШЕНИЯ:"
    echo "   1. Проверьте другие серверы/компьютеры:"
    echo "      - На вашем локальном компьютере: ps aux | grep bot.py"
    echo "      - На других серверах с этим проектом"
    echo "   2. Если нашли другой экземпляр - остановите его"
    echo "   3. Если не нашли - создайте новый токен в BotFather"
    echo ""
    echo "   📋 Для проверки локально выполните:"
    echo "      ps aux | grep bot.py"
fi

echo ""
echo "=================================================="
echo "✅ Скрипт завершен"

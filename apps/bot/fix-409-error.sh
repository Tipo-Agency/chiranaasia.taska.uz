#!/bin/bash
# Скрипт для быстрого исправления ошибки 409 Conflict

echo "🔧 Исправление ошибки 409 Conflict..."
echo ""

BOT_DIR="/var/www/tipa.taska.uz/telegram-bot"
SERVICE_NAME="telegram-bot"

# 1. Остановка всех процессов
echo "1️⃣ Остановка всех процессов бота..."
sudo systemctl stop "$SERVICE_NAME" 2>/dev/null || true
sleep 2

# Убиваем все процессы
ALL_PIDS=$(pgrep -f "python.*bot.py" 2>/dev/null || echo "")
if [ -n "$ALL_PIDS" ]; then
    echo "   Найдено процессов: $(echo "$ALL_PIDS" | wc -w)"
    for PID in $ALL_PIDS; do
        echo "   Убиваем PID: $PID"
        sudo kill -9 "$PID" 2>/dev/null || true
    done
    sleep 3
else
    echo "   Процессы не найдены"
fi

# Финальная проверка
REMAINING=$(pgrep -f "python.*bot.py" 2>/dev/null || echo "")
if [ -n "$REMAINING" ]; then
    echo "   ⚠️ Остались процессы, принудительно убиваем..."
    for PID in $REMAINING; do
        sudo kill -9 "$PID" 2>/dev/null || true
    done
    sleep 2
fi

# 2. Очистка кэша
echo ""
echo "2️⃣ Очистка кэша Python..."
cd "$BOT_DIR" || exit 1
find . -type d -name "__pycache__" -exec sudo rm -rf {} + 2>/dev/null || true
find . -type f -name "*.pyc" -delete 2>/dev/null || true
find . -type f -name "*.pyo" -delete 2>/dev/null || true
if [ -d "venv" ]; then
    find venv -type d -name "__pycache__" -exec sudo rm -rf {} + 2>/dev/null || true
    find venv -type f -name "*.pyc" -delete 2>/dev/null || true
fi
echo "   ✅ Кэш очищен"

# 3. Запуск бота
echo ""
echo "3️⃣ Запуск бота..."
sudo systemctl start "$SERVICE_NAME"
sleep 5

# 4. Проверка
echo ""
echo "4️⃣ Проверка..."
RUNNING=$(pgrep -f "python.*bot.py" 2>/dev/null | wc -l || echo "0")
if [ "$RUNNING" -eq 1 ]; then
    echo "   ✅ Запущен один процесс (правильно)"
elif [ "$RUNNING" -gt 1 ]; then
    echo "   ❌ Запущено несколько процессов ($RUNNING)!"
    echo "   Это вызовет ошибку 409!"
    ps aux | grep "python.*bot.py" | grep -v grep
else
    echo "   ⚠️ Процессы не найдены"
fi

# 5. Проверка подключения
echo ""
echo "5️⃣ Проверка подключения к Telegram..."
if [ -f "$BOT_DIR/test-bot-connection.sh" ]; then
    cd "$BOT_DIR"
    ./test-bot-connection.sh | tail -10
else
    echo "   ⚠️ test-bot-connection.sh не найден"
fi

echo ""
echo "✅ Готово! Проверьте логи: sudo journalctl -u telegram-bot -f"

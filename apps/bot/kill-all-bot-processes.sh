#!/bin/bash
# Скрипт для остановки всех процессов бота

echo "🔍 Searching for all bot processes..."

# Находим все процессы Python с bot.py
PIDS=$(pgrep -f "python.*bot.py" || echo "")

if [ -z "$PIDS" ]; then
    echo "✅ No bot processes found"
else
    echo "📋 Found bot processes:"
    ps aux | grep "python.*bot.py" | grep -v grep
    
    echo ""
    echo "🛑 Stopping all bot processes..."
    for PID in $PIDS; do
        echo "   Killing PID: $PID"
        kill -9 "$PID" 2>/dev/null || true
    done
    sleep 2
    
    # Проверяем еще раз
    REMAINING=$(pgrep -f "python.*bot.py" || echo "")
    if [ -z "$REMAINING" ]; then
        echo "✅ All bot processes stopped"
    else
        echo "⚠️ Some processes still running: $REMAINING"
        for PID in $REMAINING; do
            kill -9 "$PID" 2>/dev/null || true
        done
    fi
fi

# Останавливаем systemd сервис
echo ""
echo "🛑 Stopping systemd service..."
sudo systemctl stop telegram-bot 2>/dev/null || true
sleep 2

# Проверяем финальное состояние
echo ""
echo "🔍 Final check:"
FINAL_PIDS=$(pgrep -f "python.*bot.py" || echo "")
if [ -z "$FINAL_PIDS" ]; then
    echo "✅ No bot processes running"
else
    echo "⚠️ Still running: $FINAL_PIDS"
    ps aux | grep "python.*bot.py" | grep -v grep
fi

echo ""
echo "✅ Done! Now you can start the bot with: sudo systemctl start telegram-bot"

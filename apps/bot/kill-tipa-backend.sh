#!/bin/bash
# Скрипт для остановки tipa.uz.backend (может вызывать конфликт с ботом)

echo "🛑 Остановка tipa.uz.backend"
echo "=================================================="
echo ""

# Поиск процессов
TIPA_PIDS=$(ps aux | grep "tipa.uz.backend" | grep -v grep | awk '{print $2}' || echo "")

if [ -z "$TIPA_PIDS" ]; then
    echo "✅ Процессы tipa.uz.backend не найдены"
    exit 0
fi

echo "Найдены процессы tipa.uz.backend:"
ps aux | grep "tipa.uz.backend" | grep -v grep

echo ""
read -p "Остановить эти процессы? (y/n): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Отменено"
    exit 0
fi

# Останавливаем процессы
for PID in $TIPA_PIDS; do
    CMD=$(ps -p "$PID" -o cmd= 2>/dev/null || echo "")
    echo "Останавливаем PID $PID: $CMD"
    sudo kill -9 "$PID" 2>/dev/null || true
done

sleep 2

# Проверка
REMAINING=$(ps aux | grep "tipa.uz.backend" | grep -v grep || echo "")
if [ -z "$REMAINING" ]; then
    echo ""
    echo "✅ Все процессы tipa.uz.backend остановлены"
else
    echo ""
    echo "⚠️ Остались процессы:"
    echo "$REMAINING"
fi

echo ""
echo "=================================================="
echo "✅ Готово"

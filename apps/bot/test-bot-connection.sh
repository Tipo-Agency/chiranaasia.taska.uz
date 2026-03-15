#!/bin/bash
# Скрипт для проверки подключения бота к Telegram API

# Читаем токен из .env файла или переменной окружения
if [ -f ".env" ]; then
    BOT_TOKEN=$(grep "TELEGRAM_BOT_TOKEN" .env | cut -d '=' -f2 | tr -d ' ' | tr -d '"')
elif [ -n "$TELEGRAM_BOT_TOKEN" ]; then
    BOT_TOKEN="$TELEGRAM_BOT_TOKEN"
else
    echo "❌ Error: TELEGRAM_BOT_TOKEN not found in .env file or environment variable"
    exit 1
fi

echo "🔍 Testing bot connection..."
echo ""

# Проверка getMe
echo "1. Testing getMe..."
curl -s "https://api.telegram.org/bot${BOT_TOKEN}/getMe" | python3 -m json.tool
echo ""

# Проверка getUpdates
echo "2. Testing getUpdates..."
RESPONSE=$(curl -s "https://api.telegram.org/bot${BOT_TOKEN}/getUpdates")
echo "$RESPONSE" | python3 -m json.tool
echo ""

# Проверка количества обновлений
UPDATE_COUNT=$(echo "$RESPONSE" | python3 -c "import sys, json; data = json.load(sys.stdin); print(len(data.get('result', [])))")
echo "📊 Updates in queue: $UPDATE_COUNT"
echo ""

if [ "$UPDATE_COUNT" -gt 0 ]; then
    echo "✅ Bot is receiving updates!"
else
    echo "⚠️ No updates in queue. Try sending /start to the bot in Telegram."
fi

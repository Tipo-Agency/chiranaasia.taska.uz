#!/bin/bash
# Скрипт для проверки логов Telegram бота

echo "📋 Последние 50 строк логов:"
echo "================================"
sudo journalctl -u telegram-bot -n 50 --no-pager

echo ""
echo "📋 Логи с ошибками:"
echo "================================"
sudo journalctl -u telegram-bot -n 100 --no-pager | grep -i "error\|exception\|traceback\|failed" || echo "Ошибок не найдено"

echo ""
echo "💡 Для просмотра логов в реальном времени используйте:"
echo "   sudo journalctl -u telegram-bot -f"

#!/bin/bash
# Скрипт для исправления проблемы с Git ownership
# Выполнить один раз на сервере: sudo ./fix-git-ownership.sh

REPO_PATH="${1:-/var/www/taska}"

echo "🔧 Fixing Git ownership issue..."

if [ -d "$REPO_PATH" ]; then
    # Добавляем директорию в safe.directory для всех пользователей
    git config --global --add safe.directory "$REPO_PATH" || true
    
    # Также для root пользователя
    sudo git config --global --add safe.directory "$REPO_PATH" || true
    
    echo "✅ Git safe.directory configured for: $REPO_PATH"
    echo "📋 Current safe.directory settings:"
    git config --global --get-all safe.directory || echo "   (none)"
else
    echo "❌ Directory not found: $REPO_PATH"
    echo "Usage: ./fix-git-ownership.sh [path_to_repo]"
    exit 1
fi

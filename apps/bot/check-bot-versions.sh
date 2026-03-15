#!/bin/bash
# Скрипт для проверки всех версий bot.py на сервере

echo "🔍 Searching for all bot.py files on the server..."
echo ""

# Ищем все файлы bot.py
find /var/www -name "bot.py" -type f 2>/dev/null | while read -r file; do
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "📄 File: $file"
    
    # Проверяем версию в файле
    VERSION=$(grep -o "CODE_VERSION_AT_START = \"[^\"]*\"" "$file" 2>/dev/null | head -1 | cut -d'"' -f2 || echo "NOT FOUND")
    echo "   📋 Version: $VERSION"
    
    # Информация о файле
    if [ -f "$file" ]; then
        echo "   📊 Size: $(wc -l < "$file") lines"
        echo "   🕐 Modified: $(stat -c '%y' "$file" 2>/dev/null || stat -f '%Sm' "$file" 2>/dev/null || echo "unknown")"
        echo "   👤 Owner: $(stat -c '%U:%G' "$file" 2>/dev/null || stat -f '%Su:%Sg' "$file" 2>/dev/null || echo "unknown")"
        echo "   🔗 Inode: $(stat -c '%i' "$file" 2>/dev/null || stat -f '%i' "$file" 2>/dev/null || echo "unknown")"
    fi
    echo ""
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🔍 Checking systemd service configuration..."
echo ""

# Проверяем, какой файл запускает systemd
if [ -f "/etc/systemd/system/telegram-bot.service" ]; then
    echo "📄 Systemd service file: /etc/systemd/system/telegram-bot.service"
    echo ""
    echo "Service configuration:"
    cat /etc/systemd/system/telegram-bot.service | grep -E "ExecStart|WorkingDirectory" || echo "   (not found)"
    echo ""
    
    # Извлекаем путь к bot.py из ExecStart
    EXEC_START=$(grep "ExecStart" /etc/systemd/system/telegram-bot.service | sed 's/ExecStart=//' | awk '{print $NF}')
    WORKING_DIR=$(grep "WorkingDirectory" /etc/systemd/system/telegram-bot.service | sed 's/WorkingDirectory=//')
    
    echo "   WorkingDirectory: $WORKING_DIR"
    echo "   ExecStart (last arg): $EXEC_START"
    
    # Проверяем реальный путь
    if [ -n "$WORKING_DIR" ] && [ -n "$EXEC_START" ]; then
        REAL_PATH="$WORKING_DIR/$EXEC_START"
        if [ -f "$REAL_PATH" ]; then
            echo ""
            echo "   ✅ File exists: $REAL_PATH"
            REAL_VERSION=$(grep -o "CODE_VERSION_AT_START = \"[^\"]*\"" "$REAL_PATH" 2>/dev/null | head -1 | cut -d'"' -f2 || echo "NOT FOUND")
            echo "   📋 Version in this file: $REAL_VERSION"
        else
            echo ""
            echo "   ❌ File NOT found: $REAL_PATH"
        fi
    fi
else
    echo "❌ Systemd service file not found!"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🔍 Checking running process..."
echo ""

# Проверяем, какой файл реально запущен
RUNNING_PID=$(pgrep -f "python.*bot.py" | head -1)
if [ -n "$RUNNING_PID" ]; then
    echo "   Process PID: $RUNNING_PID"
    RUNNING_CMD=$(ps -p "$RUNNING_PID" -o cmd= 2>/dev/null || echo "unknown")
    echo "   Command: $RUNNING_CMD"
    
    # Извлекаем путь к файлу из команды
    RUNNING_FILE=$(echo "$RUNNING_CMD" | awk '{for(i=1;i<=NF;i++) if($i ~ /bot\.py$/) print $i}')
    if [ -n "$RUNNING_FILE" ] && [ -f "$RUNNING_FILE" ]; then
        echo "   📄 Running file: $RUNNING_FILE"
        RUNNING_VERSION=$(grep -o "CODE_VERSION_AT_START = \"[^\"]*\"" "$RUNNING_FILE" 2>/dev/null | head -1 | cut -d'"' -f2 || echo "NOT FOUND")
        echo "   📋 Version in running file: $RUNNING_VERSION"
        echo "   🔗 Inode: $(stat -c '%i' "$RUNNING_FILE" 2>/dev/null || stat -f '%i' "$RUNNING_FILE" 2>/dev/null || echo "unknown")"
    fi
else
    echo "   ⚠️ No running bot process found"
fi

echo ""
echo "✅ Check completed!"

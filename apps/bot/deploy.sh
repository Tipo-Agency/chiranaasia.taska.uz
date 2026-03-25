#!/bin/bash
# Скрипт для деплоя Telegram бота
# Использование: sudo ./deploy.sh
# Примечание: Код уже обновлен через git в основном workflow, этот скрипт только устанавливает зависимости и перезапускает сервис

# Не завершаем при ошибках в некоторых местах (чтобы не блокировать деплой фронтенда)
set +e

BOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_DIR="$BOT_DIR/venv"
SERVICE_NAME="telegram-bot"

echo "🚀 Starting Telegram bot deployment..."
echo "📁 Bot directory: $BOT_DIR"

# Проверяем наличие Python
set -e
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed"
    exit 1
fi
set +e

# Создаем виртуальное окружение если его нет
if [ ! -d "$VENV_DIR" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv "$VENV_DIR"
fi

# Активируем виртуальное окружение
echo "🔧 Activating virtual environment..."
source "$VENV_DIR/bin/activate"

# Обновляем pip
echo "⬆️ Upgrading pip..."
pip install --upgrade pip

# Очищаем кэш Python (на случай если старые .pyc файлы мешают)
echo "🧹 Cleaning Python cache..."
find "$BOT_DIR" -type d -name "__pycache__" -exec rm -r {} + 2>/dev/null || true
find "$BOT_DIR" -type f -name "*.pyc" -delete 2>/dev/null || true
find "$BOT_DIR" -type f -name "*.pyo" -delete 2>/dev/null || true

# Устанавливаем зависимости
echo "📥 Installing dependencies..."
pip install -r "$BOT_DIR/requirements.txt"

# Проверяем наличие .env файла
if [ ! -f "$BOT_DIR/.env" ]; then
    echo "⚠️ Warning: .env file not found. Creating from .env.example..."
    if [ -f "$BOT_DIR/.env.example" ]; then
        cp "$BOT_DIR/.env.example" "$BOT_DIR/.env"
        echo "⚠️ Please update .env file with your configuration!"
    else
        echo "❌ .env.example not found. Please create .env manually."
        exit 1
    fi
fi

# Проверяем, что токен установлен в .env
if ! grep -q "TELEGRAM_BOT_TOKEN=" "$BOT_DIR/.env" || grep -q "TELEGRAM_BOT_TOKEN=$" "$BOT_DIR/.env" || grep -q "^TELEGRAM_BOT_TOKEN=\s*$" "$BOT_DIR/.env"; then
    echo "❌ Error: TELEGRAM_BOT_TOKEN not set in .env file!"
    echo "   Please set TELEGRAM_BOT_TOKEN in .env file or pass it via environment variable."
    exit 1
fi

# Останавливаем все экземпляры бота (важно для избежания ошибки 409 Conflict)
echo "🛑 Stopping all bot instances..."

# 1. Останавливаем systemd сервис
if systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
    echo "   Stopping systemd service..."
    sudo systemctl stop "$SERVICE_NAME" || true
    sleep 3
fi

# 2. Останавливаем процессы бота (bot.py shim, main.py, -m taska_bot)
_bot_pgrep() {
  (pgrep -f "python.*bot.py" 2>/dev/null; pgrep -f "python.*main.py" 2>/dev/null; pgrep -f "python.*-m taska_bot" 2>/dev/null) | sort -u
}
BOT_PIDS=$(_bot_pgrep)
if [ -n "$BOT_PIDS" ]; then
    echo "   Found running bot processes: $BOT_PIDS"
    echo "   Killing all bot processes..."
    for PID in $BOT_PIDS; do
        echo "      Killing PID: $PID"
        kill -9 "$PID" 2>/dev/null || true
    done
    sleep 2
else
    echo "   No running bot processes found"
fi

# 3. Проверяем, что все остановлено
REMAINING_PIDS=$(_bot_pgrep)
if [ -n "$REMAINING_PIDS" ]; then
    echo "   ⚠️ Some processes still running, force killing: $REMAINING_PIDS"
    for PID in $REMAINING_PIDS; do
        kill -9 "$PID" 2>/dev/null || true
    done
    sleep 2
fi

# 4. Финальная проверка
FINAL_CHECK=$(_bot_pgrep)
if [ -z "$FINAL_CHECK" ]; then
    echo "   ✅ All bot processes stopped successfully"
else
    echo "   ⚠️ Warning: Some processes may still be running: $FINAL_CHECK"
    ps aux | grep "python.*bot.py" | grep -v grep || true
fi

sleep 2  # Даем время системе полностью освободить ресурсы

# АГРЕССИВНАЯ очистка кэша Python (включая venv)
echo "🧹 Cleaning Python cache (aggressive mode)..."
# Очищаем кэш в директории бота
find "$BOT_DIR" -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
find "$BOT_DIR" -type f -name "*.pyc" -delete 2>/dev/null || true
find "$BOT_DIR" -type f -name "*.pyo" -delete 2>/dev/null || true
find "$BOT_DIR" -type f -name "*.pyc" -delete 2>/dev/null || true

# Очищаем кэш в виртуальном окружении (если оно существует)
if [ -d "$VENV_DIR" ]; then
    echo "🧹 Cleaning venv cache..."
    find "$VENV_DIR" -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
    find "$VENV_DIR" -type f -name "*.pyc" -delete 2>/dev/null || true
    find "$VENV_DIR" -type f -name "*.pyo" -delete 2>/dev/null || true
fi

# Очищаем кэш pip
echo "🧹 Cleaning pip cache..."
pip cache purge 2>/dev/null || true

# Проверяем версию кода в файле
echo "🔍 Checking bot code version in bot.py..."
if [ -f "$BOT_DIR/bot.py" ]; then
    CODE_VERSION_IN_FILE=$(grep -o "CODE_VERSION_AT_START = \"[^\"]*\"" "$BOT_DIR/bot.py" 2>/dev/null | head -1 | cut -d'"' -f2 || echo "NOT FOUND")
    echo "📋 Code version in bot.py: $CODE_VERSION_IN_FILE"
else
    echo "❌ bot.py file not found!"
fi

# Определяем пользователя для сервиса
# Приоритет:
# 1. DEPLOY_USER (передается из GitHub Actions)
# 2. SUDO_USER (если запущено через sudo)
# 3. Владелец директории проекта
# 4. Текущий пользователь
SERVICE_USER=""
if [ -n "$DEPLOY_USER" ]; then
    SERVICE_USER="$DEPLOY_USER"
    echo "📋 Using DEPLOY_USER: $SERVICE_USER"
elif [ -n "$SUDO_USER" ] && [ "$SUDO_USER" != "root" ]; then
    SERVICE_USER="$SUDO_USER"
    echo "📋 Using SUDO_USER: $SERVICE_USER"
else
    # Пытаемся определить владельца директории проекта
    if command -v stat >/dev/null 2>&1; then
        if stat -c '%U' "$BOT_DIR/.." >/dev/null 2>&1; then
            SERVICE_USER=$(stat -c '%U' "$BOT_DIR/..")
        elif stat -f '%Su' "$BOT_DIR/.." >/dev/null 2>&1; then
            SERVICE_USER=$(stat -f '%Su' "$BOT_DIR/..")
        fi
    fi
    
    if [ -z "$SERVICE_USER" ] || [ "$SERVICE_USER" = "root" ]; then
        # Последняя попытка - текущий пользователь (если не root)
        if [ "$USER" != "root" ]; then
            SERVICE_USER="$USER"
        else
            SERVICE_USER="www-data"
        fi
    fi
    echo "📋 Detected service user: $SERVICE_USER"
fi

# Убеждаемся, что пользователь существует
if ! id "$SERVICE_USER" >/dev/null 2>&1; then
    echo "⚠️ Warning: User $SERVICE_USER does not exist, using www-data"
    SERVICE_USER="www-data"
fi

echo "✅ Service will run as user: $SERVICE_USER"

# Создаем systemd service файл
echo "📝 Creating/updating systemd service..."
sudo tee "/etc/systemd/system/$SERVICE_NAME.service" > /dev/null <<EOF
[Unit]
Description=Telegram Bot for Task Management System
After=network.target

[Service]
Type=simple
User=$SERVICE_USER
WorkingDirectory=$BOT_DIR
Environment="PATH=$VENV_DIR/bin:/usr/local/bin:/usr/bin:/bin"
# ВАЖНО: Загружаем переменные окружения из .env файла
EnvironmentFile=$BOT_DIR/.env
ExecStart=$VENV_DIR/bin/python $BOT_DIR/bot.py
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# Перезагружаем systemd
echo "🔄 Reloading systemd..."
sudo systemctl daemon-reload

# Включаем сервис
echo "✅ Enabling service..."
sudo systemctl enable "$SERVICE_NAME"

# Запускаем сервис
echo "🚀 Starting service..."
sudo systemctl start "$SERVICE_NAME"

# Проверяем, что запустился только один процесс (важно для избежания ошибки 409)
sleep 3
RUNNING_PROCESSES=$(_bot_pgrep | wc -l | tr -d ' ')
RUNNING_PROCESSES=${RUNNING_PROCESSES:-0}
if [ "${RUNNING_PROCESSES:-0}" -gt 1 ]; then
    echo "   ⚠️ Warning: Multiple bot processes detected ($RUNNING_PROCESSES)"
    echo "   This may cause 409 Conflict errors! Killing duplicates..."
    ALL_PIDS=$(_bot_pgrep)
    FIRST_PID=$(echo "$ALL_PIDS" | head -1)
    for PID in $ALL_PIDS; do
        if [ "$PID" != "$FIRST_PID" ]; then
            echo "      Killing duplicate PID: $PID"
            kill -9 "$PID" 2>/dev/null || true
        fi
    done
    sleep 2
elif [ "$RUNNING_PROCESSES" -eq 1 ]; then
    echo "   ✅ Single bot process running (correct)"
else
    echo "   ⚠️ Warning: No bot processes found"
fi

# Проверяем статус
sleep 2  # Дополнительная задержка для инициализации
if systemctl is-active --quiet "$SERVICE_NAME"; then
    echo "✅ Telegram bot deployed and running successfully!"
    echo "📊 Service status:"
    sudo systemctl status "$SERVICE_NAME" --no-pager -l | head -15 || true
    echo ""
    echo "📝 Recent logs (last 15 lines):"
    sudo journalctl -u "$SERVICE_NAME" -n 15 --no-pager || true
    echo ""
    echo "🔍 Checking for code version in logs:"
    sudo journalctl -u "$SERVICE_NAME" -n 50 --no-pager | grep -i "code version" || echo "⚠️ Code version not found in logs"
    echo ""
    echo "🔍 Verifying bot.py file path and version:"
    if [ -f "$BOT_DIR/bot.py" ]; then
        ACTUAL_VERSION=$(grep -o "CODE_VERSION_AT_START = \"[^\"]*\"" "$BOT_DIR/bot.py" 2>/dev/null | head -1 | cut -d'"' -f2 || echo "NOT FOUND")
        echo "   📄 File: $BOT_DIR/bot.py"
        echo "   📋 Version in file: $ACTUAL_VERSION"
        echo "   📊 File size: $(wc -l < "$BOT_DIR/bot.py") lines"
        echo "   🕐 Last modified: $(stat -c '%y' "$BOT_DIR/bot.py" 2>/dev/null || stat -f '%Sm' "$BOT_DIR/bot.py" 2>/dev/null || echo "unknown")"
        echo "   🔍 Systemd ExecStart path: $VENV_DIR/bin/python $BOT_DIR/main.py"
    else
        echo "   ❌ bot.py file not found at $BOT_DIR/bot.py"
    fi
else
    echo "⚠️ Service may not be running. Checking logs:"
    sudo journalctl -u "$SERVICE_NAME" -n 30 --no-pager || true
    echo ""
    echo "💡 You may need to check the service manually:"
    echo "   sudo systemctl status $SERVICE_NAME"
    echo "   sudo journalctl -u $SERVICE_NAME -f"
    # Не завершаем с ошибкой, чтобы не блокировать деплой фронтенда
fi

echo ""
echo "✅ Telegram bot deployment script completed!"

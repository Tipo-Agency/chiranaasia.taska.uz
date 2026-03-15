#!/bin/bash
# Скрипт для установки systemd service (выполняется один раз)

set -e

BOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_DIR="$BOT_DIR/venv"
SERVICE_NAME="telegram-bot"
USER=$(whoami)

echo "📝 Installing systemd service for Telegram bot..."

# Проверяем, что виртуальное окружение существует
if [ ! -d "$VENV_DIR" ]; then
    echo "❌ Virtual environment not found. Please run deploy.sh first."
    exit 1
fi

# Создаем systemd service файл
sudo tee "/etc/systemd/system/$SERVICE_NAME.service" > /dev/null <<EOF
[Unit]
Description=Telegram Bot for Task Management System
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$BOT_DIR
Environment="PATH=$VENV_DIR/bin"
ExecStart=$VENV_DIR/bin/python $BOT_DIR/bot.py
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# Перезагружаем systemd
sudo systemctl daemon-reload

# Включаем сервис
sudo systemctl enable "$SERVICE_NAME"

echo "✅ Systemd service installed successfully!"
echo "📋 Useful commands:"
echo "   sudo systemctl start $SERVICE_NAME    - Start bot"
echo "   sudo systemctl stop $SERVICE_NAME     - Stop bot"
echo "   sudo systemctl restart $SERVICE_NAME   - Restart bot"
echo "   sudo systemctl status $SERVICE_NAME   - Check status"
echo "   sudo journalctl -u $SERVICE_NAME -f  - View logs"

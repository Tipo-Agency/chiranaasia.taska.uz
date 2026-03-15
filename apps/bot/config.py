"""
Конфигурация Telegram бота
"""
import os
from dotenv import load_dotenv

load_dotenv()

# Telegram Bot Token (обязательно из переменных окружения, без дефолтного значения)
TELEGRAM_BOT_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN')
if not TELEGRAM_BOT_TOKEN:
    raise ValueError("TELEGRAM_BOT_TOKEN environment variable is required! Set it in .env file or environment.")

# Backend API (обязательно)
BACKEND_URL = os.getenv('BACKEND_URL', '')  # e.g. http://localhost:8000

# Часовой пояс по умолчанию
DEFAULT_TIMEZONE = os.getenv('DEFAULT_TIMEZONE', 'Asia/Tashkent')

# Время ежедневного напоминания
DAILY_REMINDER_TIME = '09:00'  # 9:00 утра

# Время еженедельного отчета (понедельник)
WEEKLY_REPORT_DAY = 0  # 0 = понедельник
WEEKLY_REPORT_TIME = '09:00'  # 9:00 утра

"""
Вспомогательные функции
"""
from datetime import datetime, timedelta
from typing import List, Dict, Any
import pytz

def get_today_date(timezone: str = 'Asia/Tashkent') -> str:
    """Получить сегодняшнюю дату в формате YYYY-MM-DD"""
    tz = pytz.timezone(timezone)
    today = datetime.now(tz).date()
    return today.isoformat()

def is_overdue(end_date: str, timezone: str = 'Asia/Tashkent') -> bool:
    """Проверить, просрочена ли задача"""
    if not end_date:
        return False
    
    try:
        # Нормализуем дату - убираем время если есть
        date_str = end_date
        if 'T' in date_str:
            date_str = date_str.split('T')[0]
        elif ' ' in date_str:
            date_str = date_str.split(' ')[0]
        
        tz = pytz.timezone(timezone)
        today = datetime.now(tz).date()
        
        # Пробуем разные форматы даты
        try:
            task_date = datetime.fromisoformat(date_str).date()
        except:
            # Если не ISO формат, пробуем парсить как YYYY-MM-DD
            try:
                task_date = datetime.strptime(date_str, '%Y-%m-%d').date()
            except:
                # Если и это не работает, пробуем с временной зоной
                task_date = datetime.fromisoformat(date_str.replace('Z', '+00:00')).date()
        
        return task_date < today
    except Exception as e:
        print(f"Error checking overdue for date {end_date}: {e}")
        return False

def get_week_range(timezone: str = 'Asia/Tashkent') -> tuple:
    """Получить диапазон дат текущей недели (понедельник - воскресенье)"""
    tz = pytz.timezone(timezone)
    today = datetime.now(tz).date()
    
    # Находим понедельник текущей недели
    days_since_monday = today.weekday()
    monday = today - timedelta(days=days_since_monday)
    sunday = monday + timedelta(days=6)
    
    return monday.isoformat(), sunday.isoformat()

def format_date(date_str: str, format: str = '%d.%m.%Y') -> str:
    """Форматировать дату"""
    try:
        date_obj = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
        return date_obj.strftime(format)
    except:
        return date_str

def truncate_text(text: str, max_length: int = 100) -> str:
    """Обрезать текст до максимальной длины"""
    if not text:
        return ''
    if len(text) <= max_length:
        return text
    return text[:max_length - 3] + '...'

def get_user_name(user: Dict[str, Any]) -> str:
    """Получить имя пользователя"""
    return user.get('name', user.get('login', user.get('id', 'Неизвестно')))

def get_client_name(client: Dict[str, Any]) -> str:
    """Получить название клиента"""
    return client.get('name', client.get('companyName', client.get('id', 'Неизвестно')))

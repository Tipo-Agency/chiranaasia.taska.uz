"""
Модуль личного кабинета
"""
from typing import Optional, Dict, Any
from firebase_client import firebase
from auth import update_user_password, update_user_avatar, update_user_contacts

def get_user_profile(user_id: str) -> Optional[Dict[str, Any]]:
    """Получить профиль пользователя"""
    try:
        user = firebase.get_by_id('users', user_id)
        if user:
            # Удаляем пароль из ответа
            user.pop('password', None)
        return user
    except Exception as e:
        print(f"Error getting user profile: {e}")
        return None

def format_profile_message(user: Dict[str, Any]) -> str:
    """Форматировать сообщение профиля"""
    message = "👤 Мой профиль\n\n"
    message += f"Имя: {user.get('name', 'Не указано')}\n"
    message += f"Роль: {'Администратор' if user.get('role') == 'ADMIN' else 'Сотрудник'}\n"
    
    if user.get('email'):
        message += f"Email: {user.get('email')}\n"
    
    if user.get('phone'):
        message += f"Телефон: {user.get('phone')}\n"
    
    return message

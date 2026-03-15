"""
Модуль аутентификации пользователей
"""
import bcrypt
from typing import Optional, Dict, Any
from firebase_client import firebase

def verify_password(password: str, hashed: str) -> bool:
    """Проверить пароль через bcrypt"""
    try:
        return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))
    except Exception as e:
        print(f"Error verifying password: {e}")
        return False

def is_hashed_password(password: str) -> bool:
    """Проверить, является ли пароль захешированным"""
    # bcrypt хеши начинаются с $2a$, $2b$ или $2y$
    return password.startswith('$2') and len(password) == 60

def authenticate_user(login: str, password: str) -> Optional[Dict[str, Any]]:
    """
    Аутентифицировать пользователя по логину и паролю
    
    Args:
        login: Логин пользователя
        password: Пароль пользователя
    
    Returns:
        User dict если успешно, None если неверные данные
    """
    try:
        # Получаем всех пользователей
        users = firebase.get_all('users')
        
        # Ищем пользователя по логину (без учета регистра)
        login_lower = login.strip().lower()
        user = None
        
        for u in users:
            if not u.get('login'):
                continue
            user_login = str(u['login']).strip().lower()
            if user_login == login_lower:
                user = u
                break
        
        if not user:
            return None
        
        # Проверяем, не архивирован ли пользователь
        if user.get('isArchived'):
            return None
        
        # Проверяем пароль
        user_password = user.get('password', '')
        if not user_password:
            return None
        
        password_match = False
        if is_hashed_password(user_password):
            # Пароль захеширован - используем bcrypt
            password_match = verify_password(password, user_password)
        else:
            # Старый пароль в открытом виде (для обратной совместимости)
            password_match = user_password.strip() == password.strip()
        
        if password_match:
            # Удаляем пароль из ответа
            user.pop('password', None)
            return user
        
        return None
    except Exception as e:
        print(f"Error authenticating user: {e}")
        return None

def check_user_active(user_id: str) -> bool:
    """
    Проверить, активен ли пользователь (не архивирован)
    
    Args:
        user_id: ID пользователя
    
    Returns:
        True если активен, False если архивирован или не найден
    """
    try:
        user = firebase.get_by_id('users', user_id)
        if not user:
            return False
        return not user.get('isArchived', False)
    except Exception as e:
        print(f"Error checking user active: {e}")
        return False

def update_user_password(user_id: str, old_password: str, new_password: str) -> bool:
    """
    Обновить пароль пользователя
    
    Args:
        user_id: ID пользователя
        old_password: Старый пароль
        new_password: Новый пароль
    
    Returns:
        True если успешно, False если неверный старый пароль
    """
    try:
        user = firebase.get_by_id('users', user_id)
        if not user:
            return False
        
        # Проверяем старый пароль
        user_password = user.get('password', '')
        if not user_password:
            return False
        
        password_match = False
        if is_hashed_password(user_password):
            password_match = verify_password(old_password, user_password)
        else:
            password_match = user_password.strip() == old_password.strip()
        
        if not password_match:
            return False
        
        # Хешируем новый пароль
        hashed = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        
        # Обновляем пароль
        user['password'] = hashed
        user['mustChangePassword'] = False
        firebase.save('users', user)
        
        return True
    except Exception as e:
        print(f"Error updating password: {e}")
        return False

def update_user_avatar(user_id: str, avatar_url: str) -> bool:
    """
    Обновить аватарку пользователя
    
    Args:
        user_id: ID пользователя
        avatar_url: URL аватарки
    
    Returns:
        True если успешно
    """
    try:
        user = firebase.get_by_id('users', user_id)
        if not user:
            return False
        
        user['avatar'] = avatar_url
        firebase.save('users', user)
        
        return True
    except Exception as e:
        print(f"Error updating avatar: {e}")
        return False

def update_user_contacts(user_id: str, phone: Optional[str] = None, email: Optional[str] = None) -> bool:
    """
    Обновить контакты пользователя
    
    Args:
        user_id: ID пользователя
        phone: Номер телефона (опционально)
        email: Email (опционально)
    
    Returns:
        True если успешно
    """
    try:
        user = firebase.get_by_id('users', user_id)
        if not user:
            return False
        
        if phone is not None:
            user['phone'] = phone
        if email is not None:
            user['email'] = email
        
        firebase.save('users', user)
        
        return True
    except Exception as e:
        print(f"Error updating contacts: {e}")
        return False

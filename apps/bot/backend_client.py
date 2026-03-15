"""
Клиент для работы с Python FastAPI backend (замена Firebase).
Используется когда BACKEND_URL задан в .env
"""
import os
import requests
from typing import List, Dict, Any, Optional
import config

BACKEND_URL = getattr(config, 'BACKEND_URL', None) or os.getenv('BACKEND_URL', '')
API_BASE = f"{BACKEND_URL.rstrip('/')}/api" if BACKEND_URL else ""

# Маппинг имён коллекций на API пути
COLLECTION_MAP = {
    'users': '/auth/users',
    'tasks': '/tasks',
    'projects': '/projects',
    'clients': '/clients',
    'deals': '/deals',
    'employeeInfos': '/employees',
    'salesFunnels': '/funnels',
    'meetings': '/meetings',
    'docs': '/docs',
    'statuses': '/statuses',
    'notificationPrefs': '/notification-prefs',
}


class BackendClient:
    """Клиент для REST API backend (совместим с интерфейсом Firebase)."""

    @staticmethod
    def get_all(collection_name: str) -> List[Dict[str, Any]]:
        """Получить все записи."""
        if not API_BASE:
            return []
        path = COLLECTION_MAP.get(collection_name)
        if not path:
            if collection_name == 'notificationPrefs':
                # Специальный случай: один объект
                try:
                    r = requests.get(f"{API_BASE}/notification-prefs", timeout=10)
                    if r.status_code == 200:
                        return [r.json()]
                except Exception:
                    pass
            return []
        try:
            url = f"{API_BASE}{path}"
            r = requests.get(url, timeout=10)
            if r.status_code != 200:
                return []
            data = r.json()
            return data if isinstance(data, list) else []
        except Exception as e:
            print(f"[Backend] get_all({collection_name}): {e}")
            return []

    @staticmethod
    def get_by_id(collection_name: str, doc_id: str) -> Optional[Dict[str, Any]]:
        """Получить запись по ID."""
        if not API_BASE:
            return None
        if collection_name == 'notificationPrefs':
            items = BackendClient.get_all(collection_name)
            return items[0] if items else None
        path = COLLECTION_MAP.get(collection_name)
        if not path or collection_name not in ('deals', 'salesFunnels', 'tasks', 'users', 'clients', 'meetings', 'docs'):
            items = BackendClient.get_all(collection_name)
            return next((x for x in items if x.get('id') == doc_id), None)
        try:
            url = f"{API_BASE}{path}/{doc_id}"
            r = requests.get(url, timeout=10)
            if r.status_code == 404 or r.status_code != 200:
                return None
            return r.json()
        except Exception as e:
            print(f"[Backend] get_by_id({collection_name}, {doc_id}): {e}")
            return None

    @staticmethod
    def save(collection_name: str, data: Dict[str, Any]) -> bool:
        """Сохранить (создать или обновить) запись."""
        if not API_BASE:
            return False
        doc_id = data.get('id')
        if collection_name == 'notificationPrefs':
            try:
                r = requests.put(f"{API_BASE}/notification-prefs", json=data, timeout=10)
                return r.status_code == 200
            except Exception as e:
                print(f"[Backend] save notificationPrefs: {e}")
                return False
        if collection_name == 'tasks':
            items = BackendClient.get_all('tasks')
            items_dict = {x['id']: x for x in items}
            items_dict[doc_id] = data
            items_list = list(items_dict.values())
            try:
                r = requests.put(f"{API_BASE}/tasks", json=items_list, timeout=10)
                return r.status_code == 200
            except Exception as e:
                print(f"[Backend] save tasks: {e}")
                return False
        if collection_name == 'deals':
            if doc_id:
                deal = BackendClient.get_by_id('deals', doc_id)
                if deal:
                    try:
                        updates = {k: v for k, v in data.items() if k != 'id'}
                        r = requests.patch(f"{API_BASE}/deals/{doc_id}", json=updates, timeout=10)
                        return r.status_code == 200
                    except Exception as e:
                        print(f"[Backend] patch deal: {e}")
                        return False
            try:
                r = requests.post(f"{API_BASE}/deals", json=data, timeout=10)
                return r.status_code == 200
            except Exception as e:
                print(f"[Backend] create deal: {e}")
                return False
        if collection_name == 'users':
            users = BackendClient.get_all('users')
            users_dict = {u['id']: u for u in users}
            users_dict[doc_id] = data
            try:
                r = requests.put(f"{API_BASE}/auth/users", json=list(users_dict.values()), timeout=10)
                return r.status_code == 200
            except Exception as e:
                print(f"[Backend] save users: {e}")
                return False
        if collection_name == 'clients':
            items = BackendClient.get_all('clients')
            items_dict = {x['id']: x for x in items}
            items_dict[doc_id] = data
            try:
                r = requests.put(f"{API_BASE}/clients", json=list(items_dict.values()), timeout=10)
                return r.status_code == 200
            except Exception as e:
                print(f"[Backend] save clients: {e}")
                return False
        if collection_name == 'notificationQueue':
            # Очередь уведомлений - пока не реализовано на бэке
            return True
        return False

    @staticmethod
    def delete(collection_name: str, doc_id: str) -> bool:
        """Удалить запись (для deals - мягкое удаление)."""
        if not API_BASE:
            return False
        if collection_name == 'deals':
            try:
                r = requests.delete(f"{API_BASE}/deals/{doc_id}", timeout=10)
                return r.status_code == 200
            except Exception as e:
                print(f"[Backend] delete deal: {e}")
                return False
        if collection_name == 'notificationQueue':
            return True
        return False


backend_client = BackendClient()

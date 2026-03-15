"""
Модуль работы с клиентами
"""
from typing import List, Dict, Any, Optional
from datetime import datetime
from firebase_client import firebase

def get_all_clients(include_archived: bool = False) -> List[Dict[str, Any]]:
    """Получить всех клиентов"""
    try:
        all_clients = firebase.get_all('clients')
        if include_archived:
            return all_clients
        return [c for c in all_clients if not c.get('isArchived', False)]
    except Exception as e:
        print(f"Error getting all clients: {e}")
        return []

def get_client_by_id(client_id: str) -> Optional[Dict[str, Any]]:
    """Получить клиента по ID"""
    return firebase.get_by_id('clients', client_id)

def create_client(client_data: Dict[str, Any]) -> Optional[str]:
    """Создать нового клиента"""
    try:
        now = datetime.now().isoformat()
        client_data['createdAt'] = client_data.get('createdAt', now)
        client_data['updatedAt'] = now
        client_data['isArchived'] = False
        
        # Генерируем ID если нет
        if not client_data.get('id'):
            client_data['id'] = f"client-{int(datetime.now().timestamp() * 1000)}"
        
        firebase.save('clients', client_data)
        return client_data['id']
    except Exception as e:
        print(f"Error creating client: {e}")
        return None

def search_clients(query: str) -> List[Dict[str, Any]]:
    """Поиск клиентов по запросу"""
    try:
        all_clients = get_all_clients()
        query_lower = query.lower()
        
        results = []
        for client in all_clients:
            name = client.get('name', '').lower()
            company_name = client.get('companyName', '').lower()
            
            if query_lower in name or query_lower in company_name:
                results.append(client)
        
        return results
    except Exception as e:
        print(f"Error searching clients: {e}")
        return []

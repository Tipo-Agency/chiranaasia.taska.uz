"""
Модуль работы со сделками (полное управление)
"""
from typing import List, Dict, Any, Optional
from datetime import datetime
from firebase_client import firebase

def get_all_deals(include_archived: bool = False) -> List[Dict[str, Any]]:
    """Получить все сделки"""
    try:
        all_deals = firebase.get_all('deals')
        if include_archived:
            return all_deals
        return [d for d in all_deals if not d.get('isArchived', False)]
    except Exception as e:
        print(f"Error getting all deals: {e}")
        return []

def get_user_deals(user_id: str, include_archived: bool = False) -> List[Dict[str, Any]]:
    """Получить сделки пользователя"""
    try:
        all_deals = get_all_deals(include_archived)
        return [d for d in all_deals if d.get('assigneeId') == user_id]
    except Exception as e:
        print(f"Error getting user deals: {e}")
        return []

def get_deal_by_id(deal_id: str) -> Optional[Dict[str, Any]]:
    """Получить сделку по ID"""
    return firebase.get_by_id('deals', deal_id)

def create_deal(deal_data: Dict[str, Any]) -> Optional[str]:
    """Создать новую сделку"""
    try:
        now = datetime.now().isoformat()
        deal_data['createdAt'] = deal_data.get('createdAt', now)
        deal_data['updatedAt'] = now
        deal_data['isArchived'] = False
        
        # Генерируем ID если нет
        if not deal_data.get('id'):
            deal_data['id'] = f"deal-{int(datetime.now().timestamp() * 1000)}"
        
        firebase.save('deals', deal_data)
        return deal_data['id']
    except Exception as e:
        print(f"Error creating deal: {e}")
        return None

def update_deal(deal_id: str, updates: Dict[str, Any]) -> bool:
    """Обновить сделку"""
    try:
        deal = firebase.get_by_id('deals', deal_id)
        if not deal:
            return False
        
        # Обновляем поля
        for key, value in updates.items():
            deal[key] = value
        
        deal['updatedAt'] = datetime.now().isoformat()
        firebase.save('deals', deal)
        return True
    except Exception as e:
        print(f"Error updating deal: {e}")
        return False

def update_deal_stage(deal_id: str, new_stage: str) -> bool:
    """Обновить стадию сделки"""
    return update_deal(deal_id, {'stage': new_stage})

def delete_deal(deal_id: str) -> bool:
    """Удалить сделку (мягкое удаление)"""
    try:
        deal = firebase.get_by_id('deals', deal_id)
        if not deal:
            return False
        
        deal['isArchived'] = True
        deal['updatedAt'] = datetime.now().isoformat()
        firebase.save('deals', deal)
        return True
    except Exception as e:
        print(f"Error deleting deal: {e}")
        return False

def search_deals(query: str) -> List[Dict[str, Any]]:
    """Поиск сделок по запросу"""
    try:
        all_deals = get_all_deals()
        query_lower = query.lower()
        
        results = []
        for deal in all_deals:
            title = deal.get('title', '').lower()
            contact_name = deal.get('contactName', '').lower()
            
            if query_lower in title or query_lower in contact_name:
                results.append(deal)
        
        return results
    except Exception as e:
        print(f"Error searching deals: {e}")
        return []

def get_sales_funnels() -> List[Dict[str, Any]]:
    """Получить все воронки продаж"""
    try:
        return firebase.get_all('salesFunnels')
    except Exception as e:
        print(f"Error getting sales funnels: {e}")
        return []

def get_funnel_stages(funnel_id: str) -> List[Dict[str, Any]]:
    """Получить стадии воронки"""
    try:
        funnel = firebase.get_by_id('salesFunnels', funnel_id)
        if funnel:
            return funnel.get('stages', [])
        return []
    except Exception as e:
        print(f"Error getting funnel stages: {e}")
        return []

def get_won_deals_today() -> List[Dict[str, Any]]:
    """Получить сделки, перешедшие в стадию 'won' сегодня"""
    try:
        all_deals = get_all_deals()
        today = datetime.now().date().isoformat()
        
        won_deals = []
        for deal in all_deals:
            if deal.get('stage') == 'won':
                updated_at = deal.get('updatedAt', '')
                if updated_at:
                    try:
                        updated_date = datetime.fromisoformat(updated_at.replace('Z', '+00:00')).date()
                        if updated_date.isoformat() == today:
                            won_deals.append(deal)
                    except:
                        pass
        
        return won_deals
    except Exception as e:
        print(f"Error getting won deals today: {e}")
        return []

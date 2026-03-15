"""
Модуль для обработки очереди уведомлений из Firebase
Веб-приложение сохраняет задачи на отправку уведомлений в Firebase,
бот периодически проверяет и отправляет их
"""
import logging
from typing import Dict, Any, Optional, List
from datetime import datetime
from firebase_client import firebase

logger = logging.getLogger(__name__)

NOTIFICATION_QUEUE_COLLECTION = 'notificationQueue'

def add_notification_task(
    notification_type: str,
    user_id: str,
    message: str,
    chat_id: str,
    metadata: Optional[Dict[str, Any]] = None
) -> bool:
    """
    Добавляет задачу на отправку уведомления в очередь
    Вызывается из веб-приложения через Firebase
    
    Args:
        notification_type: Тип уведомления (taskCreated, taskStatusChanged, dealCreated, etc.)
        user_id: ID пользователя, которому нужно отправить уведомление
        message: Текст сообщения
        chat_id: Telegram chat ID пользователя
        metadata: Дополнительные данные (опционально)
    
    Returns:
        True если задача добавлена успешно
    """
    try:
        task = {
            'id': f"notif_{datetime.now().isoformat()}_{user_id}",
            'type': notification_type,
            'userId': user_id,
            'message': message,
            'chatId': chat_id,
            'metadata': metadata or {},
            'createdAt': datetime.now().isoformat(),
            'sent': False,
            'error': None
        }
        firebase.save(NOTIFICATION_QUEUE_COLLECTION, task)
        logger.info(f"[NOTIFICATION_QUEUE] Added task: {notification_type} for user {user_id}")
        return True
    except Exception as e:
        logger.error(f"[NOTIFICATION_QUEUE] Error adding task: {e}", exc_info=True)
        return False

def get_pending_notifications(limit: int = 50) -> List[Dict[str, Any]]:
    """
    Получает список неотправленных уведомлений
    
    Args:
        limit: Максимальное количество уведомлений для получения
    
    Returns:
        Список задач на отправку уведомлений
    """
    try:
        all_tasks = firebase.get_all(NOTIFICATION_QUEUE_COLLECTION)
        pending = [t for t in all_tasks if not t.get('sent', False)]
        # Сортируем по дате создания (старые первыми)
        pending.sort(key=lambda x: x.get('createdAt', ''))
        return pending[:limit]
    except Exception as e:
        logger.error(f"[NOTIFICATION_QUEUE] Error getting pending notifications: {e}", exc_info=True)
        return []

def mark_notification_sent(task_id: str, success: bool = True, error: Optional[str] = None) -> bool:
    """
    Помечает уведомление как отправленное
    
    Args:
        task_id: ID задачи
        success: Успешно ли отправлено
        error: Сообщение об ошибке (если есть)
    
    Returns:
        True если обновлено успешно
    """
    try:
        task = firebase.get_by_id(NOTIFICATION_QUEUE_COLLECTION, task_id)
        if task:
            task['sent'] = success
            task['sentAt'] = datetime.now().isoformat()
            if error:
                task['error'] = error
            firebase.save(NOTIFICATION_QUEUE_COLLECTION, task)
            return True
        return False
    except Exception as e:
        logger.error(f"[NOTIFICATION_QUEUE] Error marking notification sent: {e}", exc_info=True)
        return False

def cleanup_old_notifications(days: int = 7) -> int:
    """
    Удаляет старые отправленные уведомления
    
    Args:
        days: Количество дней для хранения
    
    Returns:
        Количество удаленных уведомлений
    """
    try:
        from datetime import timedelta
        cutoff_date = (datetime.now() - timedelta(days=days)).isoformat()
        
        all_tasks = firebase.get_all(NOTIFICATION_QUEUE_COLLECTION)
        deleted_count = 0
        
        for task in all_tasks:
            if task.get('sent') and task.get('sentAt', '') < cutoff_date:
                try:
                    firebase.delete(NOTIFICATION_QUEUE_COLLECTION, task['id'])
                    deleted_count += 1
                except:
                    pass
        
        if deleted_count > 0:
            logger.info(f"[NOTIFICATION_QUEUE] Cleaned up {deleted_count} old notifications")
        
        return deleted_count
    except Exception as e:
        logger.error(f"[NOTIFICATION_QUEUE] Error cleaning up: {e}", exc_info=True)
        return 0

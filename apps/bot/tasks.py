"""
Модуль работы с задачами
"""
from typing import List, Dict, Any, Optional
from datetime import datetime
import logging
from firebase_client import firebase
from utils import get_today_date, is_overdue

logger = logging.getLogger(__name__)

def get_user_tasks(user_id: str, include_archived: bool = False) -> List[Dict[str, Any]]:
    """Получить задачи пользователя"""
    try:
        all_tasks = firebase.get_all('tasks')
        logger.info(f"[TASKS] Total tasks in Firebase: {len(all_tasks) if all_tasks else 0}")
        user_tasks = []
        
        if not all_tasks:
            logger.warning(f"[TASKS] No tasks found in Firebase")
            return []
        
        for task in all_tasks:
            # Пропускаем архивные задачи
            if task.get('isArchived') and not include_archived:
                continue
            
            # Пропускаем идеи и функции
            entity_type = task.get('entityType', 'task')
            if entity_type in ['idea', 'feature']:
                continue
            
            # Пропускаем выполненные задачи
            status = str(task.get('status', '')).lower().strip()
            completed_statuses = ['выполнено', 'done', 'завершено', 'completed', 'выполнена', 'завершена']
            if any(status == s for s in completed_statuses):
                continue
            
            # Проверяем, назначена ли задача на пользователя
            assignee_id = task.get('assigneeId')
            assignee_ids = task.get('assigneeIds', [])
            
            # Проверяем по assigneeId (может быть строкой или None)
            if assignee_id and str(assignee_id) == str(user_id):
                user_tasks.append(task)
                logger.debug(f"[TASKS] Task {task.get('id')} assigned via assigneeId")
            # Проверяем по assigneeIds (массив)
            elif isinstance(assignee_ids, list) and user_id in [str(uid) for uid in assignee_ids if uid]:
                user_tasks.append(task)
                logger.debug(f"[TASKS] Task {task.get('id')} assigned via assigneeIds")
        
        logger.info(f"[TASKS] Found {len(user_tasks)} tasks for user {user_id}")
        return user_tasks
    except Exception as e:
        logger.error(f"[TASKS] Error getting user tasks: {e}", exc_info=True)
        import traceback
        traceback.print_exc()
        return []

def get_today_tasks(user_id: str) -> List[Dict[str, Any]]:
    """Получить задачи на сегодня"""
    try:
        from datetime import date
        import pytz
        
        tz = pytz.timezone('Asia/Tashkent')
        today = datetime.now(tz).date()
        today_str = today.isoformat()
        
        logger.info(f"[TASKS] ===== GET_TODAY_TASKS START =====")
        logger.info(f"[TASKS] user_id: {user_id}, today: {today_str}")
        
        user_tasks = get_user_tasks(user_id)
        logger.info(f"[TASKS] Found {len(user_tasks)} user tasks total")
        
        if not user_tasks:
            logger.warning(f"[TASKS] No user tasks found for user_id: {user_id}")
            return []
        
        today_tasks = []
        for task in user_tasks:
            task_id = task.get('id', 'unknown')
            task_title = task.get('title', 'no title')
            end_date_str = task.get('endDate', '')
            
            if not end_date_str:
                logger.debug(f"[TASKS] Task {task_id} has no endDate, skipping")
                continue
            
            # Нормализуем дату - убираем время если есть
            original_date = end_date_str
            if 'T' in end_date_str:
                end_date_str = end_date_str.split('T')[0]
            elif ' ' in end_date_str:
                end_date_str = end_date_str.split(' ')[0]
            
            # Парсим дату
            try:
                task_date = None
                # Пробуем разные форматы
                if len(end_date_str) == 10 and '-' in end_date_str:  # YYYY-MM-DD
                    task_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
                elif len(end_date_str) == 8 and '-' not in end_date_str:  # YYYYMMDD
                    task_date = datetime.strptime(end_date_str, '%Y%m%d').date()
                else:
                    # Пробуем ISO формат
                    try:
                        task_date = datetime.fromisoformat(end_date_str.replace('Z', '+00:00')).date()
                    except:
                        # Последняя попытка - парсим как есть
                        task_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
                
                logger.info(f"[TASKS] Task {task_id} '{task_title}': original={original_date}, normalized={end_date_str}, parsed={task_date}, today={today}, match={task_date == today}")
                
                # Сравниваем даты
                if task_date == today:
                    # Исключаем выполненные задачи
                    status = str(task.get('status', '')).lower().strip()
                    completed_statuses = ['выполнено', 'done', 'завершено', 'completed', 'выполнена', 'завершена']
                    is_completed = any(status == s for s in completed_statuses)
                    
                    if not is_completed:
                        today_tasks.append(task)
                        logger.info(f"[TASKS] ✅ Added task {task_id} '{task_title}' to today tasks (status: {task.get('status', 'none')})")
                    else:
                        logger.debug(f"[TASKS] ❌ Task {task_id} is completed (status: {status}), skipping")
                else:
                    logger.debug(f"[TASKS] Task {task_id} date {task_date} != today {today}, skipping")
            except Exception as date_error:
                logger.warning(f"[TASKS] ❌ Error parsing date '{end_date_str}' (original: '{original_date}') for task {task_id}: {date_error}")
                import traceback
                logger.debug(f"[TASKS] Traceback: {traceback.format_exc()}")
                continue
        
        logger.info(f"[TASKS] ===== GET_TODAY_TASKS END: Returning {len(today_tasks)} today tasks =====")
        return today_tasks
    except Exception as e:
        logger.error(f"[TASKS] ❌ FATAL ERROR getting today tasks: {e}", exc_info=True)
        import traceback
        logger.error(f"[TASKS] Traceback: {traceback.format_exc()}")
        return []

def get_overdue_tasks(user_id: str) -> List[Dict[str, Any]]:
    """Получить просроченные задачи"""
    try:
        from datetime import date
        import pytz
        
        tz = pytz.timezone('Asia/Tashkent')
        today = datetime.now(tz).date()
        
        logger.info(f"[TASKS] ===== GET_OVERDUE_TASKS START =====")
        logger.info(f"[TASKS] user_id: {user_id}, today: {today.isoformat()}")
        
        user_tasks = get_user_tasks(user_id)
        logger.info(f"[TASKS] Found {len(user_tasks)} user tasks total")
        
        if not user_tasks:
            logger.warning(f"[TASKS] No user tasks found for user_id: {user_id}")
            return []
        
        overdue_tasks = []
        for task in user_tasks:
            task_id = task.get('id', 'unknown')
            task_title = task.get('title', 'no title')
            end_date_str = task.get('endDate', '')
            
            if not end_date_str:
                logger.debug(f"[TASKS] Task {task_id} has no endDate, skipping")
                continue
            
            # Нормализуем дату - убираем время если есть
            original_date = end_date_str
            if 'T' in end_date_str:
                end_date_str = end_date_str.split('T')[0]
            elif ' ' in end_date_str:
                end_date_str = end_date_str.split(' ')[0]
            
            # Парсим дату
            try:
                task_date = None
                # Пробуем разные форматы
                if len(end_date_str) == 10 and '-' in end_date_str:  # YYYY-MM-DD
                    task_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
                elif len(end_date_str) == 8 and '-' not in end_date_str:  # YYYYMMDD
                    task_date = datetime.strptime(end_date_str, '%Y%m%d').date()
                else:
                    # Пробуем ISO формат
                    try:
                        task_date = datetime.fromisoformat(end_date_str.replace('Z', '+00:00')).date()
                    except:
                        # Последняя попытка - парсим как есть
                        task_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
                
                is_overdue_task = task_date < today
                logger.info(f"[TASKS] Task {task_id} '{task_title}': original={original_date}, normalized={end_date_str}, parsed={task_date}, today={today}, is_overdue={is_overdue_task}")
                
                if is_overdue_task:
                    # Исключаем выполненные задачи
                    status = str(task.get('status', '')).lower().strip()
                    completed_statuses = ['выполнено', 'done', 'завершено', 'completed', 'выполнена', 'завершена']
                    is_completed = any(status == s for s in completed_statuses)
                    
                    if not is_completed:
                        overdue_tasks.append(task)
                        logger.info(f"[TASKS] ✅ Added task {task_id} '{task_title}' to overdue tasks (status: {task.get('status', 'none')})")
                    else:
                        logger.debug(f"[TASKS] ❌ Task {task_id} is completed (status: {status}), skipping")
                else:
                    logger.debug(f"[TASKS] Task {task_id} date {task_date} >= today {today}, not overdue")
            except Exception as date_error:
                logger.warning(f"[TASKS] ❌ Error parsing date '{end_date_str}' (original: '{original_date}') for task {task_id}: {date_error}")
                import traceback
                logger.debug(f"[TASKS] Traceback: {traceback.format_exc()}")
                continue
        
        logger.info(f"[TASKS] ===== GET_OVERDUE_TASKS END: Returning {len(overdue_tasks)} overdue tasks =====")
        return overdue_tasks
    except Exception as e:
        logger.error(f"[TASKS] ❌ FATAL ERROR getting overdue tasks: {e}", exc_info=True)
        import traceback
        logger.error(f"[TASKS] Traceback: {traceback.format_exc()}")
        return []

def get_yesterday_tasks() -> List[Dict[str, Any]]:
    """Получить задачи на вчера (не выполненные)"""
    try:
        from utils import get_today_date
        from datetime import datetime, timedelta
        import pytz
        
        tz = pytz.timezone('Asia/Tashkent')
        today = datetime.now(tz).date()
        yesterday = today - timedelta(days=1)
        yesterday_str = yesterday.isoformat()
        
        all_tasks = firebase.get_all('tasks')
        yesterday_tasks = []
        
        for task in all_tasks:
            if task.get('isArchived'):
                continue
            
            # Исключаем выполненные задачи
            status = task.get('status', '')
            if status in ['Выполнено', 'Done', 'Завершено']:
                continue
            
            end_date = task.get('endDate', '')
            if end_date == yesterday_str:
                yesterday_tasks.append(task)
        
        return yesterday_tasks
    except Exception as e:
        print(f"Error getting yesterday tasks: {e}")
        return []

def get_all_today_tasks() -> List[Dict[str, Any]]:
    """Получить все задачи на сегодня (не только для конкретного пользователя)"""
    try:
        from utils import get_today_date
        
        today = get_today_date()
        all_tasks = firebase.get_all('tasks')
        
        today_tasks = []
        for task in all_tasks:
            if task.get('isArchived'):
                continue
            
            # Исключаем выполненные задачи
            status = task.get('status', '')
            if status in ['Выполнено', 'Done', 'Завершено']:
                continue
            
            if task.get('endDate') == today:
                today_tasks.append(task)
        
        return today_tasks
    except Exception as e:
        print(f"Error getting all today tasks: {e}")
        return []

def get_all_overdue_tasks() -> List[Dict[str, Any]]:
    """Получить все просроченные задачи (не только для конкретного пользователя)"""
    try:
        all_tasks = firebase.get_all('tasks')
        
        overdue_tasks = []
        for task in all_tasks:
            if task.get('isArchived'):
                continue
            
            # Исключаем выполненные задачи
            status = task.get('status', '')
            if status in ['Выполнено', 'Done', 'Завершено']:
                continue
            
            if is_overdue(task.get('endDate', '')):
                overdue_tasks.append(task)
        
        return overdue_tasks
    except Exception as e:
        print(f"Error getting all overdue tasks: {e}")
        return []

def get_task_by_id(task_id: str) -> Optional[Dict[str, Any]]:
    """Получить задачу по ID"""
    return firebase.get_by_id('tasks', task_id)

def update_task_status(task_id: str, new_status: str) -> bool:
    """Обновить статус задачи"""
    try:
        task = firebase.get_by_id('tasks', task_id)
        if not task:
            return False
        
        task['status'] = new_status
        task['updatedAt'] = datetime.now().isoformat()
        firebase.save('tasks', task)
        return True
    except Exception as e:
        print(f"Error updating task status: {e}")
        return False

def create_task(task_data: Dict[str, Any]) -> Optional[str]:
    """Создать новую задачу"""
    try:
        now = datetime.now().isoformat()
        task_data['createdAt'] = task_data.get('createdAt', now)
        task_data['updatedAt'] = now
        task_data['isArchived'] = False
        
        # Генерируем ID если нет
        if not task_data.get('id'):
            task_data['id'] = f"task-{int(datetime.now().timestamp() * 1000)}"
        
        firebase.save('tasks', task_data)
        return task_data['id']
    except Exception as e:
        print(f"Error creating task: {e}")
        return None

def get_statuses() -> List[Dict[str, Any]]:
    """Получить список статусов"""
    try:
        return firebase.get_all('statuses')
    except Exception as e:
        print(f"Error getting statuses: {e}")
        return []

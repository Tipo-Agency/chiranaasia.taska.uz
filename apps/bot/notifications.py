"""
Модуль уведомлений
"""
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from firebase_client import firebase
from tasks import get_today_tasks, get_overdue_tasks, get_yesterday_tasks, get_all_today_tasks, get_all_overdue_tasks
from deals import get_won_deals_today
from messages import format_daily_reminder, format_weekly_report, format_successful_deal
from utils import get_week_range, format_date
import pytz

def check_new_tasks(user_id: str, last_check_time: datetime) -> List[Dict[str, Any]]:
    """Проверить новые задачи для пользователя"""
    try:
        all_tasks = firebase.get_all('tasks')
        new_tasks = []
        
        for task in all_tasks:
            if task.get('isArchived'):
                continue
            
            created_at = task.get('createdAt')
            if not created_at:
                continue
            
            try:
                task_time = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                
                # Проверяем, новая ли задача (создана после last_check_time)
                if task_time <= last_check_time:
                    continue
                
                # Проверяем, назначена ли задача на пользователя ИЛИ создана пользователем
                assignee_id = task.get('assigneeId')
                assignee_ids = task.get('assigneeIds', [])
                created_by = task.get('createdByUserId')
                
                is_assigned = (assignee_id and str(assignee_id) == str(user_id)) or \
                             (isinstance(assignee_ids, list) and user_id in [str(uid) for uid in assignee_ids if uid])
                is_created_by = created_by and str(created_by) == str(user_id)
                
                # Добавляем задачу если она назначена на пользователя ИЛИ создана пользователем
                if is_assigned or is_created_by:
                    new_tasks.append(task)
            except Exception as date_error:
                print(f"Error parsing task date: {date_error}")
                continue
        
        return new_tasks
    except Exception as e:
        print(f"Error checking new tasks: {e}")
        import traceback
        traceback.print_exc()
        return []

def check_new_deals(user_id: str, last_check_time: datetime) -> List[Dict[str, Any]]:
    """Проверить новые заявки для пользователя"""
    try:
        # Получаем настройки уведомлений
        notification_prefs = firebase.get_by_id('notificationPrefs', 'default')
        telegram_users = notification_prefs.get('dealCreated', {}).get('telegramUsers', []) if notification_prefs else []
        
        # Проверяем, должен ли пользователь получать уведомления
        if user_id not in telegram_users:
            return []
        
        all_deals = firebase.get_all('deals')
        new_deals = []
        
        for deal in all_deals:
            if deal.get('isArchived'):
                continue
            
            created_at = deal.get('createdAt')
            if created_at:
                try:
                    deal_time = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                    if deal_time > last_check_time:
                        new_deals.append(deal)
                except:
                    pass
        
        return new_deals
    except Exception as e:
        print(f"Error checking new deals: {e}")
        return []

def check_upcoming_meetings(user_id: str, minutes_before: int = 15) -> List[Dict[str, Any]]:
    """Проверить предстоящие встречи"""
    try:
        all_meetings = firebase.get_all('meetings')
        upcoming = []
        
        now = datetime.now(pytz.timezone('Asia/Tashkent'))
        target_time = now + timedelta(minutes=minutes_before)
        
        for meeting in all_meetings:
            if meeting.get('isArchived'):
                continue
            
            # Проверяем, является ли пользователь участником
            participant_ids = meeting.get('participantIds', [])
            if user_id not in participant_ids and participant_ids:
                continue
            
            # Проверяем дату и время встречи
            meeting_date = meeting.get('date')
            meeting_time = meeting.get('time', '10:00')
            
            if meeting_date:
                try:
                    # Парсим дату и время
                    date_obj = datetime.fromisoformat(meeting_date.replace('Z', '+00:00'))
                    time_parts = meeting_time.split(':')
                    if len(time_parts) == 2:
                        meeting_datetime = date_obj.replace(
                            hour=int(time_parts[0]),
                            minute=int(time_parts[1]),
                            second=0,
                            microsecond=0
                        )
                        
                        # Проверяем, попадает ли встреча в диапазон
                        if now <= meeting_datetime <= target_time:
                            upcoming.append(meeting)
                except:
                    pass
        
        return upcoming
    except Exception as e:
        print(f"Error checking upcoming meetings: {e}")
        return []

def get_daily_reminder_message(user_id: str) -> Optional[str]:
    """Получить сообщение ежедневного напоминания"""
    try:
        today_tasks = get_today_tasks(user_id)
        overdue_tasks = get_overdue_tasks(user_id)
        
        if not today_tasks and not overdue_tasks:
            return None
        
        return format_daily_reminder(today_tasks, overdue_tasks)
    except Exception as e:
        print(f"Error getting daily reminder: {e}")
        return None

def get_weekly_report_message() -> Optional[str]:
    """Получить сообщение еженедельного отчета"""
    try:
        week_start, week_end = get_week_range()
        
        # Получаем все задачи за неделю
        all_tasks = firebase.get_all('tasks')
        all_users = firebase.get_all('users')
        
        # Фильтруем задачи за неделю
        week_tasks = []
        for task in all_tasks:
            if task.get('isArchived'):
                continue
            
            created_at = task.get('createdAt')
            if created_at:
                try:
                    task_date = datetime.fromisoformat(created_at.replace('Z', '+00:00')).date()
                    if week_start <= task_date.isoformat() <= week_end:
                        week_tasks.append(task)
                except:
                    pass
        
        # Подсчитываем статистику по пользователям
        user_stats = {}
        for task in week_tasks:
            assignee_id = task.get('assigneeId')
            if not assignee_id:
                continue
            
            if assignee_id not in user_stats:
                user_stats[assignee_id] = {'completed': 0, 'total': 0}
            
            user_stats[assignee_id]['total'] += 1
            status = task.get('status', '')
            if status in ['Выполнено', 'Done', 'Завершено']:
                user_stats[assignee_id]['completed'] += 1
        
        # Формируем списки лучших и худших
        top_users = []
        bottom_users = []
        
        for user_id, stats in user_stats.items():
            user = next((u for u in all_users if u.get('id') == user_id), None)
            if not user:
                continue
            
            stats['name'] = user.get('name', 'Неизвестно')
            stats['id'] = user_id
            
            percent = (stats['completed'] / stats['total'] * 100) if stats['total'] > 0 else 0
            
            if percent >= 80:
                top_users.append(stats)
            elif percent < 70:
                bottom_users.append(stats)
        
        # Сортируем
        top_users.sort(key=lambda x: (x['completed'] / x['total'] if x['total'] > 0 else 0, x['completed']), reverse=True)
        bottom_users.sort(key=lambda x: (x['completed'] / x['total'] if x['total'] > 0 else 0, x['completed']))
        
        stats = {
            'week_start': format_date(week_start, '%d.%m'),
            'week_end': format_date(week_end, '%d.%m'),
            'completed': sum(1 for t in week_tasks if t.get('status') in ['Выполнено', 'Done', 'Завершено']),
            'overdue': len([t for t in week_tasks if t.get('status') not in ['Выполнено', 'Done', 'Завершено']]),
            'top_users': top_users[:5],
            'bottom_users': bottom_users[:3]
        }
        
        return format_weekly_report(stats)
    except Exception as e:
        print(f"Error getting weekly report: {e}")
        return None

def get_group_daily_summary() -> Optional[str]:
    """Получить ежедневную сводку для группы"""
    try:
        yesterday_tasks = get_yesterday_tasks()
        overdue_tasks = get_all_overdue_tasks()
        today_tasks = get_all_today_tasks()
        users = firebase.get_all('users')
        
        from messages import format_group_daily_summary
        return format_group_daily_summary(yesterday_tasks, overdue_tasks, today_tasks, users)
    except Exception as e:
        print(f"Error getting group daily summary: {e}")
        return None

def get_successful_deal_message(deal: Dict[str, Any]) -> Optional[str]:
    """Получить сообщение об успешной сделке"""
    try:
        clients = firebase.get_all('clients')
        users = firebase.get_all('users')
        
        client = None
        if deal.get('clientId'):
            client = next((c for c in clients if c.get('id') == deal.get('clientId')), None)
        
        user = None
        if deal.get('assigneeId'):
            user = next((u for u in users if u.get('id') == deal.get('assigneeId')), None)
        
        return format_successful_deal(deal, client, user)
    except Exception as e:
        print(f"Error getting successful deal message: {e}")
        return None

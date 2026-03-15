"""
Модуль уведомлений
"""
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from firebase_client import firebase
from tasks import (
    get_today_tasks,
    get_overdue_tasks,
    get_yesterday_tasks,
    get_all_today_tasks,
    get_all_overdue_tasks,
    get_tasks_completed_yesterday,
    COMPLETED_STATUSES,
    _normalize_date,
)
from deals import get_won_deals_today
from messages import format_daily_reminder, format_weekly_report, format_successful_deal
from utils import get_week_range, format_date, get_today_date
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

def _is_task_for_user(task: Dict[str, Any], user_id: str) -> bool:
    aid = task.get('assigneeId')
    aids = task.get('assigneeIds') or []
    if aid and str(aid) == str(user_id):
        return True
    if isinstance(aids, list) and user_id in [str(x) for x in aids if x]:
        return True
    return False


def get_group_daily_summary() -> Optional[str]:
    """Ежедневная сводка для группы: по сотрудникам (выполнено вчера, на сегодня, просрочено) и по проектам контент-плана."""
    try:
        today_str = get_today_date()
        tz = pytz.timezone('Asia/Tashkent')
        today = datetime.now(tz).date()
        yesterday_str = (today - timedelta(days=1)).isoformat()

        all_tasks = firebase.get_all('tasks') or []
        users = [u for u in (firebase.get_all('users') or []) if not u.get('isArchived')]
        tables = firebase.get_all('tables') or []
        content_posts = firebase.get_all('contentPosts') or []

        completed_yesterday = [
            t for t in all_tasks
            if not t.get('isArchived')
            and (t.get('status') or '').strip() in COMPLETED_STATUSES
            and _normalize_date(t.get('endDate') or '') == yesterday_str
        ]
        planned_today = [
            t for t in all_tasks
            if not t.get('isArchived')
            and (t.get('status') or '').strip() not in COMPLETED_STATUSES
            and _normalize_date(t.get('endDate') or '') == today_str
        ]
        overdue = [
            t for t in all_tasks
            if not t.get('isArchived')
            and (t.get('status') or '').strip() not in COMPLETED_STATUSES
            and t.get('endDate')
            and _normalize_date(t.get('endDate') or '') < today_str
        ]

        per_employee = {}
        for u in users:
            uid = u.get('id')
            if not uid:
                continue
            per_employee[uid] = {
                'user': u,
                'completed_yesterday': [t for t in completed_yesterday if _is_task_for_user(t, uid)],
                'planned_today': [t for t in planned_today if _is_task_for_user(t, uid)],
                'overdue': [t for t in overdue if _is_task_for_user(t, uid)],
            }

        posts_today = [
            p for p in content_posts
            if not p.get('isArchived') and _normalize_date(p.get('date') or '') == today_str
        ]
        by_table = {}
        for p in posts_today:
            tid = p.get('tableId') or 'other'
            if tid not in by_table:
                by_table[tid] = []
            by_table[tid].append(p)
        table_names = {t.get('id'): t.get('name', t.get('id', 'Проект')) for t in tables}

        from messages import format_group_daily_summary_v2
        return format_group_daily_summary_v2(per_employee, by_table, table_names)
    except Exception as e:
        print(f"Error getting group daily summary: {e}")
        import traceback
        traceback.print_exc()
        return None

def get_group_chat_id_and_deal_state() -> tuple:
    """Возвращает (telegram_group_chat_id, last_deal_sent_at, congratulated_deal_ids)."""
    prefs = firebase.get_by_id('notificationPrefs', 'default') or {}
    chat_id = prefs.get('telegramGroupChatId')
    last_at = prefs.get('lastDealSentAt') or '1970-01-01T00:00:00'
    congratulated = list(prefs.get('congratulatedDealIds') or [])
    return chat_id, last_at, congratulated


def save_deal_notification_state(last_deal_sent_at: str, congratulated_deal_ids: List[str]) -> None:
    """Сохранить lastDealSentAt и congratulatedDealIds в настройках (для следующего запуска)."""
    try:
        prefs = firebase.get_by_id('notificationPrefs', 'default') or {}
        prefs['lastDealSentAt'] = last_deal_sent_at
        prefs['congratulatedDealIds'] = congratulated_deal_ids[-50:]  # последние 50
        firebase.save('notificationPrefs', prefs)
    except Exception as e:
        print(f"Error saving deal notification state: {e}")


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


async def run_deal_notifications_job(bot) -> None:
    """
    Отправить в группу: (1) все новые заявки со всех воронок с указанием воронки;
    (2) поздравления по сделкам, перешедшим в успешные.
    """
    try:
        chat_id, last_deal_sent_at, congratulated_ids = get_group_chat_id_and_deal_state()
        if not chat_id:
            return
        deals = [d for d in (firebase.get_all('deals') or []) if not d.get('isArchived')]
        funnels = {f['id']: f.get('name', f.get('id', 'Воронка')) for f in (firebase.get_all('salesFunnels') or [])}
        clients = {c['id']: c for c in (firebase.get_all('clients') or [])}

        new_deals = [d for d in deals if (d.get('createdAt') or '') > last_deal_sent_at]
        new_deals.sort(key=lambda d: d.get('createdAt') or '')
        for deal in new_deals:
            funnel_name = funnels.get(deal.get('funnelId'), deal.get('funnelId') or '—')
            title = deal.get('title') or deal.get('contactName') or 'Без названия'
            client_name = ''
            if deal.get('clientId') and deal['clientId'] in clients:
                client_name = clients[deal['clientId']].get('name') or clients[deal['clientId']].get('companyName') or ''
            elif deal.get('contactName'):
                client_name = deal.get('contactName')
            msg = f"🆕 <b>Новая заявка</b> [<b>{funnel_name}</b>]\n\n{title}"
            if client_name:
                msg += f"\nКлиент: {client_name}"
            try:
                await bot.send_message(chat_id=chat_id, text=msg, parse_mode='HTML')
            except Exception as e:
                print(f"Error sending new deal to group: {e}")
            last_deal_sent_at = max(last_deal_sent_at, (deal.get('createdAt') or ''))

        won_statuses = ('completed', 'paid', 'active')
        for deal in deals:
            if deal.get('id') in congratulated_ids:
                continue
            status = (deal.get('status') or '').lower()
            stage = (deal.get('stage') or '').lower()
            if status not in won_statuses and stage != 'won':
                continue
            congratulated_ids.append(deal.get('id'))
            text = get_successful_deal_message(deal)
            if text:
                try:
                    await bot.send_message(chat_id=chat_id, text=text, parse_mode='HTML')
                except Exception as e:
                    print(f"Error sending congrats to group: {e}")

        save_deal_notification_state(last_deal_sent_at, congratulated_ids)
    except Exception as e:
        print(f"Error in run_deal_notifications_job: {e}")
        import traceback
        traceback.print_exc()

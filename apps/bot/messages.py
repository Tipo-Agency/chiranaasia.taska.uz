"""
Форматирование сообщений для Telegram бота
"""
from typing import Dict, Any, List, Optional
from datetime import datetime
import pytz

def format_task_message(task: Dict[str, Any], users: List[Dict[str, Any]], projects: List[Dict[str, Any]] = None) -> str:
    """Форматировать сообщение о задаче"""
    projects = projects or []
    
    assignee = None
    if task.get('assigneeId'):
        assignee = next((u for u in users if u.get('id') == task.get('assigneeId')), None)
    
    creator = None
    if task.get('createdByUserId'):
        creator = next((u for u in users if u.get('id') == task.get('createdByUserId')), None)
    
    project = None
    if task.get('projectId'):
        project = next((p for p in projects if p.get('id') == task.get('projectId')), None)
    
    message = f"📋 Задача #{task.get('id', 'N/A')[:8]}\n\n"
    message += f"Название: {task.get('title', 'Без названия')}\n"
    
    if creator:
        message += f"Постановщик: {creator.get('name', 'Неизвестно')}\n"
    
    if project:
        message += f"Проект: {project.get('name', 'Неизвестно')}\n"
    
    if task.get('priority'):
        message += f"Приоритет: {task.get('priority')}\n"
    
    if task.get('status'):
        message += f"Статус: {task.get('status')}\n"
    
    if task.get('endDate'):
        try:
            end_date = datetime.fromisoformat(task.get('endDate').replace('Z', '+00:00'))
            message += f"Срок: {end_date.strftime('%d.%m.%Y')}\n"
        except:
            message += f"Срок: {task.get('endDate')}\n"
    
    if assignee:
        message += f"Исполнитель: {assignee.get('name', 'Не назначено')}\n"
    else:
        message += "Исполнитель: Не назначено\n"
    
    if task.get('description'):
        message += f"\nОписание:\n{task.get('description')[:200]}"
        if len(task.get('description', '')) > 200:
            message += "..."
    
    return message

def format_deal_message(deal: Dict[str, Any], clients: List[Dict[str, Any]], users: List[Dict[str, Any]], funnels: List[Dict[str, Any]] = None) -> str:
    """Форматировать сообщение о сделке"""
    funnels = funnels or []
    
    client = None
    if deal.get('clientId'):
        client = next((c for c in clients if c.get('id') == deal.get('clientId')), None)
    
    assignee = None
    if deal.get('assigneeId'):
        assignee = next((u for u in users if u.get('id') == deal.get('assigneeId')), None)
    
    funnel = None
    stage = None
    if deal.get('funnelId'):
        funnel = next((f for f in funnels if f.get('id') == deal.get('funnelId')), None)
        if funnel and deal.get('stage'):
            stage = next((s for s in funnel.get('stages', []) if s.get('id') == deal.get('stage')), None)
    
    message = f"🎯 Заявка #{deal.get('id', 'N/A')[:8]}\n\n"
    message += f"Название: {deal.get('title', deal.get('contactName', 'Без названия'))}\n"
    
    if client:
        message += f"Клиент: {client.get('name', client.get('companyName', 'Неизвестно'))}\n"
    elif deal.get('contactName'):
        message += f"Клиент: {deal.get('contactName')}\n"
    
    if deal.get('amount'):
        message += f"Сумма: {deal.get('amount', 0):,} {deal.get('currency', 'UZS')}\n"
    
    if funnel:
        message += f"Воронка: {funnel.get('name', 'Неизвестно')}\n"
    
    if stage:
        message += f"Стадия: {stage.get('name', deal.get('stage', 'Неизвестно'))}\n"
    elif deal.get('stage'):
        message += f"Стадия: {deal.get('stage')}\n"
    
    if assignee:
        message += f"Ответственный: {assignee.get('name', 'Не назначено')}\n"
    else:
        message += "Ответственный: Не назначено\n"
    
    if deal.get('createdAt'):
        try:
            created_date = datetime.fromisoformat(deal.get('createdAt').replace('Z', '+00:00'))
            message += f"Дата создания: {created_date.strftime('%d.%m.%Y')}\n"
        except:
            pass
    
    if deal.get('description'):
        message += f"\nОписание:\n{deal.get('description')[:200]}"
        if len(deal.get('description', '')) > 200:
            message += "..."
    
    return message

def format_daily_reminder(today_tasks: List[Dict[str, Any]], overdue_tasks: List[Dict[str, Any]]) -> str:
    """Форматировать ежедневное напоминание"""
    message = "📋 Ежедневный обзор задач\n\n"
    
    if today_tasks:
        message += f"✅ Текущие задачи ({len(today_tasks)}):\n"
        for i, task in enumerate(today_tasks[:10], 1):  # Ограничиваем 10 задачами
            end_date = task.get('endDate', '')
            try:
                if end_date:
                    date_obj = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
                    date_str = date_obj.strftime('%d.%m')
                else:
                    date_str = 'Без срока'
            except:
                date_str = end_date or 'Без срока'
            
            message += f"{i}. {task.get('title', 'Без названия')} (Срок: {date_str})\n"
        
        if len(today_tasks) > 10:
            message += f"... и еще {len(today_tasks) - 10} задач\n"
        message += "\n"
    else:
        message += "✅ Текущие задачи: нет\n\n"
    
    if overdue_tasks:
        message += f"⚠️ Просроченные задачи ({len(overdue_tasks)}):\n"
        for i, task in enumerate(overdue_tasks[:10], 1):  # Ограничиваем 10 задачами
            end_date = task.get('endDate', '')
            try:
                if end_date:
                    date_obj = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
                    today = datetime.now(pytz.timezone('Asia/Tashkent')).date()
                    task_date = date_obj.date()
                    days_overdue = (today - task_date).days
                    message += f"{i}. {task.get('title', 'Без названия')} (Просрочено на {days_overdue} {'день' if days_overdue == 1 else 'дня' if days_overdue < 5 else 'дней'})\n"
                else:
                    message += f"{i}. {task.get('title', 'Без названия')} (Без срока)\n"
            except:
                message += f"{i}. {task.get('title', 'Без названия')}\n"
        
        if len(overdue_tasks) > 10:
            message += f"... и еще {len(overdue_tasks) - 10} задач\n"
    else:
        message += "⚠️ Просроченные задачи: нет\n"
    
    return message

def format_group_daily_summary(yesterday_tasks: List[Dict[str, Any]], overdue_tasks: List[Dict[str, Any]], today_tasks: List[Dict[str, Any]], users: List[Dict[str, Any]]) -> str:
    """Форматировать ежедневную сводку для группы (legacy)."""
    message = "📋 <b>Ежедневная сводка по задачам</b>\n\n"
    if yesterday_tasks:
        message += f"📅 <b>Задачи на вчера (не выполненные) ({len(yesterday_tasks)}):</b>\n"
        for i, task in enumerate(yesterday_tasks[:15], 1):
            assignee_id = task.get('assigneeId')
            assignee_name = "Не назначено"
            if assignee_id:
                assignee = next((u for u in users if u.get('id') == assignee_id), None)
                if assignee:
                    assignee_name = assignee.get('name', 'Неизвестно')
            message += f"{i}. {task.get('title', 'Без названия')} - <b>{assignee_name}</b>\n"
        if len(yesterday_tasks) > 15:
            message += f"... и еще {len(yesterday_tasks) - 15} задач\n"
        message += "\n"
    else:
        message += "📅 <b>Задачи на вчера:</b> нет\n\n"
    if overdue_tasks:
        message += f"⚠️ <b>Ранее просроченные задачи ({len(overdue_tasks)}):</b>\n"
        for i, task in enumerate(overdue_tasks[:15], 1):
            assignee_id = task.get('assigneeId')
            assignee_name = "Не назначено"
            if assignee_id:
                assignee = next((u for u in users if u.get('id') == assignee_id), None)
                if assignee:
                    assignee_name = assignee.get('name', 'Неизвестно')
            end_date = task.get('endDate', '')
            days_overdue = ""
            if end_date:
                try:
                    from datetime import datetime
                    import pytz
                    date_obj = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
                    today = datetime.now(pytz.timezone('Asia/Tashkent')).date()
                    task_date = date_obj.date()
                    days = (today - task_date).days
                    days_overdue = f" ({days} {'день' if days == 1 else 'дня' if days < 5 else 'дней'})"
                except Exception:
                    pass
            message += f"{i}. {task.get('title', 'Без названия')} - <b>{assignee_name}</b>{days_overdue}\n"
        if len(overdue_tasks) > 15:
            message += f"... и еще {len(overdue_tasks) - 15} задач\n"
        message += "\n"
    else:
        message += "⚠️ <b>Ранее просроченные задачи:</b> нет\n\n"
    if today_tasks:
        message += f"✅ <b>Задачи на сегодня ({len(today_tasks)}):</b>\n"
        for i, task in enumerate(today_tasks[:15], 1):
            assignee_id = task.get('assigneeId')
            assignee_name = "Не назначено"
            if assignee_id:
                assignee = next((u for u in users if u.get('id') == assignee_id), None)
                if assignee:
                    assignee_name = assignee.get('name', 'Неизвестно')
            message += f"{i}. {task.get('title', 'Без названия')} - <b>{assignee_name}</b>\n"
        if len(today_tasks) > 15:
            message += f"... и еще {len(today_tasks) - 15} задач\n"
    else:
        message += "✅ <b>Задачи на сегодня:</b> нет\n"
    return message


def format_group_daily_summary_v2(
    per_employee: Dict[str, Dict[str, Any]],
    content_by_project: Dict[str, List[Dict[str, Any]]],
    table_names: Dict[str, str],
) -> str:
    """Ежедневная сводка: по сотрудникам (выполнено вчера, сегодня, просрочено) и по проектам контент-плана."""
    import pytz
    tz = pytz.timezone('Asia/Tashkent')
    today = datetime.now(tz).date()
    lines = ["📋 <b>Ежедневная сводка</b> (9:00 Ташкент)\n"]

    for uid, data in per_employee.items():
        user = data.get('user', {})
        name = user.get('name', uid)
        completed = data.get('completed_yesterday', [])
        planned = data.get('planned_today', [])
        overdue_list = data.get('overdue', [])
        if not completed and not planned and not overdue_list:
            continue
        lines.append(f"\n👤 <b>{name}</b>")
        if completed:
            lines.append(f"  ✅ Выполнено вчера: {len(completed)}")
            for t in completed[:7]:
                lines.append(f"    • {t.get('title', 'Без названия')}")
            if len(completed) > 7:
                lines.append(f"    ... и ещё {len(completed) - 7}")
        if planned:
            lines.append(f"  📅 На сегодня: {len(planned)}")
            for t in planned[:7]:
                lines.append(f"    • {t.get('title', 'Без названия')}")
            if len(planned) > 7:
                lines.append(f"    ... и ещё {len(planned) - 7}")
        if overdue_list:
            lines.append(f"  ⚠️ Просрочено: {len(overdue_list)}")
            for t in overdue_list[:5]:
                lines.append(f"    • {t.get('title', 'Без названия')}")
            if len(overdue_list) > 5:
                lines.append(f"    ... и ещё {len(overdue_list) - 5}")

    if content_by_project:
        lines.append("\n📱 <b>Контент-план на сегодня</b>")
        for table_id, posts in content_by_project.items():
            project_name = table_names.get(table_id, table_id or 'Без проекта')
            lines.append(f"\n  📂 {project_name}:")
            for p in posts[:15]:
                fmt = (p.get('format') or 'post').lower()
                kind = 'пост' if fmt == 'post' else 'рилс' if fmt == 'reel' else 'сторис' if fmt == 'story' else fmt
                lines.append(f"    • [{kind}] {p.get('topic', 'Без темы')}")
            if len(posts) > 15:
                lines.append(f"    ... и ещё {len(posts) - 15}")

    return "\n".join(lines) if len(lines) > 1 else "\n".join(lines) + "\nНет данных за сегодня."

def format_weekly_report(stats: Dict[str, Any]) -> str:
    """Форматировать еженедельный отчет"""
    message = f"📊 Еженедельный отчет (неделя с {stats.get('week_start', 'N/A')} по {stats.get('week_end', 'N/A')})\n\n"
    message += f"✅ Выполнено задач: {stats.get('completed', 0)}\n"
    message += f"⚠️ Просрочено задач: {stats.get('overdue', 0)}\n\n"
    
    top_users = stats.get('top_users', [])
    if top_users:
        message += "🏆 Лучшие сотрудники:\n"
        for i, user_stat in enumerate(top_users[:5], 1):
            name = user_stat.get('name', 'Неизвестно')
            completed = user_stat.get('completed', 0)
            total = user_stat.get('total', 0)
            percent = (completed / total * 100) if total > 0 else 0
            
            emoji = "🎉" if percent >= 100 else "👏" if percent >= 90 else "👍"
            message += f"{i}. {name} - {completed} задач ({percent:.0f}% выполнено) - {emoji}\n"
        message += "\n"
    
    bottom_users = stats.get('bottom_users', [])
    if bottom_users:
        message += "📈 Нужно улучшить:\n"
        for user_stat in bottom_users[:3]:
            name = user_stat.get('name', 'Неизвестно')
            completed = user_stat.get('completed', 0)
            total = user_stat.get('total', 0)
            percent = (completed / total * 100) if total > 0 else 0
            
            emoji = "💪" if percent >= 60 else "📝"
            message += f"- {name} - {completed} задач ({percent:.0f}% выполнено) - {emoji}\n"
        message += "\n"
    
    message += "Продолжайте в том же духе! 🚀"
    
    return message

def format_successful_deal(deal: Dict[str, Any], client: Optional[Dict[str, Any]], user: Optional[Dict[str, Any]]) -> str:
    """Форматировать сообщение об успешной сделке для группового чата (без суммы)."""
    message = "🎉 <b>Поздравляем! У нас новый клиент!</b>\n\n"
    if deal.get('title'):
        message += f"<b>Сделка:</b> {deal.get('title')}\n"
    if client:
        message += f"<b>Клиент:</b> {client.get('name', client.get('companyName', 'Неизвестно'))}\n"
    elif deal.get('contactName'):
        message += f"<b>Клиент:</b> {deal.get('contactName')}\n"
    if user:
        message += f"<b>Ответственный:</b> {user.get('name', 'Неизвестно')}\n"
    message += "\n🚀 Продолжаем в том же духе!"
    return message

def format_meeting_message(meeting: Dict[str, Any], users: List[Dict[str, Any]]) -> str:
    """Форматировать сообщение о встрече"""
    message = f"📅 Встреча #{meeting.get('id', 'N/A')[:8]}\n\n"
    message += f"<b>Название:</b> {meeting.get('title', 'Без названия')}\n"
    
    if meeting.get('date'):
        try:
            date_obj = datetime.fromisoformat(meeting.get('date').replace('Z', '+00:00'))
            message += f"<b>Дата:</b> {date_obj.strftime('%d.%m.%Y')}\n"
        except:
            message += f"<b>Дата:</b> {meeting.get('date')}\n"
    
    if meeting.get('time'):
        message += f"<b>Время:</b> {meeting.get('time')}\n"
    
    # Участники (используем participantIds из types.ts)
    participant_ids = meeting.get('participantIds', [])
    if participant_ids:
        participant_names = []
        for participant_id in participant_ids:
            participant = next((u for u in users if u.get('id') == participant_id), None)
            if participant:
                participant_names.append(participant.get('name', 'Неизвестно'))
        if participant_names:
            message += f"<b>Участники:</b> {', '.join(participant_names)}\n"
    
    if meeting.get('summary'):
        message += f"\n<b>Описание:</b>\n{meeting.get('summary')[:200]}"
        if len(meeting.get('summary', '')) > 200:
            message += "..."
    
    return message

def format_document_message(document: Dict[str, Any], users: List[Dict[str, Any]]) -> str:
    """Форматировать сообщение о документе"""
    message = f"📄 Документ #{document.get('id', 'N/A')[:8]}\n\n"
    message += f"<b>Название:</b> {document.get('title', 'Без названия')}\n"
    
    if document.get('type'):
        type_name = 'Ссылка' if document.get('type') == 'link' else 'Внутренний документ'
        message += f"<b>Тип:</b> {type_name}\n"
    
    # Автор (используем createdByUserId из types.ts)
    author_id = document.get('createdByUserId')
    if author_id:
        author = next((u for u in users if u.get('id') == author_id), None)
        if author:
            message += f"<b>Автор:</b> {author.get('name', 'Неизвестно')}\n"
    
    if document.get('createdAt'):
        try:
            created_date = datetime.fromisoformat(document.get('createdAt').replace('Z', '+00:00'))
            message += f"<b>Дата создания:</b> {created_date.strftime('%d.%m.%Y')}\n"
        except:
            pass
    
    if document.get('url'):
        message += f"<b>Ссылка:</b> {document.get('url')}\n"
    
    if document.get('content'):
        # Для внутренних документов показываем первые 200 символов контента
        content = document.get('content', '')
        if isinstance(content, str):
            message += f"\n<b>Содержание:</b>\n{content[:200]}"
            if len(content) > 200:
                message += "..."
    
    return message

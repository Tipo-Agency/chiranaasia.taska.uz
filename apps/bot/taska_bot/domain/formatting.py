"""Тексты для Telegram (HTML где нужно)."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

import pytz


def format_daily_reminder(today_tasks: List[Dict[str, Any]], overdue_tasks: List[Dict[str, Any]]) -> str:
    message = "📋 Ежедневный обзор задач\n\n"
    if today_tasks:
        message += f"✅ Текущие задачи ({len(today_tasks)}):\n"
        for i, task in enumerate(today_tasks[:10], 1):
            end_date = task.get("endDate", "")
            try:
                if end_date:
                    date_obj = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
                    date_str = date_obj.strftime("%d.%m")
                else:
                    date_str = "Без срока"
            except Exception:
                date_str = end_date or "Без срока"
            message += f"{i}. {task.get('title', 'Без названия')} (Срок: {date_str})\n"
        if len(today_tasks) > 10:
            message += f"... и еще {len(today_tasks) - 10} задач\n"
        message += "\n"
    else:
        message += "✅ Текущие задачи: нет\n\n"

    if overdue_tasks:
        message += f"⚠️ Просроченные задачи ({len(overdue_tasks)}):\n"
        for i, task in enumerate(overdue_tasks[:10], 1):
            end_date = task.get("endDate", "")
            try:
                if end_date:
                    date_obj = datetime.fromisoformat(end_date.replace("Z", "+00:00"))
                    today = datetime.now(pytz.timezone("Asia/Tashkent")).date()
                    task_date = date_obj.date()
                    days_overdue = (today - task_date).days
                    ru = "день" if days_overdue == 1 else "дня" if days_overdue < 5 else "дней"
                    message += f"{i}. {task.get('title', 'Без названия')} (Просрочено на {days_overdue} {ru})\n"
                else:
                    message += f"{i}. {task.get('title', 'Без названия')} (Без срока)\n"
            except Exception:
                message += f"{i}. {task.get('title', 'Без названия')}\n"
        if len(overdue_tasks) > 10:
            message += f"... и еще {len(overdue_tasks) - 10} задач\n"
    else:
        message += "⚠️ Просроченные задачи: нет\n"
    return message


def format_group_daily_summary_v2(
    per_employee: Dict[str, Dict[str, Any]],
    content_by_project: Dict[str, List[Dict[str, Any]]],
    table_names: Dict[str, str],
) -> str:
    lines = ["📋 <b>Ежедневная сводка</b> (9:00 Ташкент)\n"]
    for uid, data in per_employee.items():
        user = data.get("user", {})
        name = user.get("name", uid)
        completed = data.get("completed_yesterday", [])
        planned = data.get("planned_today", [])
        overdue_list = data.get("overdue", [])
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
            project_name = table_names.get(table_id, table_id or "Без проекта")
            lines.append(f"\n  📂 {project_name}:")
            for p in posts[:15]:
                fmt = (p.get("format") or "post").lower()
                kind = "пост" if fmt == "post" else "рилс" if fmt == "reel" else "сторис" if fmt == "story" else fmt
                lines.append(f"    • [{kind}] {p.get('topic', 'Без темы')}")
            if len(posts) > 15:
                lines.append(f"    ... и ещё {len(posts) - 15}")

    return "\n".join(lines) if len(lines) > 1 else "\n".join(lines) + "\nНет данных за сегодня."


def format_weekly_report(stats: Dict[str, Any]) -> str:
    message = "📊 Еженедельный отчет (неделя с {ws} по {we})\n\n".format(
        ws=stats.get("week_start", "N/A"),
        we=stats.get("week_end", "N/A"),
    )
    message += f"✅ Выполнено задач: {stats.get('completed', 0)}\n"
    message += f"⚠️ Просрочено задач: {stats.get('overdue', 0)}\n\n"
    top_users = stats.get("top_users", [])
    if top_users:
        message += "🏆 Лучшие сотрудники:\n"
        for i, user_stat in enumerate(top_users[:5], 1):
            name = user_stat.get("name", "Неизвестно")
            completed = user_stat.get("completed", 0)
            total = user_stat.get("total", 0)
            percent = (completed / total * 100) if total > 0 else 0
            emoji = "🎉" if percent >= 100 else "👏" if percent >= 90 else "👍"
            message += f"{i}. {name} - {completed} задач ({percent:.0f}% выполнено) - {emoji}\n"
        message += "\n"
    bottom_users = stats.get("bottom_users", [])
    if bottom_users:
        message += "📈 Нужно улучшить:\n"
        for user_stat in bottom_users[:3]:
            name = user_stat.get("name", "Неизвестно")
            completed = user_stat.get("completed", 0)
            total = user_stat.get("total", 0)
            percent = (completed / total * 100) if total > 0 else 0
            emoji = "💪" if percent >= 60 else "📝"
            message += f"- {name} - {completed} задач ({percent:.0f}% выполнено) - {emoji}\n"
        message += "\n"
    message += "Продолжайте в том же духе! 🚀"
    return message


def format_successful_deal(
    deal: Dict[str, Any],
    client: Optional[Dict[str, Any]],
    user: Optional[Dict[str, Any]],
) -> str:
    message = "🎉 <b>Поздравляем! У нас новый клиент!</b>\n\n"
    if deal.get("title"):
        message += f"<b>Сделка:</b> {deal.get('title')}\n"
    if client:
        message += f"<b>Клиент:</b> {client.get('name', client.get('companyName', 'Неизвестно'))}\n"
    elif deal.get("contactName"):
        message += f"<b>Клиент:</b> {deal.get('contactName')}\n"
    if user:
        message += f"<b>Ответственный:</b> {user.get('name', 'Неизвестно')}\n"
    message += "\n🚀 Продолжаем в том же духе!"
    return message

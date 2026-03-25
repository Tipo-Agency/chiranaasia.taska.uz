"""Сводки для планировщика (асинхронно, через ApiClient)."""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

import pytz

from taska_bot.api.client import ApiClient
from taska_bot.domain.dates import format_date_short, get_week_range
from taska_bot.domain.formatting import (
    format_daily_reminder,
    format_group_daily_summary_v2,
    format_weekly_report,
)
from taska_bot.domain.task_filters import overdue_tasks_for_user, today_tasks_for_user

COMPLETED_STATUSES = (
    "Выполнено", "Done", "Завершено", "Completed", "completed", "выполнено", "завершено",
)


def _normalize_date(d: str) -> str:
    if not d:
        return ""
    if "T" in d:
        return d.split("T")[0]
    if " " in d:
        return d.split(" ")[0]
    return d[:10] if len(d) >= 10 else d


def _is_task_for_user(task: Dict[str, Any], user_id: str) -> bool:
    aid = task.get("assigneeId")
    aids = task.get("assigneeIds") or []
    if aid and str(aid) == str(user_id):
        return True
    if isinstance(aids, list) and user_id in [str(x) for x in aids if x]:
        return True
    return False


async def build_daily_reminder_message(api: ApiClient, user_id: str) -> Optional[str]:
    tasks = await api.get_tasks()
    today = today_tasks_for_user(tasks, user_id)
    overdue = overdue_tasks_for_user(tasks, user_id)
    if not today and not overdue:
        return None
    return format_daily_reminder(today, overdue)


async def build_group_daily_summary(api: ApiClient, tz_name: str) -> Optional[str]:
    tz = pytz.timezone(tz_name)
    today = datetime.now(tz).date()
    yesterday_str = (today - timedelta(days=1)).isoformat()
    today_str = today.isoformat()

    all_tasks = await api.get_tasks()
    users = [u for u in await api.get_users() if not u.get("isArchived")]
    tables = await api.get_tables()
    content_posts = await api.get_content_posts()

    completed_yesterday = [
        t
        for t in all_tasks
        if not t.get("isArchived")
        and (t.get("status") or "").strip() in COMPLETED_STATUSES
        and _normalize_date(t.get("endDate") or "") == yesterday_str
    ]
    planned_today = [
        t
        for t in all_tasks
        if not t.get("isArchived")
        and (t.get("status") or "").strip() not in COMPLETED_STATUSES
        and _normalize_date(t.get("endDate") or "") == today_str
    ]
    overdue = [
        t
        for t in all_tasks
        if not t.get("isArchived")
        and (t.get("status") or "").strip() not in COMPLETED_STATUSES
        and t.get("endDate")
        and _normalize_date(t.get("endDate") or "") < today_str
    ]

    per_employee: Dict[str, Dict[str, Any]] = {}
    for u in users:
        uid = u.get("id")
        if not uid:
            continue
        per_employee[uid] = {
            "user": u,
            "completed_yesterday": [t for t in completed_yesterday if _is_task_for_user(t, uid)],
            "planned_today": [t for t in planned_today if _is_task_for_user(t, uid)],
            "overdue": [t for t in overdue if _is_task_for_user(t, uid)],
        }

    posts_today = [
        p for p in content_posts if not p.get("isArchived") and _normalize_date(p.get("date") or "") == today_str
    ]
    by_table: Dict[str, List[Dict[str, Any]]] = {}
    for p in posts_today:
        tid = p.get("tableId") or "other"
        by_table.setdefault(tid, []).append(p)
    table_names = {t.get("id"): t.get("name", t.get("id", "Проект")) for t in tables}

    return format_group_daily_summary_v2(per_employee, by_table, table_names)


async def build_weekly_report_message(api: ApiClient, tz_name: str) -> Optional[str]:
    week_start, week_end = get_week_range(tz_name)
    all_tasks = await api.get_tasks()
    all_users = await api.get_users()

    week_tasks: List[Dict[str, Any]] = []
    for task in all_tasks:
        if task.get("isArchived"):
            continue
        created_at = task.get("createdAt")
        if not created_at:
            continue
        try:
            task_date = datetime.fromisoformat(created_at.replace("Z", "+00:00")).date()
            if week_start <= task_date.isoformat() <= week_end:
                week_tasks.append(task)
        except Exception:
            pass

    user_stats: Dict[str, Dict[str, int]] = {}
    for task in week_tasks:
        assignee_id = task.get("assigneeId")
        if not assignee_id:
            continue
        if assignee_id not in user_stats:
            user_stats[assignee_id] = {"completed": 0, "total": 0}
        user_stats[assignee_id]["total"] += 1
        status = task.get("status", "")
        if status in ("Выполнено", "Done", "Завершено"):
            user_stats[assignee_id]["completed"] += 1

    top_users: List[Dict[str, Any]] = []
    bottom_users: List[Dict[str, Any]] = []
    for user_id, stats in user_stats.items():
        user = next((u for u in all_users if u.get("id") == user_id), None)
        if not user:
            continue
        stats["name"] = user.get("name", "Неизвестно")
        stats["id"] = user_id
        percent = (stats["completed"] / stats["total"] * 100) if stats["total"] > 0 else 0
        if percent >= 80:
            top_users.append(stats)
        elif percent < 70:
            bottom_users.append(stats)

    top_users.sort(
        key=lambda x: (x["completed"] / x["total"] if x["total"] > 0 else 0, x["completed"]),
        reverse=True,
    )
    bottom_users.sort(key=lambda x: (x["completed"] / x["total"] if x["total"] > 0 else 0, x["completed"]))

    stats_out = {
        "week_start": format_date_short(week_start, "%d.%m"),
        "week_end": format_date_short(week_end, "%d.%m"),
        "completed": sum(1 for t in week_tasks if (t.get("status") or "") in ("Выполнено", "Done", "Завершено")),
        "overdue": len([t for t in week_tasks if (t.get("status") or "") not in ("Выполнено", "Done", "Завершено")]),
        "top_users": top_users[:5],
        "bottom_users": bottom_users[:3],
    }
    return format_weekly_report(stats_out)

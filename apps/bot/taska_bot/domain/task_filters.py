"""Чистые функции: фильтрация задач из JSON API."""
from __future__ import annotations

from datetime import datetime
from typing import Any

import pytz

_COMPLETED = (
    "выполнено", "done", "завершено", "completed", "выполнена", "завершена",
)


def _is_completed_status(status: str) -> bool:
    s = str(status or "").lower().strip()
    return any(s == x for x in _COMPLETED)


def user_open_tasks(all_tasks: list[dict], user_id: str, include_archived: bool = False) -> list[dict]:
    out: list[dict] = []
    for task in all_tasks:
        if task.get("isArchived") and not include_archived:
            continue
        et = task.get("entityType", "task")
        if et in ("idea", "feature"):
            continue
        if _is_completed_status(str(task.get("status", ""))):
            continue
        aid = task.get("assigneeId")
        aids = task.get("assigneeIds") or []
        if aid and str(aid) == str(user_id):
            out.append(task)
        elif isinstance(aids, list) and str(user_id) in [str(x) for x in aids if x]:
            out.append(task)
    return out


def today_tasks_for_user(all_tasks: list[dict], user_id: str) -> list[dict]:
    tz = pytz.timezone("Asia/Tashkent")
    today = datetime.now(tz).date()
    user_tasks = user_open_tasks(all_tasks, user_id)
    out: list[dict] = []
    for task in user_tasks:
        end_date_str = task.get("endDate") or ""
        if not end_date_str:
            continue
        if "T" in end_date_str:
            end_date_str = end_date_str.split("T")[0]
        elif " " in end_date_str:
            end_date_str = end_date_str.split(" ")[0]
        try:
            if len(end_date_str) == 10 and "-" in end_date_str:
                task_date = datetime.strptime(end_date_str, "%Y-%m-%d").date()
            else:
                task_date = datetime.fromisoformat(end_date_str.replace("Z", "+00:00")).date()
        except Exception:
            continue
        if task_date == today:
            out.append(task)
    return out


def overdue_tasks_for_user(all_tasks: list[dict], user_id: str) -> list[dict]:
    tz = pytz.timezone("Asia/Tashkent")
    today = datetime.now(tz).date()
    user_tasks = user_open_tasks(all_tasks, user_id)
    out: list[dict] = []
    for task in user_tasks:
        end_date_str = task.get("endDate") or ""
        if not end_date_str:
            continue
        if "T" in end_date_str:
            end_date_str = end_date_str.split("T")[0]
        elif " " in end_date_str:
            end_date_str = end_date_str.split(" ")[0]
        try:
            if len(end_date_str) == 10 and "-" in end_date_str:
                task_date = datetime.strptime(end_date_str, "%Y-%m-%d").date()
            else:
                task_date = datetime.fromisoformat(end_date_str.replace("Z", "+00:00")).date()
        except Exception:
            continue
        if task_date < today:
            out.append(task)
    return out

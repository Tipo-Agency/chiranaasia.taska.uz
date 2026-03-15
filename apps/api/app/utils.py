"""Utility functions."""
import json
from datetime import datetime
from typing import Any


def to_camel_case(snake_str: str) -> str:
    components = snake_str.split("_")
    return components[0] + "".join(x.title() for x in components[1:])


def row_to_dict(row: Any, exclude: set = None) -> dict:
    """Convert SQLAlchemy row to dict with camelCase keys for frontend."""
    exclude = exclude or set()
    result = {}
    for col in row.__table__.columns:
        if col.name in exclude:
            continue
        val = getattr(row, col.name, None)
        if val is not None and hasattr(val, "isoformat"):
            val = val.isoformat()
        key = to_camel_case(col.name) if "_" in col.name else col.name
        if key == "prefs":
            key = "id"
            result[key] = "default"
            result = {**result, **val} if isinstance(val, dict) else result
            continue
        if key == "rule":
            result = {**result, **val} if isinstance(val, dict) else result
            continue
        result[key] = val
    return result


def row_to_user(row) -> dict:
    """Convert User model to frontend format."""
    d = {
        "id": row.id,
        "name": row.name,
        "role": row.role,
        "avatar": row.avatar,
        "login": row.login,
        "email": row.email,
        "phone": row.phone,
        "telegram": row.telegram,
        "telegramUserId": row.telegram_user_id,
        "isArchived": row.is_archived,
        "mustChangePassword": row.must_change_password,
    }
    return d


def row_to_task(row) -> dict:
    """Convert Task model to frontend format."""
    return {
        "id": row.id,
        "tableId": row.table_id,
        "entityType": row.entity_type or "task",
        "title": row.title,
        "status": row.status,
        "priority": row.priority,
        "assigneeId": row.assignee_id,
        "assigneeIds": row.assignee_ids or [],
        "projectId": row.project_id,
        "startDate": row.start_date,
        "endDate": row.end_date,
        "description": row.description,
        "isArchived": row.is_archived or False,
        "comments": row.comments or [],
        "attachments": row.attachments or [],
        "contentPostId": row.content_post_id,
        "processId": row.process_id,
        "processInstanceId": row.process_instance_id,
        "stepId": row.step_id,
        "dealId": row.deal_id,
        "source": row.source,
        "category": row.category,
        "taskId": row.task_id,
        "createdByUserId": row.created_by_user_id,
        "createdAt": row.created_at,
        "requesterId": row.requester_id,
        "departmentId": row.department_id,
        "categoryId": row.category_id,
        "amount": float(row.amount) if row.amount and str(row.amount).replace(".", "").isdigit() else row.amount,
        "decisionDate": row.decision_date,
    }


def row_to_project(row) -> dict:
    return {
        "id": row.id,
        "name": row.name,
        "icon": row.icon,
        "color": row.color,
        "isArchived": row.is_archived or False,
    }


def row_to_table(row) -> dict:
    return {
        "id": row.id,
        "name": row.name,
        "type": row.type,
        "icon": row.icon,
        "color": row.color,
        "isSystem": row.is_system or False,
        "isArchived": row.is_archived or False,
    }


def row_to_status(row) -> dict:
    return {"id": row.id, "name": row.name, "color": row.color}


def row_to_priority(row) -> dict:
    return {"id": row.id, "name": row.name, "color": row.color}


def row_to_activity(row) -> dict:
    return {
        "id": row.id,
        "userId": row.user_id,
        "userName": row.user_name,
        "userAvatar": row.user_avatar,
        "action": row.action,
        "details": row.details,
        "timestamp": row.timestamp,
        "read": row.read or False,
    }


def row_to_inbox_message(row) -> dict:
    return {
        "id": row.id,
        "senderId": row.sender_id,
        "recipientId": getattr(row, "recipient_id", None),
        "text": row.text,
        "attachments": row.attachments or [],
        "createdAt": row.created_at,
        "read": row.read or False,
    }


def row_to_client(row) -> dict:
    return {
        "id": row.id,
        "name": row.name,
        "contactPerson": row.contact_person,
        "phone": row.phone,
        "email": row.email,
        "telegram": row.telegram,
        "instagram": row.instagram,
        "companyName": row.company_name,
        "companyInfo": row.company_info,
        "notes": row.notes,
        "funnelId": row.funnel_id,
        "isArchived": row.is_archived or False,
    }


def row_to_deal(row) -> dict:
    amount = row.amount
    if amount and str(amount).replace(".", "").replace("-", "").isdigit():
        amount = float(amount)
    return {
        "id": row.id,
        "title": row.title,
        "clientId": row.client_id,
        "contactName": row.contact_name,
        "amount": amount,
        "currency": row.currency,
        "stage": row.stage,
        "funnelId": row.funnel_id,
        "source": row.source,
        "telegramChatId": row.telegram_chat_id,
        "telegramUsername": row.telegram_username,
        "assigneeId": row.assignee_id,
        "createdAt": row.created_at,
        "notes": row.notes,
        "projectId": row.project_id,
        "comments": row.comments or [],
        "isArchived": row.is_archived or False,
        "recurring": row.recurring or False,
        "number": row.number,
        "status": row.status,
        "description": row.description,
        "date": row.date,
        "dueDate": row.due_date,
        "paidAmount": float(row.paid_amount) if row.paid_amount and str(row.paid_amount).replace(".", "").isdigit() else row.paid_amount,
        "paidDate": row.paid_date,
        "startDate": row.start_date,
        "endDate": row.end_date,
        "paymentDay": int(row.payment_day) if row.payment_day and str(row.payment_day).isdigit() else row.payment_day,
        "updatedAt": row.updated_at,
    }


def row_to_employee(row) -> dict:
    return {
        "id": row.id,
        "userId": row.user_id,
        "departmentId": row.department_id,
        "position": row.position,
        "hireDate": row.hire_date,
        "birthDate": row.birth_date,
        "isArchived": row.is_archived or False,
    }


def row_to_accounts_receivable(row) -> dict:
    return {
        "id": row.id,
        "clientId": row.client_id,
        "dealId": row.deal_id,
        "amount": float(row.amount) if row.amount and str(row.amount).replace(".", "").isdigit() else row.amount,
        "currency": row.currency,
        "dueDate": row.due_date,
        "status": row.status,
        "description": row.description,
        "paidAmount": float(row.paid_amount) if row.paid_amount and str(row.paid_amount).replace(".", "").isdigit() else row.paid_amount,
        "paidDate": row.paid_date,
        "createdAt": row.created_at,
        "updatedAt": row.updated_at,
        "isArchived": row.is_archived or False,
    }


def _str_bool(val) -> bool:
    if val is None:
        return False
    return str(val).lower() in ("true", "1", "yes")


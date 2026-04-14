"""Utility functions."""
from __future__ import annotations

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


def row_to_user(row, role=None, include_permissions: bool = False, include_calendar_export: bool = False) -> dict:
    """Convert User model to frontend format. role — модель Role при наличии."""
    from app.core.permissions import effective_permissions_for_role_response

    d = {
        "id": row.id,
        "name": row.name,
        "roleId": row.role_id,
        "avatar": row.avatar,
        "login": row.login,
        "email": row.email,
        "phone": row.phone,
        "telegram": row.telegram,
        "telegramUserId": row.telegram_user_id,
        "isArchived": row.is_archived,
        "mustChangePassword": row.must_change_password,
    }
    if role is not None:
        d["roleSlug"] = getattr(role, "slug", None)
        d["roleName"] = getattr(role, "name", None)
        if include_permissions:
            d["permissions"] = effective_permissions_for_role_response(
                getattr(role, "slug", None),
                getattr(role, "permissions", None),
            )
        else:
            d["permissions"] = []
        # Совместимость со старым полем role (ADMIN / EMPLOYEE)
        slug = getattr(role, "slug", None) or ""
        d["role"] = "ADMIN" if slug == "admin" else "EMPLOYEE"
    else:
        d["roleSlug"] = None
        d["roleName"] = None
        d["permissions"] = []
        d["role"] = "EMPLOYEE"
    if include_calendar_export:
        tok = getattr(row, "calendar_export_token", None)
        d["calendarExportToken"] = tok
        from app.core.config import get_settings

        s = get_settings()
        base = (s.PUBLIC_BASE_URL or "").rstrip("/")
        if tok and base:
            d["calendarExportUrl"] = f"{base}{s.API_PREFIX}/calendar/feed/{tok}.ics"
        else:
            d["calendarExportUrl"] = None
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
        "isPublic": bool(getattr(row, "is_public", False)),
    }


def row_to_status(row) -> dict:
    return {
        "id": row.id,
        "name": row.name,
        "color": row.color,
        "isArchived": bool(getattr(row, "is_archived", False)),
    }


def row_to_priority(row) -> dict:
    return {
        "id": row.id,
        "name": row.name,
        "color": row.color,
        "isArchived": bool(getattr(row, "is_archived", False)),
    }


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
    body = getattr(row, "body", None)
    if body is None:
        body = getattr(row, "text", None) or ""
    is_read = getattr(row, "is_read", None)
    if is_read is None:
        is_read = bool(getattr(row, "read", False))
    return {
        "id": row.id,
        "senderId": row.sender_id,
        "recipientId": getattr(row, "recipient_id", None),
        "text": body,
        "body": body,
        "attachments": row.attachments or [],
        "createdAt": row.created_at,
        "read": bool(is_read),
        "isRead": bool(is_read),
        "dealId": getattr(row, "deal_id", None),
        "funnelId": getattr(row, "funnel_id", None),
        "direction": getattr(row, "direction", None) or "internal",
        "channel": getattr(row, "channel", None) or "internal",
        "mediaUrl": getattr(row, "media_url", None),
        "externalMsgId": getattr(row, "external_msg_id", None),
    }


def row_to_client(row) -> dict:
    tags = list(row.tags) if getattr(row, "tags", None) is not None else []
    return {
        "id": row.id,
        "name": row.name,
        "phone": row.phone,
        "email": row.email,
        "telegram": row.telegram,
        "instagram": row.instagram,
        "companyName": row.company_name,
        "notes": row.notes,
        "tags": tags,
        "isArchived": row.is_archived or False,
    }


def _legacy_telegram_username(custom_fields) -> str | None:
    if not isinstance(custom_fields, dict):
        return None
    leg = custom_fields.get("_legacy")
    if isinstance(leg, dict):
        u = leg.get("telegram_username")
        return str(u) if u is not None else None
    return None


def row_to_deal(row) -> dict:
    amount = row.amount
    if amount is not None:
        try:
            amount = float(amount)
        except (TypeError, ValueError):
            amount = 0.0
    else:
        amount = 0.0
    sch = getattr(row, "source_chat_id", None)
    tags = list(row.tags) if getattr(row, "tags", None) is not None else []
    cf = row.custom_fields if isinstance(getattr(row, "custom_fields", None), dict) else {}
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
        "sourceChatId": sch,
        "telegramChatId": sch,
        "telegramUsername": _legacy_telegram_username(cf),
        "tags": tags,
        "customFields": cf,
        "lostReason": getattr(row, "lost_reason", None),
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


def deal_row_to_camel_read(row) -> "DealCamelRead":
    """Сделка для интеграций: тот же shape, что ``row_to_deal``, как Pydantic-модель."""
    from app.schemas.integrations import DealCamelRead

    d = dict(row_to_deal(row))
    for k in (
        "createdAt",
        "updatedAt",
        "paidDate",
        "dueDate",
        "date",
        "startDate",
        "endDate",
    ):
        v = d.get(k)
        if v is not None and hasattr(v, "isoformat"):
            d[k] = v.isoformat()
    return DealCamelRead.model_validate(d)


def row_to_employee(row) -> dict:
    pid = getattr(row, "org_position_id", None)
    fn = getattr(row, "full_name", None) or row.position or ""
    st = getattr(row, "status", None) or "active"
    return {
        "id": row.id,
        "userId": row.user_id,
        "departmentId": row.department_id,
        "positionId": pid,
        "orgPositionId": pid,
        "fullName": fn,
        "status": st,
        "isArchived": row.is_archived or False,
        "hireDate": row.hire_date,
        "birthDate": row.birth_date,
    }


def row_to_accounts_receivable(row) -> dict:
    from app.services.accounts_receivable_status import compute_ar_status_from_row_values

    status = compute_ar_status_from_row_values(row.amount, row.paid_amount, row.due_date)
    return {
        "id": row.id,
        "clientId": row.client_id,
        "dealId": row.deal_id,
        "amount": float(row.amount) if row.amount and str(row.amount).replace(".", "").isdigit() else row.amount,
        "currency": row.currency,
        "dueDate": row.due_date,
        "status": status,
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


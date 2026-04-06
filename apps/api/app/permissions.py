"""Каталог прав доступа и проверки для RBAC."""

from __future__ import annotations

import json
from typing import Any

# Полный доступ ко всему (одна роль «Администратор»)
FULL_ACCESS = "system.full_access"

# Ключи прав — группы для UI и проверок на бэкенде/фронте
PERMISSION_GROUPS: list[dict[str, Any]] = [
    {
        "id": "core",
        "label": "Рабочее пространство",
        "items": [
            {"key": "core.home", "label": "Рабочий стол"},
            {"key": "core.tasks", "label": "Задачи"},
            {"key": "core.inbox", "label": "Входящие"},
            {"key": "core.chat", "label": "Чат"},
            {"key": "core.search", "label": "Поиск"},
            {"key": "core.meetings", "label": "Встречи"},
            {"key": "core.docs", "label": "Документы"},
        ],
    },
    {
        "id": "crm",
        "label": "CRM и продажи",
        "items": [
            {"key": "crm.spaces", "label": "Пространства (таблицы)"},
            {"key": "crm.sales_funnel", "label": "Воронка продаж"},
            {"key": "crm.client_chats", "label": "Диалоги"},
            {"key": "crm.clients", "label": "Клиенты и договоры"},
        ],
    },
    {
        "id": "org",
        "label": "Организация",
        "items": [
            {"key": "org.inventory", "label": "Склад"},
            {"key": "org.employees", "label": "Сотрудники"},
            {"key": "org.bpm", "label": "Бизнес-процессы"},
        ],
    },
    {
        "id": "finance",
        "label": "Финансы",
        "items": [
            {"key": "finance.finance", "label": "Финансы (просмотр и операции)"},
            {"key": "finance.approve", "label": "Утверждение финансовых планов"},
        ],
    },
    {
        "id": "analytics",
        "label": "Аналитика",
        "items": [
            {"key": "analytics.analytics", "label": "Аналитика"},
        ],
    },
    {
        "id": "settings",
        "label": "Настройки",
        "items": [
            {"key": "settings.general", "label": "Общие настройки (страницы, модули, статусы…)"},
            {"key": "settings.integrations", "label": "Интеграции (Meta, Telegram, сайт…)"},
            {"key": "access.users", "label": "Управление пользователями"},
            {"key": "access.roles", "label": "Управление ролями и правами"},
        ],
    },
    {
        "id": "admin",
        "label": "Система",
        "items": [
            {"key": "system.full_access", "label": "Полный доступ ко всей системе"},
            {"key": "admin.system", "label": "Системная админка (БД, логи, тесты)"},
        ],
    },
]


def all_permission_keys() -> list[str]:
    keys: list[str] = []
    for g in PERMISSION_GROUPS:
        for it in g.get("items", []):
            keys.append(it["key"])
    return keys


def default_employee_permissions() -> list[str]:
    """Права роли «Сотрудник» по умолчанию (без админки, без утверждения финансов, без доступа к ролям)."""
    return [
        "core.home",
        "core.tasks",
        "core.inbox",
        "core.chat",
        "core.search",
        "core.meetings",
        "core.docs",
        "crm.spaces",
        "crm.sales_funnel",
        "crm.client_chats",
        "crm.clients",
        "org.inventory",
        "org.employees",
        "org.bpm",
        "finance.finance",
        "analytics.analytics",
        "settings.general",
    ]


def normalize_permissions(raw: Any) -> list[str]:
    if raw is None:
        return []
    if isinstance(raw, list):
        return [str(x) for x in raw if isinstance(x, str)]
    if isinstance(raw, str):
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, list):
                return [str(x) for x in parsed]
        except json.JSONDecodeError:
            return []
    return []


def role_has_permission(permissions: list[str] | None, permission: str) -> bool:
    if not permissions:
        return False
    if FULL_ACCESS in permissions:
        return True
    return permission in permissions

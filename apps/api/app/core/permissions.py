"""Каталог прав доступа и проверки для RBAC."""

from __future__ import annotations

import json
from typing import Any

# Полный доступ ко всему (одна роль «Администратор»)
FULL_ACCESS = "system.full_access"

# Канонические ключи для ``Depends(require_permission(...))`` (см. also PERMISSION_GROUPS).
PERM_TASKS_EDIT = "tasks.edit"
PERM_CRM_DEALS_EDIT = "crm.deals.edit"
# Доступ к воронке (карточки, стадии): POST/PATCH/DELETE одной сделки разрешены и с этим правом (см. deals router).
PERM_CRM_SALES_FUNNEL = "crm.sales_funnel"
PERM_FINANCE_APPROVE = "finance.approve"
PERM_ORG_EMPLOYEES_EDIT = "org.employees.edit"

# Ключи прав — группы для UI и проверок на бэкенде/фронте
PERMISSION_GROUPS: list[dict[str, Any]] = [
    {
        "id": "core",
        "label": "Рабочее пространство",
        "items": [
            {"key": "core.home", "label": "Рабочий стол"},
            {"key": "core.tasks", "label": "Задачи"},
            {"key": PERM_TASKS_EDIT, "label": "Редактирование задач (создание, изменение, удаление)"},
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
            {"key": PERM_CRM_DEALS_EDIT, "label": "Редактирование сделок (мутации, обход блокировок стадий)"},
        ],
    },
    {
        "id": "org",
        "label": "Организация",
        "items": [
            {"key": "org.inventory", "label": "Склад"},
            {"key": "org.employees", "label": "Сотрудники (просмотр)"},
            {"key": PERM_ORG_EMPLOYEES_EDIT, "label": "Редактирование сотрудников"},
            {"key": "org.bpm", "label": "Бизнес-процессы"},
            {"key": "org.production", "label": "Производство (маршруты и заказы)"},
        ],
    },
    {
        "id": "finance",
        "label": "Финансы",
        "items": [
            {"key": "finance.finance", "label": "Финансы (просмотр и операции)"},
            {"key": PERM_FINANCE_APPROVE, "label": "Утверждение финансовых планов и заявок"},
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


def effective_permissions_for_role_response(slug: str | None, raw_permissions: Any) -> list[str]:
    """
    Права для ответов API (``/me``, ``GET /roles``): без расхождений с фактическим доступом.

    - Роль с ``slug == "admin"`` — всегда **полный** список ``all_permission_keys()`` (админ имеет все права).
    - Иначе, если среди сохранённых прав есть ``system.full_access`` — тоже полный каталог.
    - Иначе — нормализованный список из БД (как хранится у роли).
    """
    catalog = all_permission_keys()
    s = (slug or "").strip().lower()
    if s == "admin":
        return list(catalog)
    perms = normalize_permissions(raw_permissions)
    if FULL_ACCESS in perms:
        return list(catalog)
    return list(perms)


def default_employee_permissions() -> list[str]:
    """Права роли «Сотрудник» по умолчанию (без админки, без утверждения финансов, без доступа к ролям)."""
    return [
        "core.home",
        "core.tasks",
        PERM_TASKS_EDIT,
        "core.inbox",
        "core.chat",
        "core.search",
        "core.meetings",
        "core.docs",
        "crm.spaces",
        "crm.sales_funnel",
        "crm.client_chats",
        "crm.clients",
        PERM_CRM_DEALS_EDIT,
        "org.inventory",
        "org.employees",
        PERM_ORG_EMPLOYEES_EDIT,
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

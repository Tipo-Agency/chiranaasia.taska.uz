#!/usr/bin/env python3
"""Seed database with demo data. Run after migrations."""
import asyncio
import os
import sys
from decimal import Decimal

# Add parent to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import select
from app.db import AsyncSessionLocal
from app.models.user import User

ADMIN_ROLE_ID = "00000000-0000-4000-8000-000000000001"
EMPLOYEE_ROLE_ID = "00000000-0000-4000-8000-000000000002"
from app.models.task import Task, Project
from app.models.settings import TableCollection, StatusOption, PriorityOption
from app.models.notification import NotificationPreferences as NPrefModel, AutomationRule as ARModel
from app.models.client import Client, Deal, EmployeeInfo, AccountsReceivable
from app.models.content import Doc, Folder, Meeting, ContentPost
from app.models.finance import Department, FinanceCategory, Fund, FinancePlan
from app.models.funnel import SalesFunnel


async def seed():
    async with AsyncSessionLocal() as db:
        # Check if already seeded
        r = await db.execute(select(User).limit(1))
        if r.scalar_one_or_none():
            print("DB already has data, skipping seed.")
            return

        now = __import__("datetime").datetime.utcnow().isoformat()
        demo_user_id = "demo-user"

        # Users
        users = [
            User(id=demo_user_id, name="Демо", role_id=ADMIN_ROLE_ID, login="demo", password_hash=None),
            User(id="u2", name="Анна Иванова", role_id=EMPLOYEE_ROLE_ID, login="anna", email="anna@example.com"),
            User(id="u3", name="Пётр Сидоров", role_id=EMPLOYEE_ROLE_ID, login="petr", email="petr@example.com"),
            User(id="u4", name="Мария Козлова", role_id=EMPLOYEE_ROLE_ID, login="maria", email="maria@example.com"),
            User(id="u5", name="Иван Новиков", role_id=EMPLOYEE_ROLE_ID, login="ivan", email="ivan@example.com"),
            User(id="u6", name="Елена Соколова", role_id=EMPLOYEE_ROLE_ID, login="elena", email="elena@example.com"),
        ]
        for u in users:
            db.add(u)

        # Tables
        tables = [
            TableCollection(id="t1", name="Задачи", type="tasks", icon="CheckSquare", color="text-blue-500"),
            TableCollection(
                id="t2",
                name="Контент-план",
                type="content-plan",
                icon="Instagram",
                color="text-pink-500",
                is_public=True,
            ),
            TableCollection(id="t3", name="Беклог", type="backlog", icon="Archive", color="text-amber-500"),
            TableCollection(id="t4", name="Функционал", type="functionality", icon="Layers", color="text-green-600"),
        ]
        for t in tables:
            db.add(t)

        # Statuses
        statuses = [
            StatusOption(id="s1", name="Не начато", color="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700"),
            StatusOption(id="s2", name="В работе", color="bg-blue-500 dark:bg-blue-600 text-white border border-blue-600 dark:border-blue-500"),
            StatusOption(id="s3", name="На проверке", color="bg-amber-500 dark:bg-amber-600 text-white border border-amber-600 dark:border-amber-500"),
            StatusOption(id="s4", name="Выполнено", color="bg-emerald-500 dark:bg-emerald-600 text-white border border-emerald-600 dark:border-emerald-500"),
        ]
        for s in statuses:
            db.add(s)

        # Priorities
        priorities = [
            PriorityOption(id="p1", name="Низкий", color="bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700"),
            PriorityOption(id="p2", name="Средний", color="bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700"),
            PriorityOption(id="p3", name="Высокий", color="bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-700"),
        ]
        for p in priorities:
            db.add(p)

        # Notification prefs (full structure)
        ns = {"telegramPersonal": True, "telegramGroup": False}
        default_prefs = {
            "newTask": ns, "statusChange": ns, "taskAssigned": ns, "taskComment": ns, "taskDeadline": ns,
            "docCreated": ns, "docUpdated": ns, "docShared": ns,
            "meetingCreated": ns, "meetingReminder": ns, "meetingUpdated": ns,
            "postCreated": ns, "postStatusChanged": ns,
            "purchaseRequestCreated": ns, "purchaseRequestStatusChanged": ns, "financePlanUpdated": ns,
            "dealCreated": ns, "dealStatusChanged": ns, "clientCreated": ns, "contractCreated": ns,
            "employeeCreated": ns, "employeeUpdated": ns,
            "processStarted": ns, "processStepCompleted": ns, "processStepRequiresApproval": ns,
        }
        db.add(NPrefModel(id="default", prefs=default_prefs))

        # Automation rules
        db.add(ARModel(id="rule-1", rule={
            "name": "Согласование договора", "isActive": True, "trigger": "status_change",
            "conditions": {"statusTo": "На проверке"},
            "action": {"type": "telegram_message", "targetUser": "admin"},
        }))

        # Departments (дерево: корень d0)
        depts = [
            Department(id="d0", name="Компания"),
            Department(id="d1", name="Отдел продаж", parent_id="d0"),
            Department(id="d2", name="Маркетинг", parent_id="d0"),
            Department(id="d3", name="Разработка", parent_id="d0"),
        ]
        for d in depts:
            db.add(d)

        # Projects
        projects = [
            Project(id="pr1", name="Сайт клиента А"),
            Project(id="pr2", name="Реклама в соцсетях"),
        ]
        for p in projects:
            db.add(p)

        # Finance categories
        for c in [
            ("fc1", "ФОТ (Зарплаты)", "percent", "40"), ("fc2", "Налоги", "percent", "12"),
            ("fc3", "Реклама", "percent", "15"), ("fc4", "Аренда офиса", "fixed", "5000000"),
            ("fc5", "Сервисы / Софт", "fixed", "1000000"), ("fc6", "Дивиденды", "percent", "10"),
        ]:
            db.add(FinanceCategory(id=c[0], name=c[1], type=c[2], value=c[3]))

        # Funds
        for f in [("fund-1", "Зарплаты", "1"), ("fund-2", "Закупки", "2"), ("fund-3", "Резерв", "3")]:
            db.add(Fund(id=f[0], name=f[1], order_val=f[2]))

        # Sales funnel
        db.add(SalesFunnel(
            id="f1",
            name="Продажи",
            stages=[
                {"id": "new", "label": "Новая заявка", "color": "bg-gray-200 dark:bg-gray-700"},
                {"id": "qualification", "label": "Квалификация", "color": "bg-blue-200 dark:bg-blue-900"},
                {"id": "proposal", "label": "Предложение (КП)", "color": "bg-purple-200 dark:bg-purple-900"},
                {"id": "negotiation", "label": "Переговоры", "color": "bg-orange-200 dark:bg-orange-900"},
            ],
        ))

        # Clients
        client_data = [
            ("ООО Ромашка", "Мария"), ("ИП Васильев", "Алексей"), ("ЧП Текстиль Плюс", "Дилноза"),
            ("ООО Агро Сервис", "Сергей"), ("ИП Фотостудия", "Карина"), ("ООО СтройМаш", "Олег"),
        ]
        for i, (name, contact) in enumerate(client_data):
            db.add(
                Client(
                    id=f"c{i+1}",
                    name=name,
                    notes=f"Контактное лицо (архив): {contact}" if contact else None,
                    tags=[],
                )
            )

        # Deals (simplified)
        db.add(Deal(
            id="fdeal_1",
            title="Разработка корпоративного сайта",
            amount=Decimal("1500000"),
            currency="UZS",
            stage="new",
            funnel_id="f1",
            assignee_id=demo_user_id,
            created_at=now,
        ))

        # Employee infos
        emp_data = [
            (demo_user_id, "d1", "Руководитель"),
            ("u2", "d1", "Менеджер по продажам"),
            ("u3", "d1", "Менеджер"),
            ("u4", "d2", "Маркетолог"),
            ("u5", "d3", "Разработчик"),
        ]
        for i, (uid, dept_id, pos) in enumerate(emp_data):
            db.add(EmployeeInfo(id=f"emp{i+1}", user_id=uid, department_id=dept_id, position=pos, hire_date="2024-01-01"))

        # Tasks (sample)
        db.add(Task(
            id="task_1",
            table_id="t1",
            title="Подготовить КП по разработке сайта",
            status="В работе",
            priority="Высокий",
            assignee_id=demo_user_id,
            project_id="pr1",
            start_date="2025-02-20",
            end_date="2025-02-25",
            created_at=now,
        ))

        await db.commit()
        print("Seed completed.")


if __name__ == "__main__":
    asyncio.run(seed())

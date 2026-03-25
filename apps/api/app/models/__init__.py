"""SQLAlchemy models."""
from app.database import Base
from app.models.bpm import BusinessProcess, OrgPosition
from app.models.client import AccountsReceivable, Client, Deal, EmployeeInfo
from app.models.content import ContentPost, Doc, Folder, Meeting
from app.models.finance import (
    BankStatement,
    BankStatementLine,
    Bdr,
    Department,
    FinanceCategory,
    FinancePlan,
    FinancialPlanDocument,
    FinancialPlanning,
    Fund,
    IncomeReport,
    PurchaseRequest,
)
from app.models.funnel import SalesFunnel
from app.models.inventory import InventoryItem, InventoryRevision, StockMovement, Warehouse
from app.models.notification import (
    AutomationRule,
    Notification,
    NotificationArchive,
    NotificationDelivery,
    NotificationEvent,
    NotificationPreferences,
)
from app.models.settings import ActivityLog, InboxMessage, PriorityOption, StatusOption, TableCollection
from app.models.system_log import SystemLog
from app.models.task import Project, Task
from app.models.user import User
from app.models.weekly_plan import Protocol, WeeklyPlan

__all__ = [
    "Base",
    "User",
    "Task",
    "Project",
    "TableCollection",
    "StatusOption",
    "PriorityOption",
    "ActivityLog",
    "InboxMessage",
    "NotificationPreferences",
    "AutomationRule",
    "NotificationEvent",
    "Notification",
    "NotificationDelivery",
    "NotificationArchive",
    "Client",
    "Deal",
    "EmployeeInfo",
    "AccountsReceivable",
    "Doc",
    "Folder",
    "Meeting",
    "ContentPost",
    "Department",
    "FinanceCategory",
    "Fund",
    "FinancePlan",
    "PurchaseRequest",
    "FinancialPlanDocument",
    "FinancialPlanning",
    "BankStatement",
    "BankStatementLine",
    "IncomeReport",
    "Bdr",
    "OrgPosition",
    "BusinessProcess",
    "Warehouse",
    "InventoryItem",
    "StockMovement",
    "InventoryRevision",
    "SalesFunnel",
    "SystemLog",
    "WeeklyPlan",
    "Protocol",
]

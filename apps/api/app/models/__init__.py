"""SQLAlchemy models."""
from app.database import Base
from app.models.user import User
from app.models.task import Task, Project
from app.models.settings import TableCollection, StatusOption, PriorityOption, ActivityLog, InboxMessage
from app.models.notification import NotificationPreferences, AutomationRule
from app.models.client import Client, Deal, EmployeeInfo, AccountsReceivable
from app.models.content import Doc, Folder, Meeting, ContentPost
from app.models.finance import Department, FinanceCategory, Fund, FinancePlan, PurchaseRequest
from app.models.finance import FinancialPlanDocument, FinancialPlanning
from app.models.finance import BankStatement, BankStatementLine, IncomeReport
from app.models.bpm import OrgPosition, BusinessProcess
from app.models.inventory import Warehouse, InventoryItem, StockMovement, InventoryRevision
from app.models.funnel import SalesFunnel
from app.models.site import PartnerLogo, News, Case, Tag
from app.models.system_log import SystemLog
from app.models.weekly_plan import WeeklyPlan, Protocol

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
    "OrgPosition",
    "BusinessProcess",
    "Warehouse",
    "InventoryItem",
    "StockMovement",
    "InventoryRevision",
    "SalesFunnel",
    "PartnerLogo",
    "News",
    "Case",
    "Tag",
    "SystemLog",
    "WeeklyPlan",
    "Protocol",
]

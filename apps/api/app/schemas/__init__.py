"""Re-export публичных Pydantic-схем (`from app.schemas import DealRead`, …)."""
from __future__ import annotations

from app.schemas.accounts_receivable import AccountsReceivableItem, AccountsReceivableRead
from app.schemas.auth_api import PermissionsCatalogResponse, RoleApiRow
from app.schemas.auth_session import AuthSessionResponse
from app.schemas.auth_users import AuthUserOut, UserBulkItem
from app.schemas.bp_api import BpInstanceResponse
from app.schemas.bpm_api import (
    BpInstanceRead,
    BpmStepRead,
    BusinessProcessRead,
    OrgPositionRead,
)
from app.schemas.bpm_bulk import BusinessProcessBulkItem, OrgPositionItem
from app.schemas.clients import (
    ClientBulkItem,
    ClientCreate,
    ClientListResponse,
    ClientRead,
    ClientUpdate,
)
from app.schemas.common_responses import (
    IdOkResponse,
    MessageCreateResponse,
    OkResponse,
    OkWithIdResponse,
    PresignedUrlResponse,
    PublicHealthResponse,
    SystemPublicHealthResponse,
)
from app.schemas.content import (
    ActivityLogCreate,
    ActivityLogItem,
    ActivityLogRead,
    ContentPostItem,
    ContentPostRead,
    DocItem,
    DocRead,
)
from app.schemas.deals import DealBulkItem, DealCreate, DealListResponse, DealRead, DealUpdate
from app.schemas.employees import (
    EmployeeBulkItem,
    EmployeeCreate,
    EmployeeListResponse,
    EmployeeRead,
    EmployeeUpdate,
)
from app.schemas.finance_bulk import (
    BankStatementItem,
    FinanceCategoryItem,
    FinancialPlanDocItem,
    FinancialPlanningItem,
    IncomeReportItem,
)
from app.schemas.finance_requests import FinanceRequestRead
from app.schemas.funnels import (
    FunnelBulkItem,
    FunnelCreateBody,
    FunnelPatchBody,
    FunnelRead,
    FunnelSourcesRoot,
    FunnelStageItem,
)
from app.schemas.integrations import IntegrationDealSendBody
from app.schemas.inventory import (
    InventoryItemSchema,
    InventoryRevisionItem,
    StockMovementItem,
    WarehouseItem,
)
from app.schemas.meetings import MeetingBulkItem, MeetingRead
from app.schemas.messages import MessageListResponse
from app.schemas.meta_webhook import MetaWebhookJsonResponse
from app.schemas.pagination import PaginatedResponse
from app.schemas.settings import (
    AutomationRuleItem,
    AutomationRuleRead,
    DepartmentItem,
    DepartmentRead,
    FolderItem,
    FolderRead,
    PriorityOptionItem,
    ProjectItem,
    ProjectRead,
    StatusOptionItem,
    TableItem,
    TableRead,
)
from app.schemas.tasks import TaskRead

__all__ = [
    "AccountsReceivableItem",
    "AccountsReceivableRead",
    "ActivityLogCreate",
    "ActivityLogItem",
    "ActivityLogRead",
    "AuthSessionResponse",
    "AuthUserOut",
    "AutomationRuleItem",
    "AutomationRuleRead",
    "BankStatementItem",
    "BpInstanceRead",
    "BpInstanceResponse",
    "BpmStepRead",
    "BusinessProcessBulkItem",
    "BusinessProcessRead",
    "ClientBulkItem",
    "ClientCreate",
    "ClientListResponse",
    "ClientRead",
    "ClientUpdate",
    "ContentPostItem",
    "ContentPostRead",
    "DealBulkItem",
    "DealCreate",
    "DealListResponse",
    "DealRead",
    "DealUpdate",
    "DepartmentItem",
    "DepartmentRead",
    "DocItem",
    "DocRead",
    "EmployeeBulkItem",
    "EmployeeCreate",
    "EmployeeListResponse",
    "EmployeeRead",
    "EmployeeUpdate",
    "FinanceCategoryItem",
    "FinanceRequestRead",
    "FinancialPlanDocItem",
    "FinancialPlanningItem",
    "FolderItem",
    "FolderRead",
    "FunnelBulkItem",
    "FunnelCreateBody",
    "FunnelPatchBody",
    "FunnelRead",
    "FunnelSourcesRoot",
    "FunnelStageItem",
    "IdOkResponse",
    "IncomeReportItem",
    "IntegrationDealSendBody",
    "InventoryItemSchema",
    "InventoryRevisionItem",
    "MeetingBulkItem",
    "MeetingRead",
    "MessageCreateResponse",
    "MessageListResponse",
    "MetaWebhookJsonResponse",
    "OkResponse",
    "OkWithIdResponse",
    "OrgPositionItem",
    "OrgPositionRead",
    "PaginatedResponse",
    "PermissionsCatalogResponse",
    "PresignedUrlResponse",
    "PriorityOptionItem",
    "ProjectItem",
    "ProjectRead",
    "PublicHealthResponse",
    "RoleApiRow",
    "StatusOptionItem",
    "StockMovementItem",
    "SystemPublicHealthResponse",
    "TableItem",
    "TableRead",
    "TaskRead",
    "UserBulkItem",
    "WarehouseItem",
]

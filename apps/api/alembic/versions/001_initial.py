"""Initial schema

Revision ID: 001
Revises:
Create Date: 2025-02-23

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("role", sa.String(20), server_default="EMPLOYEE"),
        sa.Column("avatar", sa.String(500)),
        sa.Column("login", sa.String(100), unique=True),
        sa.Column("email", sa.String(255)),
        sa.Column("phone", sa.String(50)),
        sa.Column("telegram", sa.String(100)),
        sa.Column("telegram_user_id", sa.String(50)),
        sa.Column("password_hash", sa.String(255)),
        sa.Column("must_change_password", sa.Boolean(), server_default="false"),
        sa.Column("is_archived", sa.Boolean(), server_default="false"),
    )

    op.create_table(
        "projects",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("icon", sa.String(50)),
        sa.Column("color", sa.String(50)),
        sa.Column("is_archived", sa.Boolean(), server_default="false"),
    )

    op.create_table(
        "tasks",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("table_id", sa.String(36)),
        sa.Column("entity_type", sa.String(30), server_default="task"),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("status", sa.String(100), nullable=False),
        sa.Column("priority", sa.String(100), nullable=False),
        sa.Column("assignee_id", sa.String(36)),
        sa.Column("project_id", sa.String(36)),
        sa.Column("start_date", sa.String(10)),
        sa.Column("end_date", sa.String(10)),
        sa.Column("description", sa.Text()),
        sa.Column("is_archived", sa.Boolean(), server_default="false"),
        sa.Column("comments", postgresql.JSONB(), server_default="[]"),
        sa.Column("attachments", postgresql.JSONB(), server_default="[]"),
        sa.Column("content_post_id", sa.String(36)),
        sa.Column("process_id", sa.String(36)),
        sa.Column("process_instance_id", sa.String(36)),
        sa.Column("step_id", sa.String(36)),
        sa.Column("deal_id", sa.String(36)),
        sa.Column("source", sa.String(100)),
        sa.Column("category", sa.String(100)),
        sa.Column("task_id", sa.String(36)),
        sa.Column("created_by_user_id", sa.String(36)),
        sa.Column("created_at", sa.String(30)),
        sa.Column("requester_id", sa.String(36)),
        sa.Column("department_id", sa.String(36)),
        sa.Column("category_id", sa.String(36)),
        sa.Column("amount", sa.String(50)),
        sa.Column("decision_date", sa.String(30)),
        sa.Column("assignee_ids", postgresql.JSONB(), server_default="[]"),
    )

    op.create_table(
        "tables",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("type", sa.String(50), nullable=False),
        sa.Column("icon", sa.String(50), nullable=False),
        sa.Column("color", sa.String(50)),
        sa.Column("is_system", sa.Boolean(), server_default="false"),
        sa.Column("is_archived", sa.Boolean(), server_default="false"),
    )

    op.create_table(
        "statuses",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("color", sa.String(200), nullable=False),
    )

    op.create_table(
        "priorities",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("color", sa.String(200), nullable=False),
    )

    op.create_table(
        "activity",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), nullable=False),
        sa.Column("user_name", sa.String(255), nullable=False),
        sa.Column("user_avatar", sa.String(500)),
        sa.Column("action", sa.String(255), nullable=False),
        sa.Column("details", sa.Text()),
        sa.Column("timestamp", sa.String(30), nullable=False),
        sa.Column("read", sa.Boolean(), server_default="false"),
    )

    op.create_table(
        "notification_prefs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("prefs", postgresql.JSONB(), nullable=False),
        sa.Column("default_funnel_id", sa.String(36)),
        sa.Column("telegram_group_chat_id", sa.String(50)),
    )

    op.create_table(
        "automation_rules",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("rule", postgresql.JSONB(), nullable=False),
    )

    op.create_table(
        "clients",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("contact_person", sa.String(255)),
        sa.Column("phone", sa.String(50)),
        sa.Column("email", sa.String(255)),
        sa.Column("telegram", sa.String(100)),
        sa.Column("instagram", sa.String(255)),
        sa.Column("company_name", sa.String(255)),
        sa.Column("company_info", sa.Text()),
        sa.Column("notes", sa.Text()),
        sa.Column("funnel_id", sa.String(36)),
        sa.Column("is_archived", sa.Boolean(), server_default="false"),
    )

    op.create_table(
        "deals",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("client_id", sa.String(36)),
        sa.Column("contact_name", sa.String(255)),
        sa.Column("amount", sa.String(50), server_default="0"),
        sa.Column("currency", sa.String(10), server_default="UZS"),
        sa.Column("stage", sa.String(100), nullable=False),
        sa.Column("funnel_id", sa.String(36)),
        sa.Column("source", sa.String(50)),
        sa.Column("telegram_chat_id", sa.String(50)),
        sa.Column("telegram_username", sa.String(100)),
        sa.Column("assignee_id", sa.String(36), nullable=False),
        sa.Column("created_at", sa.String(30), nullable=False),
        sa.Column("notes", sa.Text()),
        sa.Column("project_id", sa.String(36)),
        sa.Column("comments", postgresql.JSONB(), server_default="[]"),
        sa.Column("is_archived", sa.Boolean(), server_default="false"),
        sa.Column("recurring", sa.Boolean(), server_default="false"),
        sa.Column("number", sa.String(100)),
        sa.Column("status", sa.String(30)),
        sa.Column("description", sa.Text()),
        sa.Column("date", sa.String(20)),
        sa.Column("due_date", sa.String(20)),
        sa.Column("paid_amount", sa.String(50)),
        sa.Column("paid_date", sa.String(20)),
        sa.Column("start_date", sa.String(20)),
        sa.Column("end_date", sa.String(20)),
        sa.Column("payment_day", sa.String(10)),
        sa.Column("updated_at", sa.String(30)),
    )

    op.create_table(
        "employee_infos",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("user_id", sa.String(36), nullable=False),
        sa.Column("department_id", sa.String(36)),
        sa.Column("position", sa.String(255), nullable=False),
        sa.Column("hire_date", sa.String(20), nullable=False),
        sa.Column("birth_date", sa.String(20)),
        sa.Column("is_archived", sa.Boolean(), server_default="false"),
    )

    op.create_table(
        "accounts_receivable",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("client_id", sa.String(36), nullable=False),
        sa.Column("deal_id", sa.String(36), nullable=False),
        sa.Column("amount", sa.String(50), nullable=False),
        sa.Column("currency", sa.String(10), nullable=False),
        sa.Column("due_date", sa.String(20), nullable=False),
        sa.Column("status", sa.String(30), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("paid_amount", sa.String(50)),
        sa.Column("paid_date", sa.String(20)),
        sa.Column("created_at", sa.String(30), nullable=False),
        sa.Column("updated_at", sa.String(30)),
        sa.Column("is_archived", sa.Boolean(), server_default="false"),
    )

    op.create_table(
        "docs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("table_id", sa.String(36)),
        sa.Column("folder_id", sa.String(36)),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("type", sa.String(20), nullable=False),
        sa.Column("url", sa.String(1000)),
        sa.Column("content", sa.Text()),
        sa.Column("tags", postgresql.JSONB(), server_default="[]"),
        sa.Column("is_archived", sa.Boolean(), server_default="false"),
    )

    op.create_table(
        "folders",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("table_id", sa.String(36), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("parent_folder_id", sa.String(36)),
        sa.Column("is_archived", sa.Boolean(), server_default="false"),
    )

    op.create_table(
        "meetings",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("table_id", sa.String(36)),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("date", sa.String(20), nullable=False),
        sa.Column("time", sa.String(10), nullable=False),
        sa.Column("participant_ids", postgresql.JSONB(), server_default="[]"),
        sa.Column("summary", sa.Text()),
        sa.Column("type", sa.String(20), server_default="work"),
        sa.Column("deal_id", sa.String(36)),
        sa.Column("client_id", sa.String(36)),
        sa.Column("recurrence", sa.String(20), server_default="none"),
        sa.Column("is_archived", sa.Boolean(), server_default="false"),
    )

    op.create_table(
        "content_posts",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("table_id", sa.String(36)),
        sa.Column("topic", sa.String(500), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("date", sa.String(20), nullable=False),
        sa.Column("platform", postgresql.JSONB(), server_default="[]"),
        sa.Column("format", sa.String(20), server_default="post"),
        sa.Column("status", sa.String(30), server_default="idea"),
        sa.Column("copy", sa.Text()),
        sa.Column("media_url", sa.String(500)),
        sa.Column("is_archived", sa.Boolean(), server_default="false"),
    )

    op.create_table(
        "departments",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("head_id", sa.String(36)),
        sa.Column("description", sa.String(500)),
    )

    op.create_table(
        "finance_categories",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("type", sa.String(20), nullable=False),
        sa.Column("value", sa.String(50)),
        sa.Column("color", sa.String(100)),
    )

    op.create_table(
        "funds",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("order_val", sa.String(10), server_default="0"),
        sa.Column("is_archived", sa.Boolean(), server_default="false"),
    )

    op.create_table(
        "finance_plan",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("period", sa.String(20), nullable=False),
        sa.Column("sales_plan", sa.String(50), nullable=False),
        sa.Column("current_income", sa.String(50), server_default="0"),
    )

    op.create_table(
        "purchase_requests",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("requester_id", sa.String(36), nullable=False),
        sa.Column("department_id", sa.String(36), nullable=False),
        sa.Column("category_id", sa.String(36), nullable=False),
        sa.Column("amount", sa.String(50), nullable=False),
        sa.Column("description", sa.String(500), nullable=False),
        sa.Column("status", sa.String(30), nullable=False),
        sa.Column("date", sa.String(20), nullable=False),
        sa.Column("decision_date", sa.String(20)),
        sa.Column("is_archived", sa.Boolean(), server_default="false"),
    )

    op.create_table(
        "financial_plan_documents",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("department_id", sa.String(36), nullable=False),
        sa.Column("period", sa.String(10), nullable=False),
        sa.Column("income", sa.String(50), nullable=False),
        sa.Column("expenses", postgresql.JSONB(), server_default="{}"),
        sa.Column("status", sa.String(30), nullable=False),
        sa.Column("created_at", sa.String(30), nullable=False),
        sa.Column("updated_at", sa.String(30)),
        sa.Column("approved_by", sa.String(36)),
        sa.Column("approved_at", sa.String(30)),
        sa.Column("is_archived", sa.Boolean(), server_default="false"),
    )

    op.create_table(
        "financial_plannings",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("department_id", sa.String(36), nullable=False),
        sa.Column("period", sa.String(10), nullable=False),
        sa.Column("plan_document_id", sa.String(36)),
        sa.Column("income", sa.String(50)),
        sa.Column("fund_allocations", postgresql.JSONB(), server_default="{}"),
        sa.Column("request_fund_ids", postgresql.JSONB(), server_default="{}"),
        sa.Column("request_ids", postgresql.JSONB(), server_default="[]"),
        sa.Column("status", sa.String(30), nullable=False),
        sa.Column("created_at", sa.String(30), nullable=False),
        sa.Column("updated_at", sa.String(30)),
        sa.Column("approved_by", sa.String(36)),
        sa.Column("approved_at", sa.String(30)),
        sa.Column("notes", sa.String(500)),
        sa.Column("is_archived", sa.Boolean(), server_default="false"),
    )

    op.create_table(
        "org_positions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("department_id", sa.String(36)),
        sa.Column("manager_position_id", sa.String(36)),
        sa.Column("holder_user_id", sa.String(36)),
        sa.Column("order_val", sa.String(10), server_default="0"),
    )

    op.create_table(
        "business_processes",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("version", sa.String(10), server_default="1"),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.String(500)),
        sa.Column("steps", postgresql.JSONB(), server_default="[]"),
        sa.Column("instances", postgresql.JSONB(), server_default="[]"),
        sa.Column("is_archived", sa.String(10), server_default="false"),
        sa.Column("created_at", sa.String(30)),
        sa.Column("updated_at", sa.String(30)),
    )

    op.create_table(
        "warehouses",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("department_id", sa.String(36)),
        sa.Column("location", sa.String(255)),
        sa.Column("is_default", sa.String(10), server_default="false"),
        sa.Column("is_archived", sa.String(10), server_default="false"),
    )

    op.create_table(
        "inventory_items",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("sku", sa.String(100), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("unit", sa.String(50), nullable=False),
        sa.Column("category", sa.String(100)),
        sa.Column("notes", sa.Text()),
        sa.Column("is_archived", sa.String(10), server_default="false"),
    )

    op.create_table(
        "stock_movements",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("type", sa.String(30), nullable=False),
        sa.Column("date", sa.String(20), nullable=False),
        sa.Column("from_warehouse_id", sa.String(36)),
        sa.Column("to_warehouse_id", sa.String(36)),
        sa.Column("items", postgresql.JSONB(), server_default="[]"),
        sa.Column("reason", sa.String(500)),
        sa.Column("created_by_user_id", sa.String(36), nullable=False),
    )

    op.create_table(
        "inventory_revisions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("number", sa.String(100), nullable=False),
        sa.Column("warehouse_id", sa.String(36), nullable=False),
        sa.Column("date", sa.String(20), nullable=False),
        sa.Column("status", sa.String(30), nullable=False),
        sa.Column("lines", postgresql.JSONB(), server_default="[]"),
        sa.Column("reason", sa.String(500)),
        sa.Column("created_by_user_id", sa.String(36), nullable=False),
        sa.Column("posted_at", sa.String(30)),
    )

    op.create_table(
        "sales_funnels",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("stages", postgresql.JSONB(), server_default="[]"),
        sa.Column("sources", postgresql.JSONB(), server_default="{}"),
        sa.Column("created_at", sa.String(30)),
        sa.Column("updated_at", sa.String(30)),
        sa.Column("is_archived", sa.String(10), server_default="false"),
    )

    op.create_table(
        "partner_logos",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("logo_url", sa.String(500), nullable=False),
        sa.Column("website_url", sa.String(500)),
        sa.Column("order_val", sa.String(10), server_default="0"),
        sa.Column("created_at", sa.String(30)),
        sa.Column("updated_at", sa.String(30)),
        sa.Column("is_archived", sa.String(10), server_default="false"),
    )

    op.create_table(
        "news",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("content", sa.Text()),
        sa.Column("image_url", sa.String(500)),
        sa.Column("excerpt", sa.String(500)),
        sa.Column("tags", postgresql.JSONB(), server_default="[]"),
        sa.Column("published", sa.String(10), server_default="false"),
        sa.Column("published_at", sa.String(30)),
        sa.Column("created_at", sa.String(30)),
        sa.Column("updated_at", sa.String(30)),
        sa.Column("is_archived", sa.String(10), server_default="false"),
    )

    op.create_table(
        "cases",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("image_url", sa.String(500)),
        sa.Column("excerpt", sa.String(500)),
        sa.Column("client_name", sa.String(255)),
        sa.Column("website_url", sa.String(500)),
        sa.Column("instagram_url", sa.String(500)),
        sa.Column("tags", postgresql.JSONB(), server_default="[]"),
        sa.Column("order_val", sa.String(10), server_default="0"),
        sa.Column("published", sa.String(10), server_default="false"),
        sa.Column("created_at", sa.String(30)),
        sa.Column("updated_at", sa.String(30)),
        sa.Column("is_archived", sa.String(10), server_default="false"),
    )

    op.create_table(
        "tags",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("color", sa.String(50)),
        sa.Column("created_at", sa.String(30)),
        sa.Column("updated_at", sa.String(30)),
        sa.Column("is_archived", sa.String(10), server_default="false"),
    )


def downgrade() -> None:
    for table in [
        "tags", "cases", "news", "partner_logos", "sales_funnels",
        "inventory_revisions", "stock_movements", "inventory_items", "warehouses",
        "business_processes", "org_positions",
        "financial_plannings", "financial_plan_documents", "purchase_requests",
        "finance_plan", "funds", "finance_categories", "departments",
        "content_posts", "meetings", "folders", "docs",
        "accounts_receivable", "employee_infos", "deals", "clients",
        "automation_rules", "notification_prefs", "activity",
        "priorities", "statuses", "tables", "tasks", "projects", "users",
    ]:
        op.drop_table(table)

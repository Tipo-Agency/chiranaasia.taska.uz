"""Производственные маршруты: пайплайны, заказы по этапам, передачи с приёмкой."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "054_production_routes"
down_revision = "053_crm_contacts"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "production_pipelines",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("color", sa.String(length=100), nullable=True),
        sa.Column("stages", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'[]'::jsonb")),
        sa.Column("created_at", sa.String(length=50), nullable=True),
        sa.Column("updated_at", sa.String(length=50), nullable=True),
        sa.Column("is_archived", sa.String(length=10), nullable=False, server_default=sa.text("'false'")),
    )
    op.create_table(
        "production_orders",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("pipeline_id", sa.String(length=36), sa.ForeignKey("production_pipelines.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("current_stage_id", sa.String(length=100), nullable=False),
        sa.Column("title", sa.String(length=500), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=30), nullable=False, server_default=sa.text("'open'")),
        sa.Column("created_at", sa.String(length=50), nullable=False),
        sa.Column("updated_at", sa.String(length=50), nullable=True),
        sa.Column("is_archived", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.create_index("ix_production_orders_pipeline_id", "production_orders", ["pipeline_id"])
    op.create_index("ix_production_orders_status", "production_orders", ["status"])
    op.create_table(
        "production_handoffs",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("order_id", sa.String(length=36), sa.ForeignKey("production_orders.id", ondelete="CASCADE"), nullable=False),
        sa.Column("from_stage_id", sa.String(length=100), nullable=False),
        sa.Column("to_stage_id", sa.String(length=100), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False, server_default=sa.text("'pending_accept'")),
        sa.Column("handed_over_by_user_id", sa.String(length=36), nullable=True),
        sa.Column("handed_over_at", sa.String(length=50), nullable=False),
        sa.Column("accepted_by_user_id", sa.String(length=36), nullable=True),
        sa.Column("accepted_at", sa.String(length=50), nullable=True),
        sa.Column("has_defects", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("defect_notes", sa.Text(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
    )
    op.create_index("ix_production_handoffs_order_id", "production_handoffs", ["order_id"])
    op.create_index("ix_production_handoffs_status", "production_handoffs", ["status"])


def downgrade() -> None:
    op.drop_index("ix_production_handoffs_status", table_name="production_handoffs")
    op.drop_index("ix_production_handoffs_order_id", table_name="production_handoffs")
    op.drop_table("production_handoffs")
    op.drop_index("ix_production_orders_status", table_name="production_orders")
    op.drop_index("ix_production_orders_pipeline_id", table_name="production_orders")
    op.drop_table("production_orders")
    op.drop_table("production_pipelines")

"""CRM: контакты (лица в компаниях) и связь сделки с контактом."""

from alembic import op
import sqlalchemy as sa


revision = "053_crm_contacts"
down_revision = "052_rbac_deals_edit_funnel"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "crm_contacts",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("client_id", sa.String(length=36), sa.ForeignKey("clients.id", ondelete="SET NULL"), nullable=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("phone", sa.String(length=50), nullable=True),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("telegram", sa.String(length=100), nullable=True),
        sa.Column("instagram", sa.String(length=255), nullable=True),
        sa.Column("job_title", sa.String(length=255), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("tags", sa.ARRAY(sa.Text()), nullable=False, server_default=sa.text("ARRAY[]::text[]")),
        sa.Column("is_archived", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.create_index("ix_crm_contacts_client_id", "crm_contacts", ["client_id"])
    op.add_column(
        "deals",
        sa.Column("contact_id", sa.String(length=36), sa.ForeignKey("crm_contacts.id", ondelete="SET NULL"), nullable=True),
    )
    op.create_index("ix_deals_contact_id", "deals", ["contact_id"])


def downgrade() -> None:
    op.drop_index("ix_deals_contact_id", table_name="deals")
    op.drop_column("deals", "contact_id")
    op.drop_index("ix_crm_contacts_client_id", table_name="crm_contacts")
    op.drop_table("crm_contacts")

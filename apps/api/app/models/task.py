"""Task and Project models."""
from sqlalchemy import Column, String, Boolean, Text, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from app.database import Base
import uuid


def gen_id():
    return str(uuid.uuid4())


class Project(Base):
    __tablename__ = "projects"

    id = Column(String(36), primary_key=True, default=gen_id)
    name = Column(String(255), nullable=False)
    icon = Column(String(50), nullable=True)
    color = Column(String(50), nullable=True)
    is_archived = Column(Boolean, default=False)


class Task(Base):
    __tablename__ = "tasks"

    id = Column(String(36), primary_key=True, default=gen_id)
    table_id = Column(String(36), nullable=True)
    entity_type = Column(String(30), default="task")  # task, idea, feature, purchase_request
    title = Column(String(500), nullable=False)
    status = Column(String(100), nullable=False)
    priority = Column(String(100), nullable=False)
    assignee_id = Column(String(36), nullable=True)
    project_id = Column(String(36), nullable=True)
    start_date = Column(String(10), nullable=True)
    end_date = Column(String(10), nullable=True)
    description = Column(Text, nullable=True)
    is_archived = Column(Boolean, default=False)
    comments = Column(JSONB, default=list)
    attachments = Column(JSONB, default=list)
    content_post_id = Column(String(36), nullable=True)
    process_id = Column(String(36), nullable=True)
    process_instance_id = Column(String(36), nullable=True)
    step_id = Column(String(36), nullable=True)
    deal_id = Column(String(36), nullable=True)
    source = Column(String(100), nullable=True)
    category = Column(String(100), nullable=True)
    task_id = Column(String(36), nullable=True)
    created_by_user_id = Column(String(36), nullable=True)
    created_at = Column(String(30), nullable=True)
    requester_id = Column(String(36), nullable=True)
    department_id = Column(String(36), nullable=True)
    category_id = Column(String(36), nullable=True)
    amount = Column(String(50), nullable=True)  # stored as string for flexibility
    decision_date = Column(String(30), nullable=True)
    assignee_ids = Column(JSONB, default=list)

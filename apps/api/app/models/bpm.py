"""BPM models: OrgPosition, BusinessProcess, шаги, экземпляры процессов (bp_instances)."""
import uuid

from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from app.db import Base


def gen_id():
    return str(uuid.uuid4())


class OrgPosition(Base):
    __tablename__ = "org_positions"

    id = Column(String(36), primary_key=True, default=gen_id)
    title = Column(String(255), nullable=False)
    department_id = Column(String(36), nullable=True)
    manager_position_id = Column(String(36), nullable=True)
    holder_user_id = Column(String(36), nullable=True)
    order_val = Column(String(10), default="0")
    is_archived = Column(Boolean, default=False)
    task_assignee_mode = Column(String(20), default="round_robin")
    last_task_assignee_user_id = Column(String(36), nullable=True)


class BusinessProcess(Base):
    """Процесс: id, title, version (+ description, архив). Шаги — ``BusinessProcessStep``; экземпляры — ``BpInstance``."""

    __tablename__ = "business_processes"

    id = Column(String(36), primary_key=True, default=gen_id)
    version = Column(String(10), default="1")
    title = Column(String(255), nullable=False)
    description = Column(String(500), nullable=True)
    is_archived = Column(String(10), default="false")  # JSON compat
    created_at = Column(String(50), nullable=True)
    updated_at = Column(String(50), nullable=True)

    steps_rel = relationship(
        "BusinessProcessStep",
        back_populates="process",
        cascade="all, delete-orphan",
        order_by="BusinessProcessStep.position",
    )
    instances_rel = relationship(
        "BpInstance",
        back_populates="process",
        cascade="all, delete-orphan",
    )


class BpInstance(Base):
    """
    Экземпляр запущенного процесса.
    Завершённые (``status == completed``) на сервере не изменяются и не удаляются синхронизацией PUT.
    """

    __tablename__ = "bp_instances"

    id = Column(String(36), primary_key=True, default=gen_id)
    bp_id = Column(String(36), ForeignKey("business_processes.id", ondelete="CASCADE"), nullable=False)
    current_step_id = Column(String(36), nullable=True)
    status = Column(String(30), nullable=False)
    context = Column(JSONB, nullable=False, server_default=text("'{}'::jsonb"))

    process = relationship("BusinessProcess", back_populates="instances_rel")


class BusinessProcessStep(Base):
    """
    Шаг процесса (не JSONB).
    ``role`` — тип исполнителя: ``user`` | ``position`` (как assigneeType на клиенте).
    ``position`` — порядок в цепочке; ``assignee_id`` — user id или id должности в оргсхеме.
    """

    __tablename__ = "business_process_steps"

    id = Column(String(36), primary_key=True, default=gen_id)
    bp_id = Column(String(36), ForeignKey("business_processes.id", ondelete="CASCADE"), nullable=False)
    position = Column(Integer, nullable=False, default=0)
    role = Column(String(50), nullable=False, default="user")
    assignee_id = Column(String(36), nullable=True)
    title = Column(String(255), nullable=False)
    description = Column(String(500), nullable=True)
    step_type = Column(String(20), nullable=False, default="normal")
    next_step_id = Column(String(36), nullable=True)

    process = relationship("BusinessProcess", back_populates="steps_rel")
    branches_rel = relationship(
        "BusinessProcessStepBranch",
        back_populates="step",
        cascade="all, delete-orphan",
    )


class BusinessProcessStepBranch(Base):
    """Ветка для шага типа variant (отдельная строка, не JSONB на процессе)."""

    __tablename__ = "business_process_step_branches"

    id = Column(String(36), primary_key=True, default=gen_id)
    step_id = Column(String(36), ForeignKey("business_process_steps.id", ondelete="CASCADE"), nullable=False)
    label = Column(String(255), nullable=False)
    next_step_id = Column(String(36), nullable=False)

    step = relationship("BusinessProcessStep", back_populates="branches_rel")

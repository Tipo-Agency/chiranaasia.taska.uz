"""Weekly plan (недельный план сотрудника) and Protocol (протокол по планам)."""
from sqlalchemy import Column, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from app.database import Base
import uuid


def gen_id():
    return str(uuid.uuid4())


class WeeklyPlan(Base):
    """Недельный план сотрудника: выбранные задачи на неделю + заметки."""
    __tablename__ = "weekly_plans"

    id = Column(String(36), primary_key=True, default=gen_id)
    user_id = Column(String(36), nullable=False)  # чей план
    week_start = Column(String(10), nullable=False)  # понедельник недели YYYY-MM-DD
    task_ids = Column(JSONB, default=list)  # массив id задач, которые сотрудник вписал в план
    notes = Column(Text, nullable=True)  # произвольный текст плана
    created_at = Column(String(50), nullable=False)
    updated_at = Column(String(50), nullable=True)


class Protocol(Base):
    """Протокол: сводный документ по недельным планам выбранных сотрудников."""
    __tablename__ = "protocols"

    id = Column(String(36), primary_key=True, default=gen_id)
    title = Column(String(500), nullable=False)
    week_start = Column(String(10), nullable=False)  # неделя YYYY-MM-DD
    participant_ids = Column(JSONB, default=list)  # user_id сотрудников
    created_at = Column(String(50), nullable=False)
    updated_at = Column(String(50), nullable=True)

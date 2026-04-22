"""Один ряд настроек организации (брендинг для SPA и страницы входа)."""

from sqlalchemy import Column, String, Text
from sqlalchemy.dialects.postgresql import JSONB

from app.db import Base


class OrgSystemPrefs(Base):
    __tablename__ = "org_system_prefs"

    id = Column(String(32), primary_key=True)
    primary_color = Column(String(16), nullable=False, server_default="#F97316")
    logo_svg = Column(Text, nullable=True)
    logo_svg_dark = Column(Text, nullable=True)
    # Список строк: какие банки доступны при загрузке выписок (например ["kapital","tenge"]).
    enabled_statement_banks = Column(JSONB, nullable=True)

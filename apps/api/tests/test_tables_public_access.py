"""Публичный контент-план: is_public и отсутствие лишних полей в ответе."""

from __future__ import annotations

import os

# До импорта модулей приложения — минимальные переменные для Settings.
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@127.0.0.1:5432/test")
os.environ.setdefault("SECRET_KEY", "0" * 32)
os.environ.setdefault("REDIS_URL", "redis://127.0.0.1:6379/0")

import pytest
from fastapi import FastAPI, HTTPException, Request
from httpx import ASGITransport, AsyncClient
from sqlalchemy import JSON, MetaData
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.api.routers.tables import public_router
from app.core.api_errors import error_code_for_status, error_response, http_detail_to_message_and_details
from app.db import get_db
from app.models.content import ContentPost, ShootPlan
from app.models.settings import TableCollection


def _make_test_app() -> FastAPI:
    test_app = FastAPI()

    async def _http_exception_handler(request: Request, exc: HTTPException):
        msg, details = http_detail_to_message_and_details(exc.detail)
        return error_response(
            status_code=exc.status_code,
            error=error_code_for_status(exc.status_code),
            message=msg,
            request=request,
            details=details,
        )

    test_app.add_exception_handler(HTTPException, _http_exception_handler)
    test_app.include_router(public_router, prefix="/api")
    return test_app


def _sqlite_schema_metadata() -> MetaData:
    """Копия нужных таблиц с JSON вместо JSONB — SQLite не компилирует JSONB."""
    md = MetaData()
    for src in (TableCollection.__table__, ContentPost.__table__, ShootPlan.__table__):
        src.to_metadata(md)
    for tbl in md.tables.values():
        for col in tbl.columns:
            if isinstance(col.type, JSONB):
                col.type = JSON()
    return md


@pytest.fixture
async def public_plan_client():
    test_app = _make_test_app()
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    md = _sqlite_schema_metadata()
    async with engine.begin() as conn:
        await conn.run_sync(md.create_all)

    session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async def override_get_db():
        async with session_maker() as session:
            yield session

    test_app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=test_app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac, session_maker

    test_app.dependency_overrides.clear()
    await engine.dispose()


async def test_public_content_plan_403_when_private(public_plan_client):
    ac, session_maker = public_plan_client
    async with session_maker() as session:
        session.add(
            TableCollection(
                id="tab-private",
                name="Скрыто",
                type="content-plan",
                icon="Instagram",
                is_public=False,
            )
        )
        await session.commit()

    r = await ac.get("/api/tables/public/content-plan/tab-private")
    assert r.status_code == 403
    body = r.json()
    assert body.get("error") == "forbidden"


async def test_public_content_plan_200_empty_when_missing(public_plan_client):
    ac, _ = public_plan_client
    r = await ac.get("/api/tables/public/content-plan/missing-id")
    assert r.status_code == 200
    assert r.json() == {"table": None, "posts": [], "shootPlans": []}


async def test_public_content_plan_safe_json_shape(public_plan_client):
    ac, session_maker = public_plan_client
    async with session_maker() as session:
        session.add(
            TableCollection(
                id="tab-pub",
                name="План",
                type="content-plan",
                icon="Instagram",
                color="text-pink-500",
                is_public=True,
            )
        )
        session.add(
            ContentPost(
                id="cp1",
                table_id="tab-pub",
                topic="Тема",
                description="Описание",
                date="2026-04-01",
                platform=["instagram"],
                format="post",
                status="idea",
                copy="Текст",
                media_url="https://example.com/x.jpg",
            )
        )
        session.add(
            ShootPlan(
                id="sp1",
                table_id="tab-pub",
                title="Съёмка",
                date="2026-04-02",
                time="10:00",
                participant_ids=["u1"],
                items=[{"postId": "cp1"}],
                meeting_id="m1",
            )
        )
        await session.commit()

    r = await ac.get("/api/tables/public/content-plan/tab-pub")
    assert r.status_code == 200
    data = r.json()
    assert data["table"] == {
        "id": "tab-pub",
        "name": "План",
        "type": "content-plan",
        "icon": "Instagram",
        "color": "text-pink-500",
    }
    assert len(data["posts"]) == 1
    post = data["posts"][0]
    assert set(post.keys()) == {
        "id",
        "topic",
        "description",
        "date",
        "platform",
        "format",
        "status",
        "copy",
        "mediaUrl",
    }
    assert len(data["shootPlans"]) == 1
    sp = data["shootPlans"][0]
    assert set(sp.keys()) == {"id", "title", "date", "time", "items"}
    assert sp["items"] == [{"postId": "cp1"}]

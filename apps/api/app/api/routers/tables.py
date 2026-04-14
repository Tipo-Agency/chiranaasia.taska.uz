"""Tables router."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.mappers import row_to_table
from app.db import get_db
from app.models.content import ContentPost, ShootPlan
from app.models.settings import TableCollection
from app.schemas.common_responses import OkResponse
from app.schemas.settings import TableItem, TableRead
from app.schemas.tables_public import (
    PublicContentPlanResponse,
    PublicContentPostRead,
    PublicShootPlanRead,
    PublicTableRead,
)
from app.services.domain_events import log_entity_mutation

# Публичный маршрут — отдельный роутер без Depends (иначе глобальный deps сломает анонимный доступ).
public_router = APIRouter(prefix="/tables", tags=["tables"])
router = APIRouter(prefix="/tables", tags=["tables"], dependencies=[Depends(get_current_user)])


def _public_row_to_shoot_plan(row: ShootPlan) -> PublicShootPlanRead:
    raw_items = row.items or []
    items: list[dict[str, object]] = [x for x in raw_items if isinstance(x, dict)]
    return PublicShootPlanRead(
        id=row.id,
        title=row.title or "",
        date=row.date or "",
        time=row.time or "",
        items=items,
    )


def _public_row_to_post(row: ContentPost) -> PublicContentPostRead:
    pl = row.platform or []
    platforms = [str(x) for x in pl] if isinstance(pl, list) else []
    return PublicContentPostRead(
        id=row.id,
        topic=row.topic or "",
        description=row.description,
        date=row.date or "",
        platform=platforms,
        format=row.format or "",
        status=row.status or "",
        post_copy=getattr(row, "copy", None),
        mediaUrl=row.media_url,
    )


def _row_to_public_table(row: TableCollection) -> PublicTableRead:
    return PublicTableRead(
        id=row.id,
        name=row.name or "",
        type=row.type or "",
        icon=row.icon,
        color=row.color,
    )


@public_router.get("/public/content-plan/{table_id}", response_model=PublicContentPlanResponse)
async def get_public_content_plan(table_id: str, db: AsyncSession = Depends(get_db)):
    """
    Публичный контент-план по table_id (без авторизации).
    Только при is_public; иначе 403. Нет таблицы / архив — пустой ответ 200.
    """
    t = await db.get(TableCollection, table_id)
    if not t or (t.is_archived or False):
        return PublicContentPlanResponse(table=None, posts=[], shootPlans=[])
    if not (t.is_public or False):
        raise HTTPException(
            status_code=403,
            detail="Публичный доступ к этой таблице отключён",
        )
    posts_result = await db.execute(select(ContentPost).where(ContentPost.table_id == table_id))
    posts = [p for p in posts_result.scalars().all() if not (p.is_archived or False)]
    shoot_result = await db.execute(
        select(ShootPlan).where(ShootPlan.table_id == table_id, ShootPlan.is_archived.is_(False))
    )
    shoot_plans = [_public_row_to_shoot_plan(sp) for sp in shoot_result.scalars().all()]
    return PublicContentPlanResponse(
        table=_row_to_public_table(t),
        posts=[_public_row_to_post(p) for p in posts],
        shootPlans=shoot_plans,
    )


@router.get("", response_model=list[TableRead])
async def get_tables(
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(TableCollection))
    return [row_to_table(t) for t in result.scalars().all()]


@router.put("", response_model=OkResponse)
async def update_tables(tables: list[TableItem], db: AsyncSession = Depends(get_db)):
    for t in tables:
        tid = t.id
        existing = await db.get(TableCollection, tid)
        is_new = existing is None
        if existing:
            existing.name = t.name or existing.name
            existing.type = t.type or existing.type
            existing.icon = t.icon if t.icon is not None else existing.icon
            existing.color = t.color
            existing.is_system = t.isSystem
            existing.is_archived = t.isArchived
            existing.is_public = t.isPublic
        else:
            db.add(TableCollection(
                id=tid,
                name=t.name,
                type=t.type,
                icon=t.icon or "",
                color=t.color,
                is_system=t.isSystem,
                is_archived=t.isArchived,
                is_public=t.isPublic,
            ))
        await db.flush()
        row = await db.get(TableCollection, tid)
        await log_entity_mutation(
            db,
            event_type="table.created" if is_new else "table.updated",
            entity_type="table",
            entity_id=tid,
            source="tables-router",
            payload={"name": row.name if row else t.name, "type": row.type if row else t.type},
        )
    await db.commit()
    return {"ok": True}

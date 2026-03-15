"""Sites router - partner logos, news, cases, tags, public API."""
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.site import PartnerLogo, News, Case, Tag

router = APIRouter(prefix="/sites", tags=["sites"])


def _bool(val):
    return str(val).lower() in ("true", "1", "yes") if val else False


def row_to_logo(row):
    return {
        "id": row.id,
        "name": row.name,
        "logoUrl": row.logo_url,
        "websiteUrl": row.website_url,
        "order": int(row.order_val) if row.order_val and str(row.order_val).isdigit() else 0,
        "createdAt": row.created_at,
        "updatedAt": row.updated_at,
        "isArchived": _bool(row.is_archived),
    }


def row_to_news(row):
    return {
        "id": row.id,
        "title": row.title,
        "content": row.content,
        "imageUrl": row.image_url,
        "excerpt": row.excerpt,
        "tags": row.tags or [],
        "published": _bool(row.published),
        "publishedAt": row.published_at,
        "createdAt": row.created_at,
        "updatedAt": row.updated_at,
        "isArchived": _bool(row.is_archived),
    }


def row_to_case(row):
    return {
        "id": row.id,
        "title": row.title,
        "description": row.description,
        "imageUrl": row.image_url,
        "excerpt": row.excerpt,
        "clientName": row.client_name,
        "websiteUrl": row.website_url,
        "instagramUrl": row.instagram_url,
        "tags": row.tags or [],
        "order": int(row.order_val) if row.order_val and str(row.order_val).isdigit() else 0,
        "published": _bool(row.published),
        "createdAt": row.created_at,
        "updatedAt": row.updated_at,
        "isArchived": _bool(row.is_archived),
    }


def row_to_tag(row):
    return {
        "id": row.id,
        "name": row.name,
        "color": row.color,
        "createdAt": row.created_at,
        "updatedAt": row.updated_at,
        "isArchived": _bool(row.is_archived),
    }


# Partner logos
@router.get("/partner-logos")
async def get_partner_logos(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(PartnerLogo).where(PartnerLogo.is_archived != "true"))
    return [row_to_logo(l) for l in result.scalars().all()]


@router.put("/partner-logos")
async def update_partner_logos(logos: list[dict], db: AsyncSession = Depends(get_db)):
    for l in logos:
        lid = l.get("id")
        if not lid:
            continue
        existing = await db.get(PartnerLogo, lid)
        if existing:
            existing.name = l.get("name", existing.name)
            existing.logo_url = l.get("logoUrl", existing.logo_url)
            existing.website_url = l.get("websiteUrl")
            existing.order_val = str(l.get("order", 0))
            existing.is_archived = "true" if l.get("isArchived") else "false"
        else:
            db.add(PartnerLogo(
                id=lid,
                name=l.get("name", ""),
                logo_url=l.get("logoUrl", ""),
                website_url=l.get("websiteUrl"),
                order_val=str(l.get("order", 0)),
                is_archived="true" if l.get("isArchived") else "false",
            ))
    await db.commit()
    return {"ok": True}


# News
@router.get("/news")
async def get_news(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(News).where(News.is_archived != "true"))
    return [row_to_news(n) for n in result.scalars().all()]


@router.get("/news/published")
async def get_published_news(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(News).where(News.is_archived != "true", News.published == "true")
    )
    return [row_to_news(n) for n in result.scalars().all()]


@router.put("/news")
async def update_news(news_list: list[dict], db: AsyncSession = Depends(get_db)):
    for n in news_list:
        nid = n.get("id")
        if not nid:
            continue
        existing = await db.get(News, nid)
        if existing:
            existing.title = n.get("title", existing.title)
            existing.content = n.get("content")
            existing.image_url = n.get("imageUrl")
            existing.excerpt = n.get("excerpt")
            existing.tags = n.get("tags", existing.tags or [])
            existing.published = "true" if n.get("published") else "false"
            existing.published_at = n.get("publishedAt")
            existing.is_archived = "true" if n.get("isArchived") else "false"
        else:
            db.add(News(
                id=nid,
                title=n.get("title", ""),
                content=n.get("content"),
                image_url=n.get("imageUrl"),
                excerpt=n.get("excerpt"),
                tags=n.get("tags", []),
                published="true" if n.get("published") else "false",
                published_at=n.get("publishedAt"),
                is_archived="true" if n.get("isArchived") else "false",
            ))
    await db.commit()
    return {"ok": True}


# Cases
@router.get("/cases")
async def get_cases(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Case).where(Case.is_archived != "true"))
    return [row_to_case(c) for c in result.scalars().all()]


@router.get("/cases/published")
async def get_published_cases(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Case).where(Case.is_archived != "true", Case.published == "true")
    )
    return [row_to_case(c) for c in result.scalars().all()]


@router.put("/cases")
async def update_cases(cases: list[dict], db: AsyncSession = Depends(get_db)):
    for c in cases:
        cid = c.get("id")
        if not cid:
            continue
        existing = await db.get(Case, cid)
        if existing:
            existing.title = c.get("title", existing.title)
            existing.description = c.get("description")
            existing.image_url = c.get("imageUrl")
            existing.excerpt = c.get("excerpt")
            existing.client_name = c.get("clientName")
            existing.website_url = c.get("websiteUrl")
            existing.instagram_url = c.get("instagramUrl")
            existing.tags = c.get("tags", existing.tags or [])
            existing.order_val = str(c.get("order", 0))
            existing.published = "true" if c.get("published") else "false"
            existing.is_archived = "true" if c.get("isArchived") else "false"
        else:
            db.add(Case(
                id=cid,
                title=c.get("title", ""),
                description=c.get("description", ""),
                image_url=c.get("imageUrl"),
                excerpt=c.get("excerpt"),
                client_name=c.get("clientName"),
                website_url=c.get("websiteUrl"),
                instagram_url=c.get("instagramUrl"),
                tags=c.get("tags", []),
                order_val=str(c.get("order", 0)),
                published="true" if c.get("published") else "false",
                is_archived="true" if c.get("isArchived") else "false",
            ))
    await db.commit()
    return {"ok": True}


# Tags
@router.get("/tags")
async def get_tags(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Tag).where(Tag.is_archived != "true"))
    return [row_to_tag(t) for t in result.scalars().all()]


@router.put("/tags")
async def update_tags(tags: list[dict], db: AsyncSession = Depends(get_db)):
    for t in tags:
        tid = t.get("id")
        if not tid:
            continue
        existing = await db.get(Tag, tid)
        if existing:
            existing.name = t.get("name", existing.name)
            existing.color = t.get("color")
            existing.is_archived = "true" if t.get("isArchived") else "false"
        else:
            db.add(Tag(
                id=tid,
                name=t.get("name", ""),
                color=t.get("color"),
                is_archived="true" if t.get("isArchived") else "false",
            ))
    await db.commit()
    return {"ok": True}


# Public site data
@router.get("/public/site-data")
async def get_site_data(db: AsyncSession = Depends(get_db)):
    logos = await db.execute(select(PartnerLogo).where(PartnerLogo.is_archived != "true"))
    news = await db.execute(select(News).where(News.is_archived != "true", News.published == "true"))
    cases = await db.execute(select(Case).where(Case.is_archived != "true", Case.published == "true"))
    tags = await db.execute(select(Tag).where(Tag.is_archived != "true"))
    return {
        "partnerLogos": [row_to_logo(l) for l in logos.scalars().all()],
        "news": [row_to_news(n) for n in news.scalars().all()],
        "cases": [row_to_case(c) for c in cases.scalars().all()],
        "tags": [row_to_tag(t) for t in tags.scalars().all()],
    }

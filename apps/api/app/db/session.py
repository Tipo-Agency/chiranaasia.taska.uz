"""Database connection and session management."""
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import get_settings

settings = get_settings()

_connect_args: dict = {}
_ms = settings.DATABASE_STATEMENT_TIMEOUT_MS
if _ms is not None:
    _connect_args["server_settings"] = {"statement_timeout": str(_ms)}

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    connect_args=_connect_args,
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


class Base(DeclarativeBase):
    """Base class for all models."""
    pass


async def get_db():
    """Dependency for getting async database session."""
    # Ленивый импорт: иначе цикл app.db → domain_events → app.models → app.db (Alembic env падает).
    from app.services.domain_events import (
        DOMAIN_EVENTS_POST_COMMIT_QUEUE_KEY,
        POST_COMMIT_NOTIFICATION_JOBS_KEY,
        flush_pending_domain_stream_publish,
        flush_post_commit_notification_jobs,
    )

    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            session.info.pop(DOMAIN_EVENTS_POST_COMMIT_QUEUE_KEY, None)
            session.info.pop(POST_COMMIT_NOTIFICATION_JOBS_KEY, None)
            raise
        else:
            try:
                await flush_post_commit_notification_jobs(session)
                await flush_pending_domain_stream_publish(session)
                await session.commit()
            except Exception:
                await session.rollback()
                raise
        finally:
            await session.close()

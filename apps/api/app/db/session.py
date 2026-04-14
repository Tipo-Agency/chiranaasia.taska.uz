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
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

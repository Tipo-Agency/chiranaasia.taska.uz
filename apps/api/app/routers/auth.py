"""Auth router - login, users."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.database import get_db
from app.models.user import User
from app.auth import verify_password, get_password_hash, create_access_token
from app.services.domain_events import log_entity_mutation
from app.utils import row_to_user

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    login: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


@router.post("/login", response_model=LoginResponse)
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(User).where(
            ((func.lower(User.login) == func.lower(req.login)) | (User.name == req.login)),
            User.is_archived == False
        )
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid login or password")
    if user.password_hash:
        if not verify_password(req.password, user.password_hash):
            raise HTTPException(status_code=401, detail="Invalid login or password")
    else:
        if req.password and req.password != "":
            raise HTTPException(status_code=401, detail="Invalid login or password")
    token = create_access_token(data={"sub": user.id})
    return LoginResponse(access_token=token, user=row_to_user(user))


@router.get("/users")
async def get_users(db: AsyncSession = Depends(get_db)):
    # Возвращаем всех пользователей, включая архивных; фронт сам фильтрует по isArchived.
    result = await db.execute(select(User))
    users = result.scalars().all()
    return [row_to_user(u) for u in users]


@router.put("/users")
async def update_users(users: list[dict], db: AsyncSession = Depends(get_db)):
    from app.auth import get_password_hash
    from sqlalchemy import select

    for u in users:
        if u.get("isArchived"):
            existing = await db.get(User, u["id"])
            if existing:
                existing.is_archived = True
                await db.flush()
                await log_entity_mutation(
                    db,
                    event_type="user.archived",
                    entity_type="user",
                    entity_id=u["id"],
                    source="auth-router",
                    payload={"login": existing.login},
                )
            continue
        uid = u.get("id")
        existing = await db.get(User, uid) if uid else None

        # Если id нет, но есть логин — пробуем найти пользователя по логину (в т.ч. архивного)
        if not existing and not uid and u.get("login"):
            result = await db.execute(select(User).where(User.login == u["login"]))
            existing = result.scalar_one_or_none()

        if existing:
            existing.name = u.get("name", existing.name)
            existing.role = u.get("role", existing.role)
            existing.avatar = u.get("avatar")
            existing.login = u.get("login")
            existing.email = u.get("email")
            existing.phone = u.get("phone")
            existing.telegram = u.get("telegram")
            existing.telegram_user_id = u.get("telegramUserId")
            raw_password = u.get("password")
            # Если фронт прислал уже захешированный пароль (начинается с $2)
            if raw_password:
                if isinstance(raw_password, str) and raw_password.startswith("$2"):
                    existing.password_hash = raw_password
                else:
                    existing.password_hash = get_password_hash(raw_password)
            existing.must_change_password = bool(u.get("mustChangePassword", False))
            existing.is_archived = False
            await db.flush()
            await log_entity_mutation(
                db,
                event_type="user.updated",
                entity_type="user",
                entity_id=existing.id,
                source="auth-router",
                payload={"login": existing.login, "name": existing.name, "role": existing.role},
            )
        else:
            new_user = User(
                id=uid or __import__("uuid").uuid4().__str__(),
                name=u.get("name", ""),
                role=u.get("role", "EMPLOYEE"),
                login=u.get("login"),
                email=u.get("email"),
                phone=u.get("phone"),
                telegram=u.get("telegram"),
                telegram_user_id=u.get("telegramUserId"),
            )
            raw_password = u.get("password")
            if raw_password:
                if isinstance(raw_password, str) and raw_password.startswith("$2"):
                    new_user.password_hash = raw_password
                else:
                    new_user.password_hash = get_password_hash(raw_password)
            new_user.must_change_password = bool(u.get("mustChangePassword", False))
            db.add(new_user)
            await db.flush()
            await log_entity_mutation(
                db,
                event_type="user.created",
                entity_type="user",
                entity_id=new_user.id,
                source="auth-router",
                payload={"login": new_user.login, "name": new_user.name, "role": new_user.role},
            )
    await db.commit()
    return {"ok": True}

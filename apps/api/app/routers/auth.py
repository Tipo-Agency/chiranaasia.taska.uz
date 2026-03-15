"""Auth router - login, users."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.database import get_db
from app.models.user import User
from app.auth import verify_password, get_password_hash, create_access_token
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
    result = await db.execute(select(User).where(User.login == req.login, User.is_archived == False))
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
    result = await db.execute(select(User).where(User.is_archived == False))
    users = result.scalars().all()
    return [row_to_user(u) for u in users]


@router.put("/users")
async def update_users(users: list[dict], db: AsyncSession = Depends(get_db)):
    from app.auth import get_password_hash

    for u in users:
        if u.get("isArchived"):
            existing = await db.get(User, u["id"])
            if existing:
                existing.is_archived = True
            continue
        uid = u.get("id")
        existing = await db.get(User, uid) if uid else None
        if existing:
            existing.name = u.get("name", existing.name)
            existing.role = u.get("role", existing.role)
            existing.avatar = u.get("avatar")
            existing.login = u.get("login")
            existing.email = u.get("email")
            existing.phone = u.get("phone")
            existing.telegram = u.get("telegram")
            existing.telegram_user_id = u.get("telegramUserId")
            if u.get("password"):
                existing.password_hash = get_password_hash(u["password"])
            existing.must_change_password = u.get("mustChangePassword", False)
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
            if u.get("password"):
                new_user.password_hash = get_password_hash(u["password"])
            db.add(new_user)
    await db.commit()
    return {"ok": True}

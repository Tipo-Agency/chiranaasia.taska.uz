"""Auth router - login, users, roles (RBAC)."""
from __future__ import annotations

import re
import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import (
    create_access_token,
    get_current_user,
    get_password_hash,
    require_permission,
    verify_password,
)
from app.database import get_db
from app.models.role import Role
from app.models.user import User
from app.permissions import PERMISSION_GROUPS, all_permission_keys, normalize_permissions
from app.services.domain_events import log_entity_mutation
from app.services.rbac import count_users_with_role, user_has_permission
from app.utils import row_to_user

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    login: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


class RoleCreateBody(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    slug: str | None = Field(None, max_length=60)
    description: str | None = None
    permissions: list[str] = Field(default_factory=list)


class RolePatchBody(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=120)
    description: str | None = None
    permissions: list[str] | None = None
    sort_order: int | None = None


async def _load_roles_map(db: AsyncSession, role_ids: set[str]) -> dict[str, Role]:
    if not role_ids:
        return {}
    result = await db.execute(select(Role).where(Role.id.in_(role_ids)))
    return {r.id: r for r in result.scalars().all()}


async def _resolve_role_id(db: AsyncSession, u: dict) -> str | None:
    rid = u.get("roleId")
    if rid:
        return rid
    legacy = u.get("role")
    if legacy == "ADMIN":
        r = await db.execute(select(Role).where(Role.slug == "admin"))
        row = r.scalar_one_or_none()
        return row.id if row else None
    if legacy == "EMPLOYEE":
        r = await db.execute(select(Role).where(Role.slug == "employee"))
        row = r.scalar_one_or_none()
        return row.id if row else None
    return None


def _slugify(name: str) -> str:
    s = re.sub(r"[^\w\s-]", "", name, flags=re.UNICODE).strip().lower()
    s = re.sub(r"[-\s]+", "-", s)
    return s[:60] or "role"


@router.post("/login", response_model=LoginResponse)
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(User).where(
            ((func.lower(User.login) == func.lower(req.login)) | (User.name == req.login)),
            User.is_archived.is_(False),
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
    role = await db.get(Role, user.role_id) if user.role_id else None
    return LoginResponse(
        access_token=token,
        user=row_to_user(user, role, include_permissions=True, include_calendar_export=True),
    )


@router.get("/me")
async def get_me(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    role = await db.get(Role, current_user.role_id) if current_user.role_id else None
    return row_to_user(current_user, role, include_permissions=True, include_calendar_export=True)


@router.get("/permissions/catalog")
async def permissions_catalog(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not (
        await user_has_permission(db, current_user, "access.roles")
        or await user_has_permission(db, current_user, "access.users")
    ):
        raise HTTPException(status_code=403, detail="Permission denied")
    return {"groups": PERMISSION_GROUPS, "allKeys": all_permission_keys()}


@router.get("/roles")
async def list_roles(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not (
        await user_has_permission(db, current_user, "access.roles")
        or await user_has_permission(db, current_user, "access.users")
    ):
        raise HTTPException(status_code=403, detail="Permission denied")
    result = await db.execute(select(Role).order_by(Role.sort_order, Role.name))
    rows = result.scalars().all()
    return [
        {
            "id": r.id,
            "name": r.name,
            "slug": r.slug,
            "description": r.description,
            "isSystem": r.is_system,
            "sortOrder": r.sort_order,
            "permissions": normalize_permissions(r.permissions),
        }
        for r in rows
    ]


@router.post("/roles")
async def create_role(
    body: RoleCreateBody,
    _: User = Depends(require_permission("access.roles")),
    db: AsyncSession = Depends(get_db),
):
    slug = (body.slug or _slugify(body.name)).strip().lower()
    exists = await db.execute(select(Role).where(Role.slug == slug))
    if exists.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Роль с таким кодом уже есть")
    rid = str(uuid.uuid4())
    allowed = set(all_permission_keys())
    perms = [p for p in body.permissions if p in allowed]
    role = Role(
        id=rid,
        name=body.name.strip(),
        slug=slug,
        description=body.description,
        is_system=False,
        sort_order=100,
        permissions=perms,
    )
    db.add(role)
    await db.commit()
    return {"id": rid, "ok": True}


@router.patch("/roles/{role_id}")
async def patch_role(
    role_id: str,
    body: RolePatchBody,
    _: User = Depends(require_permission("access.roles")),
    db: AsyncSession = Depends(get_db),
):
    role = await db.get(Role, role_id)
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    if body.name is not None:
        role.name = body.name.strip()
    if body.description is not None:
        role.description = body.description
    if body.sort_order is not None:
        role.sort_order = body.sort_order
    if body.permissions is not None:
        allowed = set(all_permission_keys())
        role.permissions = [p for p in body.permissions if p in allowed]
    await db.commit()
    return {"ok": True}


@router.delete("/roles/{role_id}")
async def delete_role(
    role_id: str,
    _: User = Depends(require_permission("access.roles")),
    db: AsyncSession = Depends(get_db),
):
    role = await db.get(Role, role_id)
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    if role.is_system:
        raise HTTPException(status_code=400, detail="Системную роль нельзя удалить")
    n = await count_users_with_role(db, role_id)
    if n > 0:
        raise HTTPException(status_code=400, detail="На роль назначены пользователи")
    await db.delete(role)
    await db.commit()
    return {"ok": True}


@router.get("/users")
async def get_users(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User))
    users = result.scalars().all()
    role_ids = {u.role_id for u in users if u.role_id}
    rmap = await _load_roles_map(db, role_ids)
    return [row_to_user(u, rmap.get(u.role_id), include_permissions=False) for u in users]


@router.put("/users")
async def update_users(
    users: list[dict],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not await user_has_permission(db, current_user, "access.users"):
        raise HTTPException(status_code=403, detail="Permission denied")

    emp_fallback = await db.execute(select(Role).where(Role.slug == "employee"))
    employee_role = emp_fallback.scalar_one_or_none()

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

        if not existing and not uid and u.get("login"):
            result = await db.execute(select(User).where(User.login == u["login"]))
            existing = result.scalar_one_or_none()

        rid = await _resolve_role_id(db, u)
        if not rid and employee_role:
            rid = employee_role.id

        if existing:
            existing.name = u.get("name", existing.name)
            if rid:
                existing.role_id = rid
            existing.avatar = u.get("avatar")
            existing.login = u.get("login")
            existing.email = u.get("email")
            existing.phone = u.get("phone")
            existing.telegram = u.get("telegram")
            existing.telegram_user_id = u.get("telegramUserId")
            raw_password = u.get("password")
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
                payload={"login": existing.login, "name": existing.name, "role_id": existing.role_id},
            )
        else:
            new_user = User(
                id=uid or str(uuid.uuid4()),
                name=u.get("name", ""),
                role_id=rid or (employee_role.id if employee_role else None),
                login=u.get("login"),
                email=u.get("email"),
                phone=u.get("phone"),
                telegram=u.get("telegram"),
                telegram_user_id=u.get("telegramUserId"),
            )
            if not new_user.role_id:
                raise HTTPException(status_code=400, detail="Не задана роль пользователя")
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
                payload={"login": new_user.login, "name": new_user.name, "role_id": new_user.role_id},
            )
    await db.commit()
    return {"ok": True}

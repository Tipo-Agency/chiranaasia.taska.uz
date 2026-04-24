"""Auth router - login, users, roles (RBAC)."""
import re
import uuid

from fastapi import APIRouter, Body, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import (
    create_access_token,
    get_current_user,
    get_password_hash,
    looks_like_bcrypt_hash,
    require_any_permission,
    require_permission,
    verify_password,
)
from app.core.auth_cookies import clear_auth_cookies, set_auth_cookies
from app.core.config import get_settings
from app.core.json_http_cache import json_304_or_response
from app.core.mappers import row_to_user
from app.core.password_policy import assert_new_password_policy
from app.core.permissions import (
    PERMISSION_GROUPS,
    all_permission_keys,
    effective_permissions_for_role_response,
)
from app.core.rate_limit import limiter
from app.db import get_db
from app.models.role import Role
from app.models.user import User
from app.schemas.auth_api import PermissionsCatalogResponse, RoleApiRow
from app.schemas.auth_bodies import LoginRequest, LogoutRequest, RefreshRequest
from app.schemas.auth_session import AuthSessionResponse
from app.schemas.auth_users import AuthUserOut, UserBulkItem, UserSelfPatchBody
from app.schemas.common_responses import IdOkResponse, OkResponse
from app.services.audit_log import log_mutation
from app.services.auth_refresh import (
    issue_refresh_token,
    revoke_all_refresh_for_user,
    revoke_refresh_token,
    rotate_refresh_token,
)
from app.services.domain_events import log_entity_mutation
from app.services.login_throttle import is_login_locked, record_login_failure, reset_login_throttle
from app.services.rbac import count_users_with_role, user_has_permission

router = APIRouter(prefix="/auth", tags=["auth"])


def _request_id(request: Request) -> str | None:
    return getattr(request.state, "request_id", None)

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


async def _resolve_role_id(db: AsyncSession, u: UserBulkItem) -> str | None:
    rid = u.roleId
    if rid:
        return rid
    legacy = u.role
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


@router.post(
    "/login",
    response_model=AuthSessionResponse,
    responses={
        429: {
            "description": "Слишком много попыток с этого IP (5/мин, slowapi); см. Retry-After",
        },
    },
)
@limiter.limit("5/minute")
async def login(
    request: Request,
    req: LoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    lock_ttl = await is_login_locked(req.login)
    if lock_ttl is not None:
        raise HTTPException(
            status_code=429,
            detail=f"Слишком много попыток входа; повторите через {lock_ttl} с",
            headers={"Retry-After": str(lock_ttl)},
        )
    result = await db.execute(
        select(User).where(
            ((func.lower(User.login) == func.lower(req.login)) | (User.name == req.login)),
            User.is_archived.is_(False),
        )
    )
    user = result.scalar_one_or_none()
    if not user:
        await record_login_failure(req.login)
        raise HTTPException(status_code=401, detail="Invalid login or password")
    if user.password_hash:
        if not verify_password(req.password, user.password_hash):
            await record_login_failure(req.login)
            raise HTTPException(status_code=401, detail="Invalid login or password")
    else:
        if req.password and req.password != "":
            await record_login_failure(req.login)
            raise HTTPException(status_code=401, detail="Invalid login or password")
    await reset_login_throttle(req.login)
    token = create_access_token(data={"sub": user.id, "tv": user.token_version})
    raw_refresh, _ = await issue_refresh_token(db, user)
    set_auth_cookies(response, access_jwt=token, refresh_raw=raw_refresh)
    role = await db.get(Role, user.role_id) if user.role_id else None
    user_payload = row_to_user(user, role, include_permissions=True, include_calendar_export=True)
    return AuthSessionResponse(user=user_payload)


@router.get("/csrf", response_model=OkResponse)
async def auth_csrf_bootstrap(response: Response, _user: User = Depends(get_current_user)):
    """Выдать csrf_token cookie при наличии валидного access (после деплоя без повторного логина)."""
    from app.core.auth_cookies import set_csrf_cookie

    set_csrf_cookie(response)
    return {"ok": True}


@router.post("/refresh", response_model=AuthSessionResponse)
@limiter.limit("10/minute")
async def auth_refresh(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
    body: RefreshRequest = Body(default_factory=RefreshRequest),
):
    settings = get_settings()
    raw = None
    if body.refresh_token and body.refresh_token.strip():
        raw = body.refresh_token.strip()
    if not raw:
        c = request.cookies.get(settings.REFRESH_TOKEN_COOKIE_NAME)
        raw = (c or "").strip() or None
    if not raw:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")
    triple = await rotate_refresh_token(db, raw)
    if not triple:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")
    user, access, raw_refresh = triple
    set_auth_cookies(response, access_jwt=access, refresh_raw=raw_refresh)
    role = await db.get(Role, user.role_id) if user.role_id else None
    user_payload = row_to_user(user, role, include_permissions=True, include_calendar_export=True)
    return AuthSessionResponse(user=user_payload)


@router.post("/logout", response_model=OkResponse)
async def auth_logout(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
    body: LogoutRequest = Body(default_factory=LogoutRequest),
):
    settings = get_settings()
    raw = None
    if body.refresh_token and body.refresh_token.strip():
        raw = body.refresh_token.strip()
    if not raw:
        c = request.cookies.get(settings.REFRESH_TOKEN_COOKIE_NAME)
        raw = (c or "").strip() or None
    if raw:
        await revoke_refresh_token(db, raw)
    clear_auth_cookies(response)
    return {"ok": True}


@router.get("/me", response_model=AuthUserOut)
async def get_me(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    role = await db.get(Role, current_user.role_id) if current_user.role_id else None
    return row_to_user(current_user, role, include_permissions=True, include_calendar_export=True)


@router.patch("/me", response_model=AuthUserOut)
async def patch_me(
    body: UserSelfPatchBody,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Обновление своего профиля (без права access.users). Роль и архив менять нельзя."""
    data = body.model_dump(exclude_unset=True)
    if not data:
        role = await db.get(Role, current_user.role_id) if current_user.role_id else None
        return row_to_user(current_user, role, include_permissions=True, include_calendar_export=True)

    if "login" in data and data["login"] is not None:
        new_login = (str(data["login"]).strip() or None)
        if new_login:
            dup = await db.execute(
                select(User).where(
                    func.lower(User.login) == func.lower(new_login),
                    User.id != current_user.id,
                )
            )
            if dup.scalar_one_or_none():
                raise HTTPException(status_code=400, detail="Логин уже занят")
        current_user.login = new_login

    if "name" in data and data["name"] is not None:
        current_user.name = str(data["name"]).strip() or current_user.name
    if "email" in data:
        current_user.email = (str(data["email"]).strip() if data["email"] else None) or None
    if "phone" in data:
        current_user.phone = (str(data["phone"]).strip() if data["phone"] else None) or None
    if "telegram" in data:
        current_user.telegram = (str(data["telegram"]).strip() if data["telegram"] else None) or None
    if "avatar" in data:
        current_user.avatar = data["avatar"] if data["avatar"] else None

    raw_password = data.get("password") if "password" in data else None
    if raw_password is not None:
        pwd_plain = str(raw_password).strip()
        if pwd_plain:
            assert_new_password_policy(pwd_plain)
            await revoke_all_refresh_for_user(db, current_user.id)
            current_user.token_version = int(current_user.token_version or 0) + 1
            current_user.password_hash = get_password_hash(pwd_plain)
            current_user.must_change_password = False

    await db.flush()
    await log_entity_mutation(
        db,
        event_type="user.self_updated",
        entity_type="user",
        entity_id=current_user.id,
        source="auth-router",
        payload={"login": current_user.login, "name": current_user.name},
    )
    await log_mutation(
        db,
        "update",
        "user",
        current_user.id,
        actor_id=current_user.id,
        source="auth-router",
        request_id=_request_id(request),
        payload={"self_service": True, "name": current_user.name},
    )

    role = await db.get(Role, current_user.role_id) if current_user.role_id else None
    return row_to_user(current_user, role, include_permissions=True, include_calendar_export=True)


@router.get("/permissions/catalog", response_model=PermissionsCatalogResponse)
async def permissions_catalog(
    _user: User = Depends(require_any_permission("access.roles", "access.users")),
):
    return {"groups": PERMISSION_GROUPS, "allKeys": all_permission_keys()}


@router.get("/roles", response_model=list[RoleApiRow])
async def list_roles(
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_any_permission("access.roles", "access.users")),
):
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
            "permissions": effective_permissions_for_role_response(r.slug, r.permissions),
        }
        for r in rows
    ]


@router.post("/roles", response_model=IdOkResponse)
async def create_role(
    body: RoleCreateBody,
    request: Request,
    actor: User = Depends(require_permission("access.roles")),
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
    await db.flush()
    await log_entity_mutation(
        db,
        event_type="role.created",
        entity_type="role",
        entity_id=rid,
        source="auth-router",
        payload={"name": body.name.strip(), "slug": slug},
    )
    await log_mutation(
        db,
        "create",
        "role",
        rid,
        actor_id=actor.id,
        source="auth-router",
        request_id=_request_id(request),
        payload={"name": body.name.strip(), "slug": slug},
    )
    await db.commit()
    return {"id": rid, "ok": True}


@router.patch("/roles/{role_id}", response_model=OkResponse)
async def patch_role(
    role_id: str,
    body: RolePatchBody,
    request: Request,
    actor: User = Depends(require_permission("access.roles")),
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
    await db.flush()
    await log_entity_mutation(
        db,
        event_type="role.patched",
        entity_type="role",
        entity_id=role_id,
        source="auth-router",
        payload={"name": role.name, "permissions_count": len(role.permissions or [])},
    )
    await log_mutation(
        db,
        "update",
        "role",
        role_id,
        actor_id=actor.id,
        source="auth-router",
        request_id=_request_id(request),
        payload={"name": role.name, "permissions": role.permissions},
    )
    await db.commit()
    return {"ok": True}


@router.delete("/roles/{role_id}", response_model=OkResponse)
async def delete_role(
    role_id: str,
    request: Request,
    actor: User = Depends(require_permission("access.roles")),
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
    role_name = role.name
    await db.delete(role)
    await db.flush()
    await log_entity_mutation(
        db,
        event_type="role.deleted",
        entity_type="role",
        entity_id=role_id,
        source="auth-router",
        payload={"name": role_name},
    )
    await log_mutation(
        db,
        "delete",
        "role",
        role_id,
        actor_id=actor.id,
        source="auth-router",
        request_id=_request_id(request),
        payload={"name": role_name},
    )
    await db.commit()
    return {"ok": True}


@router.get("/users", response_model=list[AuthUserOut])
async def get_users(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Список пользователей только для аутентифицированных клиентов. Полный список (включая архив) — при праве ``access.users``; иначе только активные (неархивные)."""
    can_manage_users = await user_has_permission(db, current_user, "access.users")
    stmt = select(User).order_by(User.id)
    if not can_manage_users:
        stmt = stmt.where(User.is_archived.is_(False))
    result = await db.execute(stmt)
    users = result.scalars().all()
    role_ids = {u.role_id for u in users if u.role_id}
    rmap = await _load_roles_map(db, role_ids)
    data = [row_to_user(u, rmap.get(u.role_id), include_permissions=False) for u in users]
    return json_304_or_response(request, data=data, max_age=60)


@router.put("/users", response_model=OkResponse)
async def update_users(
    users: list[UserBulkItem],
    request: Request,
    db: AsyncSession = Depends(get_db),
    _user: User = Depends(require_permission("access.users")),
):
    emp_fallback = await db.execute(select(Role).where(Role.slug == "employee"))
    employee_role = emp_fallback.scalar_one_or_none()

    for u in users:
        if u.isArchived:
            if not u.id:
                continue
            existing = await db.get(User, u.id)
            if existing:
                existing.is_archived = True
                await db.flush()
                await log_entity_mutation(
                    db,
                    event_type="user.archived",
                    entity_type="user",
                    entity_id=u.id,
                    source="auth-router",
                    payload={"login": existing.login},
                )
                await log_mutation(
                    db,
                    "update",
                    "user",
                    u.id,
                    actor_id=_user.id,
                    source="auth-router",
                    request_id=_request_id(request),
                    payload={"login": existing.login, "is_archived": True},
                )
            continue
        raw = u.model_dump(exclude_unset=True)
        uid = raw.get("id")
        existing = await db.get(User, uid) if uid else None

        if not existing and not uid and u.login:
            result = await db.execute(select(User).where(User.login == u.login))
            existing = result.scalar_one_or_none()

        rid = await _resolve_role_id(db, u)
        if not rid and employee_role:
            rid = employee_role.id

        if existing:
            existing.name = raw.get("name", existing.name)
            if rid:
                existing.role_id = rid
            if "avatar" in raw:
                existing.avatar = u.avatar
            if "login" in raw:
                existing.login = u.login
            if "email" in raw:
                existing.email = u.email
            if "phone" in raw:
                existing.phone = u.phone
            if "telegram" in raw:
                existing.telegram = u.telegram
            if "telegramUserId" in raw:
                existing.telegram_user_id = u.telegramUserId
            raw_password = raw.get("password")
            if raw_password:
                if isinstance(raw_password, str) and looks_like_bcrypt_hash(raw_password):
                    existing.password_hash = raw_password
                else:
                    pwd_plain = str(raw_password).strip()
                    if len(pwd_plain) >= 8:
                        assert_new_password_policy(pwd_plain)
                        await revoke_all_refresh_for_user(db, existing.id)
                        existing.token_version = int(existing.token_version or 0) + 1
                        existing.password_hash = get_password_hash(pwd_plain)
                    elif u.mustChangePassword and pwd_plain:
                        # Временный пароль до входа (UI «Сбросить на 123», первичная выдача).
                        await revoke_all_refresh_for_user(db, existing.id)
                        existing.token_version = int(existing.token_version or 0) + 1
                        existing.password_hash = get_password_hash(pwd_plain)
                    # иначе: короткая строка без флага — заглушка в массовом PUT, пароль не меняем
            if "mustChangePassword" in raw:
                existing.must_change_password = bool(u.mustChangePassword)
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
            await log_mutation(
                db,
                "update",
                "user",
                existing.id,
                actor_id=_user.id,
                source="auth-router",
                request_id=_request_id(request),
                payload={"login": existing.login, "name": existing.name, "role_id": existing.role_id},
            )
        else:
            new_user = User(
                id=uid or str(uuid.uuid4()),
                name=u.name or "",
                role_id=rid or (employee_role.id if employee_role else None),
                login=u.login,
                email=u.email,
                phone=u.phone,
                telegram=u.telegram,
                telegram_user_id=u.telegramUserId,
            )
            if not new_user.role_id:
                raise HTTPException(status_code=400, detail="Не задана роль пользователя")
            raw_password = u.password
            if raw_password:
                if isinstance(raw_password, str) and looks_like_bcrypt_hash(raw_password):
                    new_user.password_hash = raw_password
                else:
                    pwd_plain = str(raw_password).strip()
                    if u.mustChangePassword and 0 < len(pwd_plain) < 8:
                        new_user.password_hash = get_password_hash(pwd_plain)
                    else:
                        assert_new_password_policy(pwd_plain)
                        new_user.password_hash = get_password_hash(pwd_plain)
            new_user.must_change_password = bool(u.mustChangePassword)
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
            await log_mutation(
                db,
                "create",
                "user",
                new_user.id,
                actor_id=_user.id,
                source="auth-router",
                request_id=_request_id(request),
                payload={"login": new_user.login, "name": new_user.name, "role_id": new_user.role_id},
            )
    await db.commit()
    return {"ok": True}

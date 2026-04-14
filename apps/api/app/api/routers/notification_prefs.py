"""Notification preferences router."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.db import get_db
from app.models.notification import NotificationPreferences as NPrefModel
from app.schemas.common_responses import OkResponse
from app.schemas.notification_prefs import NotificationPrefsGetResponse, NotificationPrefsPut
from app.services.domain_events import log_entity_mutation

router = APIRouter(prefix="/notification-prefs", tags=["notification-prefs"], dependencies=[Depends(get_current_user)])


def _default_prefs(user_id: str = "default"):
    return {
        "id": user_id,
        "defaultFunnelId": None,
        "telegramGroupChatId": None,
        "channels": {
            "in_app": True,
            "chat": True,
            "telegram": False,
            "email": False,
        },
        "quietHours": {
            "enabled": False,
            "start": "22:00",
            "end": "08:00",
            "timezone": "Asia/Tashkent",
        },
        "types": {},
        "newTask": {"telegramPersonal": True, "telegramGroup": False},
        "statusChange": {"telegramPersonal": True, "telegramGroup": False},
        "taskAssigned": {"telegramPersonal": True, "telegramGroup": False},
        "taskComment": {"telegramPersonal": True, "telegramGroup": False},
        "taskDeadline": {"telegramPersonal": True, "telegramGroup": False},
        "docCreated": {"telegramPersonal": True, "telegramGroup": False},
        "docUpdated": {"telegramPersonal": True, "telegramGroup": False},
        "docShared": {"telegramPersonal": True, "telegramGroup": False},
        "meetingCreated": {"telegramPersonal": True, "telegramGroup": False},
        "meetingReminder": {"telegramPersonal": True, "telegramGroup": False},
        "meetingUpdated": {"telegramPersonal": True, "telegramGroup": False},
        "postCreated": {"telegramPersonal": True, "telegramGroup": False},
        "postStatusChanged": {"telegramPersonal": True, "telegramGroup": False},
        "purchaseRequestCreated": {"telegramPersonal": True, "telegramGroup": False},
        "purchaseRequestStatusChanged": {"telegramPersonal": True, "telegramGroup": False},
        "financePlanUpdated": {"telegramPersonal": True, "telegramGroup": False},
        "dealCreated": {"telegramPersonal": True, "telegramGroup": False},
        "dealStatusChanged": {"telegramPersonal": True, "telegramGroup": False},
        "clientCreated": {"telegramPersonal": True, "telegramGroup": False},
        "contractCreated": {"telegramPersonal": True, "telegramGroup": False},
        "employeeCreated": {"telegramPersonal": True, "telegramGroup": False},
        "employeeUpdated": {"telegramPersonal": True, "telegramGroup": False},
        "processStarted": {"telegramPersonal": True, "telegramGroup": False},
        "processStepCompleted": {"telegramPersonal": True, "telegramGroup": False},
        "processStepRequiresApproval": {"telegramPersonal": True, "telegramGroup": False},
    }


@router.get("", response_model=NotificationPrefsGetResponse)
async def get_prefs(
    user_id: str = Query(default="default"),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(NPrefModel).where(NPrefModel.id == user_id).limit(1))
    row = result.scalar_one_or_none()
    if not row and user_id != "default":
        result = await db.execute(select(NPrefModel).where(NPrefModel.id == "default").limit(1))
        row = result.scalar_one_or_none()
    if not row:
        return NotificationPrefsGetResponse(_default_prefs(user_id))
    prefs = dict(row.prefs) if row.prefs else {}
    prefs["id"] = row.id
    prefs["defaultFunnelId"] = row.default_funnel_id
    prefs["telegramGroupChatId"] = row.telegram_group_chat_id
    if "channels" not in prefs:
        prefs["channels"] = _default_prefs(row.id).get("channels")
    if "quietHours" not in prefs:
        prefs["quietHours"] = _default_prefs(row.id).get("quietHours")
    if "types" not in prefs:
        prefs["types"] = {}
    return NotificationPrefsGetResponse(prefs)


@router.put("", response_model=OkResponse)
async def update_prefs(
    body: NotificationPrefsPut,
    user_id: str = Query(default="default"),
    db: AsyncSession = Depends(get_db),
):
    prefs = body.model_dump(exclude_unset=True)
    pid = prefs.pop("id", user_id)
    default_funnel = prefs.pop("defaultFunnelId", None)
    telegram_group = prefs.pop("telegramGroupChatId", None)
    result = await db.execute(select(NPrefModel).where(NPrefModel.id == pid).limit(1))
    row = result.scalar_one_or_none()
    if row:
        row.prefs = prefs
        row.default_funnel_id = default_funnel
        row.telegram_group_chat_id = telegram_group
    else:
        db.add(NPrefModel(
            id=pid,
            prefs=prefs,
            default_funnel_id=default_funnel,
            telegram_group_chat_id=telegram_group,
        ))
    await db.flush()
    tg = telegram_group
    await log_entity_mutation(
        db,
        event_type="notification_prefs.updated",
        entity_type="notification_prefs",
        entity_id=pid,
        source="notification-prefs-router",
        payload={
            "hasDefaultFunnel": default_funnel is not None and default_funnel != "",
            "hasTelegramGroup": tg is not None and tg != "",
        },
    )
    await db.commit()
    return {"ok": True}

"""Notification preferences router."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.notification import NotificationPreferences as NPrefModel

router = APIRouter(prefix="/notification-prefs", tags=["notification-prefs"])


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


@router.get("")
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
        return _default_prefs(user_id)
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
    return prefs


@router.put("")
async def update_prefs(
    prefs: dict,
    user_id: str = Query(default="default"),
    db: AsyncSession = Depends(get_db),
):
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
    await db.commit()
    return {"ok": True}

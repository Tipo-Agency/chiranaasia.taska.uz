"""Notification preferences router."""
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.notification import NotificationPreferences as NPrefModel

router = APIRouter(prefix="/notification-prefs", tags=["notification-prefs"])


@router.get("")
async def get_prefs(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(NPrefModel).limit(1))
    row = result.scalar_one_or_none()
    if not row:
        return {
            "id": "default",
            "defaultFunnelId": None,
            "telegramGroupChatId": None,
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
    prefs = dict(row.prefs) if row.prefs else {}
    prefs["id"] = row.id
    prefs["defaultFunnelId"] = row.default_funnel_id
    prefs["telegramGroupChatId"] = row.telegram_group_chat_id
    return prefs


@router.put("")
async def update_prefs(prefs: dict, db: AsyncSession = Depends(get_db)):
    pid = prefs.pop("id", "default")
    default_funnel = prefs.pop("defaultFunnelId", None)
    telegram_group = prefs.pop("telegramGroupChatId", None)
    result = await db.execute(select(NPrefModel).limit(1))
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

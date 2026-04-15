"""Meetings: CRUD, participants (JSONB), deal_id, валидация даты/времени."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field, model_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.db import get_db
from app.models.client import Deal
from app.models.content import Meeting
from app.schemas.common_responses import OkResponse, OkWithIdResponse
from app.schemas.meetings import MeetingBulkItem, MeetingParticipantRead, MeetingRead
from app.services.domain_events import emit_domain_event, log_entity_mutation
from app.services.meeting_validation import (
    apply_participants_to_row,
    assert_meeting_start_not_in_past,
    assert_valid_meeting_datetime,
    meeting_wall_start_unchanged,
    normalize_participants_payload,
    participant_user_ids_from_row,
)

router = APIRouter(prefix="/meetings", tags=["meetings"], dependencies=[Depends(get_current_user)])


def _participants_models_to_plain(
    raw: list[MeetingParticipantRead] | None,
) -> list[dict[str, object]] | None:
    if raw is None:
        return None
    return [p.model_dump(mode="python") for p in raw]


def row_to_meeting(row: Meeting) -> MeetingRead:
    parts_raw = row.participants if isinstance(getattr(row, "participants", None), list) else []
    parts: list[MeetingParticipantRead] = []
    for p in parts_raw:
        if isinstance(p, dict):
            parts.append(MeetingParticipantRead.model_validate(p))
    if not parts and (row.participant_ids or []):
        parts = [
            MeetingParticipantRead(userId=str(x).strip()[:36])
            for x in (row.participant_ids or [])
            if str(x).strip()
        ]
    pids = participant_user_ids_from_row(row)
    return MeetingRead(
        id=row.id,
        tableId=row.table_id,
        title=row.title,
        date=row.date,
        time=row.time,
        participantIds=pids,
        participants=parts,
        summary=row.summary,
        type=row.type,
        dealId=row.deal_id,
        clientId=row.client_id,
        projectId=getattr(row, "project_id", None),
        shootPlanId=getattr(row, "shoot_plan_id", None),
        recurrence=row.recurrence,
        isArchived=row.is_archived or False,
    )


async def _assert_deal_exists(db: AsyncSession, deal_id: str | None) -> None:
    if not deal_id:
        return
    did = str(deal_id).strip()[:36]
    d = await db.get(Deal, did)
    if d is None or (d.is_archived or False):
        raise HTTPException(status_code=422, detail="Сделка не найдена или в архиве")


def _meeting_body_coerce_participants(data: object) -> object:
    if not isinstance(data, dict):
        return data
    raw = data.get("participants")
    if raw is None or not isinstance(raw, list):
        return data
    out: list[object] = []
    for item in raw:
        if isinstance(item, str):
            uid = item.strip()[:36]
            if uid:
                out.append({"userId": uid})
        else:
            out.append(item)
    data = dict(data)
    data["participants"] = out
    return data


class MeetingCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    id: str | None = None
    table_id: str | None = Field(default=None, alias="tableId")
    title: str = ""
    date: str = ""
    time: str = ""
    participants: list[MeetingParticipantRead] | None = None
    participant_ids: list[str] | None = Field(default=None, alias="participantIds")
    summary: str | None = None
    type: str = "work"
    deal_id: str | None = Field(default=None, alias="dealId")
    client_id: str | None = Field(default=None, alias="clientId")
    project_id: str | None = Field(default=None, alias="projectId")
    shoot_plan_id: str | None = Field(default=None, alias="shootPlanId")
    recurrence: str = "none"
    is_archived: bool = Field(default=False, alias="isArchived")

    @model_validator(mode="before")
    @classmethod
    def _coerce_participants(cls, data: object) -> object:
        return _meeting_body_coerce_participants(data)


class MeetingPatch(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    table_id: str | None = Field(default=None, alias="tableId")
    title: str | None = None
    date: str | None = None
    time: str | None = None
    participants: list[MeetingParticipantRead] | None = None
    participant_ids: list[str] | None = Field(default=None, alias="participantIds")
    summary: str | None = None
    type: str | None = None
    deal_id: str | None = Field(default=None, alias="dealId")
    client_id: str | None = Field(default=None, alias="clientId")
    project_id: str | None = Field(default=None, alias="projectId")
    shoot_plan_id: str | None = Field(default=None, alias="shootPlanId")
    recurrence: str | None = None
    is_archived: bool | None = Field(default=None, alias="isArchived")

    @model_validator(mode="before")
    @classmethod
    def _coerce_participants(cls, data: object) -> object:
        return _meeting_body_coerce_participants(data)


@router.get("", response_model=list[MeetingRead])
async def list_meetings(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Meeting).where(Meeting.is_archived.is_(False)))
    return [row_to_meeting(m) for m in result.scalars().all()]


@router.get("/{meeting_id}", response_model=MeetingRead)
async def get_meeting(meeting_id: str, db: AsyncSession = Depends(get_db)):
    mid = str(meeting_id).strip()[:36]
    row = await db.get(Meeting, mid)
    if row is None:
        raise HTTPException(status_code=404, detail="Встреча не найдена")
    return row_to_meeting(row)


@router.post("", response_model=MeetingRead)
async def create_meeting(body: MeetingCreate, db: AsyncSession = Depends(get_db)):
    await _assert_deal_exists(db, body.deal_id)
    assert_valid_meeting_datetime(body.date, body.time)
    assert_meeting_start_not_in_past(body.date, body.time)
    parts, pids = normalize_participants_payload(
        _participants_models_to_plain(body.participants),
        body.participant_ids,
    )
    mid = (body.id or str(uuid.uuid4())).strip()[:36]
    if await db.get(Meeting, mid):
        raise HTTPException(status_code=409, detail="Встреча с таким id уже существует")
    row = Meeting(
        id=mid,
        table_id=(body.table_id or "").strip()[:36] or None,
        title=(body.title or "").strip()[:500] or "Без названия",
        date=str(body.date).strip()[:50],
        time=str(body.time).strip()[:10],
        participant_ids=pids,
        participants=parts,
        summary=body.summary,
        type=body.type or "work",
        deal_id=(body.deal_id or "").strip()[:36] or None,
        client_id=(body.client_id or "").strip()[:36] or None,
        project_id=(body.project_id or "").strip()[:36] or None,
        shoot_plan_id=(body.shoot_plan_id or "").strip()[:36] or None,
        recurrence=body.recurrence or "none",
        is_archived=bool(body.is_archived),
    )
    db.add(row)
    await db.flush()
    await emit_domain_event(
        db,
        event_type="meeting.created",
        org_id="default",
        entity_type="meeting",
        entity_id=mid,
        source="meetings-router",
        payload={
            "meetingId": mid,
            "title": row.title,
            "date": row.date,
            "time": row.time,
            "participantIds": pids,
        },
    )
    await db.commit()
    await db.refresh(row)
    return row_to_meeting(row)


@router.patch("/{meeting_id}", response_model=MeetingRead)
async def patch_meeting(
    meeting_id: str,
    body: MeetingPatch,
    db: AsyncSession = Depends(get_db),
):
    mid = str(meeting_id).strip()[:36]
    row = await db.get(Meeting, mid)
    if row is None:
        raise HTTPException(status_code=404, detail="Встреча не найдена")

    raw = body.model_dump(exclude_unset=True)

    if "deal_id" in raw:
        await _assert_deal_exists(db, raw["deal_id"])
    if "date" in raw or "time" in raw:
        merged_date = str(raw.get("date", row.date) or "")
        merged_time = str(raw.get("time", row.time) or "")
        assert_valid_meeting_datetime(merged_date, merged_time)
        if not meeting_wall_start_unchanged(row.date, row.time, merged_date, merged_time):
            assert_meeting_start_not_in_past(merged_date, merged_time)

    if "table_id" in raw and raw["table_id"] is not None:
        row.table_id = str(raw["table_id"]).strip()[:36] or None
    if "title" in raw and raw["title"] is not None:
        row.title = str(raw["title"]).strip()[:500] or row.title
    if "date" in raw and raw["date"] is not None:
        row.date = str(raw["date"]).strip()[:50]
    if "time" in raw and raw["time"] is not None:
        row.time = str(raw["time"]).strip()[:10]
    if "summary" in raw:
        row.summary = raw["summary"]
    if "type" in raw and raw["type"] is not None:
        row.type = str(raw["type"])[:20]
    if "deal_id" in raw:
        row.deal_id = str(raw["deal_id"]).strip()[:36] if raw["deal_id"] else None
    if "client_id" in raw:
        row.client_id = str(raw["client_id"]).strip()[:36] if raw["client_id"] else None
    if "project_id" in raw:
        row.project_id = str(raw["project_id"]).strip()[:36] if raw["project_id"] else None
    if "shoot_plan_id" in raw:
        row.shoot_plan_id = str(raw["shoot_plan_id"]).strip()[:36] if raw["shoot_plan_id"] else None
    if "recurrence" in raw and raw["recurrence"] is not None:
        row.recurrence = str(raw["recurrence"])[:20]
    if "is_archived" in raw and raw["is_archived"] is not None:
        row.is_archived = bool(raw["is_archived"])

    if "participants" in raw:
        apply_participants_to_row(row, raw["participants"], raw.get("participant_ids") if "participant_ids" in raw else None)
    elif "participant_ids" in raw:
        apply_participants_to_row(row, None, raw["participant_ids"])

    await db.flush()
    await log_entity_mutation(
        db,
        event_type="meeting.updated",
        entity_type="meeting",
        entity_id=mid,
        source="meetings-router",
        payload={
            "meetingId": mid,
            "title": row.title,
            "date": row.date,
            "time": row.time,
            "participantIds": participant_user_ids_from_row(row),
        },
    )
    await db.commit()
    await db.refresh(row)
    return row_to_meeting(row)


@router.delete("/{meeting_id}", response_model=OkWithIdResponse)
async def delete_meeting(meeting_id: str, db: AsyncSession = Depends(get_db)):
    mid = str(meeting_id).strip()[:36]
    row = await db.get(Meeting, mid)
    if row is None:
        raise HTTPException(status_code=404, detail="Встреча не найдена")
    row.is_archived = True
    await db.flush()
    await log_entity_mutation(
        db,
        event_type="meeting.updated",
        entity_type="meeting",
        entity_id=mid,
        source="meetings-router",
        payload={"meetingId": mid, "isArchived": True},
    )
    await db.commit()
    return OkWithIdResponse(id=mid)


@router.put("", response_model=OkResponse)
async def put_meetings_bulk(meetings: list[MeetingBulkItem], db: AsyncSession = Depends(get_db)):
    """Массовая синхронизация (как раньше). Даты проверяются при изменении date/time."""
    for item in meetings:
        mid = item.id
        if not mid:
            continue
        mid = str(mid).strip()[:36]
        fs = item.model_fields_set
        existing = await db.get(Meeting, mid)
        if existing:
            if "date" in fs or "time" in fs:
                merged_date = str(item.date if "date" in fs else (existing.date or ""))
                merged_time = str(item.time if "time" in fs else (existing.time or ""))
                assert_valid_meeting_datetime(merged_date, merged_time)
                if not meeting_wall_start_unchanged(existing.date, existing.time, merged_date, merged_time):
                    assert_meeting_start_not_in_past(merged_date, merged_time)
            if "dealId" in fs:
                await _assert_deal_exists(db, item.dealId)

            if "tableId" in fs:
                existing.table_id = item.tableId
            if "title" in fs:
                existing.title = item.title or existing.title
            if "date" in fs:
                existing.date = str(item.date).strip()[:50]
            if "time" in fs:
                existing.time = str(item.time).strip()[:10]
            if "summary" in fs:
                existing.summary = item.summary
            if "type" in fs:
                existing.type = item.type or existing.type
            if "dealId" in fs:
                existing.deal_id = item.dealId
            if "clientId" in fs:
                existing.client_id = item.clientId
            if hasattr(existing, "project_id") and "projectId" in fs:
                existing.project_id = item.projectId
            if hasattr(existing, "shoot_plan_id") and "shootPlanId" in fs:
                existing.shoot_plan_id = item.shootPlanId
            if "recurrence" in fs:
                existing.recurrence = item.recurrence
            if "isArchived" in fs:
                existing.is_archived = item.isArchived

            if "participants" in fs:
                apply_participants_to_row(
                    existing,
                    _participants_models_to_plain(item.participants),
                    item.participantIds,
                )
            elif "participantIds" in fs:
                apply_participants_to_row(existing, None, item.participantIds)

            await db.flush()
            await log_entity_mutation(
                db,
                event_type="meeting.updated",
                entity_type="meeting",
                entity_id=mid,
                source="meetings-router",
                actor_id=item.updatedByUserId,
                payload={
                    "meetingId": mid,
                    "title": existing.title,
                    "date": existing.date,
                    "time": existing.time,
                    "participantIds": participant_user_ids_from_row(existing),
                },
            )
        else:
            await _assert_deal_exists(db, item.dealId)
            assert_valid_meeting_datetime(
                str(item.date or ""),
                str(item.time or ""),
            )
            assert_meeting_start_not_in_past(str(item.date or ""), str(item.time or ""))
            p_parts, p_ids = normalize_participants_payload(
                _participants_models_to_plain(item.participants),
                item.participantIds,
            )
            db.add(
                Meeting(
                    id=mid,
                    table_id=item.tableId,
                    title=item.title or "",
                    date=str(item.date or "").strip()[:50],
                    time=str(item.time or "").strip()[:10],
                    participant_ids=p_ids,
                    participants=p_parts,
                    summary=item.summary,
                    type=item.type or "work",
                    deal_id=item.dealId,
                    client_id=item.clientId,
                    project_id=item.projectId,
                    shoot_plan_id=item.shootPlanId,
                    recurrence=item.recurrence or "none",
                    is_archived=item.isArchived,
                )
            )
            await db.flush()
            await emit_domain_event(
                db,
                event_type="meeting.created",
                org_id="default",
                entity_type="meeting",
                entity_id=mid,
                source="meetings-router",
                actor_id=item.createdByUserId,
                payload={
                    "meetingId": mid,
                    "title": item.title or "",
                    "date": item.date,
                    "time": item.time,
                    "participantIds": p_ids,
                },
            )
    await db.commit()
    return OkResponse()

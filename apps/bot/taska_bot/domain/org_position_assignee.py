"""Согласовано с apps/web/utils/orgPositionAssignee.ts — назначение задач на должность."""
from __future__ import annotations

from typing import Any, Optional, TypedDict


class PositionAssigneeResolution(TypedDict, total=False):
    assignee_id: Optional[str]
    assignee_ids: list[str]
    position_patch: dict[str, Any]


def get_member_user_ids_for_position(
    position: Optional[dict], employees: list[dict]
) -> list[str]:
    if not position:
        return []
    pid = str(position.get("id") or "")
    from_cards: list[str] = []
    for e in employees:
        if e.get("isArchived"):
            continue
        if str(e.get("orgPositionId") or "") == pid and e.get("userId"):
            from_cards.append(str(e["userId"]))
    uniq = sorted(set(from_cards))
    if uniq:
        return uniq
    holder = position.get("holderUserId")
    if holder:
        return [str(holder)]
    return []


def resolve_assignees_for_org_position(
    position: Optional[dict], employees: list[dict]
) -> PositionAssigneeResolution:
    if not position:
        return {"assignee_id": None}

    members = get_member_user_ids_for_position(position, employees)
    if not members:
        return {"assignee_id": None}

    mode = position.get("taskAssigneeMode") or "round_robin"
    if mode == "all":
        return {"assignee_id": members[0], "assignee_ids": members}

    if len(members) == 1:
        return {"assignee_id": members[0]}

    last = position.get("lastTaskAssigneeUserId")
    idx = members.index(last) if last and last in members else -1
    nxt = members[(idx + 1) % len(members)]
    return {
        "assignee_id": nxt,
        "position_patch": {"lastTaskAssigneeUserId": nxt},
    }

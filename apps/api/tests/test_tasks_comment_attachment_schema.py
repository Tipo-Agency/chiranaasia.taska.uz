"""Схемы TaskCommentRead / TaskAttachmentRead: алиасы и строгие поля."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.schemas.tasks import TaskAttachmentRead, TaskCommentRead


def test_task_comment_accepts_snake_case():
    c = TaskCommentRead.model_validate(
        {
            "id": "c1",
            "task_id": "t1",
            "user_id": "u1",
            "text": "hello",
            "created_at": "2026-01-01T00:00:00Z",
            "is_system": False,
        }
    )
    assert c.id == "c1" and c.task_id == "t1" and c.user_id == "u1"


def test_task_comment_accepts_camel_case_aliases():
    c = TaskCommentRead.model_validate(
        {
            "id": "c1",
            "taskId": "t1",
            "userId": "u1",
            "text": "hello",
            "createdAt": "2026-01-01T00:00:00Z",
            "attachmentId": "att1",
        }
    )
    assert c.attachment_id == "att1"


def test_task_comment_rejects_unknown_extra_forbid_not_used_extra_ignore():
    c = TaskCommentRead.model_validate(
        {"id": "c", "taskId": "t", "userId": "u", "text": "x", "createdAt": "now", "legacy": 1}
    )
    assert not hasattr(c, "legacy")


def test_task_attachment_mime_from_type_alias():
    a = TaskAttachmentRead.model_validate(
        {
            "id": "a1",
            "taskId": "t1",
            "name": "pic.png",
            "url": "https://x/p.png",
            "type": "image/png",
            "uploadedAt": "2026-01-02",
        }
    )
    assert a.mime_type == "image/png"


def test_task_attachment_attachment_type_literal():
    a = TaskAttachmentRead.model_validate(
        {
            "id": "a1",
            "taskId": "t1",
            "name": "d",
            "url": "/",
            "uploadedAt": "x",
            "attachmentType": "doc",
        }
    )
    assert a.attachment_type == "doc"


def test_task_attachment_invalid_attachment_type_raises():
    with pytest.raises(ValidationError):
        TaskAttachmentRead.model_validate(
            {
                "id": "a1",
                "taskId": "t1",
                "name": "d",
                "url": "/",
                "uploadedAt": "x",
                "attachmentType": "other",
            }
        )


def _coerce_comments(raw: list) -> list[TaskCommentRead]:
    out: list[TaskCommentRead] = []
    for c in raw:
        if not isinstance(c, dict):
            continue
        try:
            out.append(TaskCommentRead.model_validate(c))
        except ValidationError:
            continue
    return out


def _coerce_attachments(raw: list) -> list[TaskAttachmentRead]:
    out: list[TaskAttachmentRead] = []
    for a in raw:
        if not isinstance(a, dict):
            continue
        try:
            out.append(TaskAttachmentRead.model_validate(a))
        except ValidationError:
            continue
    return out


def test_coerce_comments_skips_malformed():
    comments = _coerce_comments(
        [
            {"id": "ok", "taskId": "t", "userId": "u", "text": "1", "createdAt": "x"},
            {"broken": True},
            "not-a-dict",
        ]
    )
    assert len(comments) == 1
    assert comments[0].id == "ok"


def test_coerce_attachments_skips_invalid_literal():
    atts = _coerce_attachments(
        [
            {"id": "a", "taskId": "t", "name": "n", "url": "/", "uploadedAt": "u", "attachmentType": "bad"},
        ]
    )
    assert atts == []

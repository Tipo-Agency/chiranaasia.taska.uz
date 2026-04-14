"""Правила смены стадии сделки (без HTTP). Адаптер в сервисе — ``deal_stage_validation``."""
from __future__ import annotations


class DealStageTransitionError(Exception):
    """Недопустимый переход стадии; поля для маппинга в HTTP."""

    def __init__(self, *, status_code: int, detail: str) -> None:
        self.status_code = status_code
        self.detail = detail
        super().__init__(detail)


def _norm_stage(s: str | None) -> str:
    return (s or "").strip().lower()


def _is_won(stage: str | None) -> bool:
    return _norm_stage(stage) == "won"


def _is_lost(stage: str | None) -> bool:
    return _norm_stage(stage) == "lost"


def check_deal_stage_transition(
    *,
    from_stage: str | None,
    to_stage: str | None,
    lost_reason_effective: str | None,
    is_admin: bool,
) -> None:
    """
    Проверка перехода from_stage → to_stage.
    - Из won / lost в любую другую стадию — только при ``is_admin``.
    - Вход в lost — непустой lost_reason.
    """
    fs = _norm_stage(from_stage)
    ts = _norm_stage(to_stage)
    if fs == ts:
        return

    if _is_won(from_stage) and ts != fs:
        if not is_admin:
            raise DealStageTransitionError(status_code=403, detail="deal_stage_won_locked")

    if _is_lost(from_stage) and ts != fs:
        if not is_admin:
            raise DealStageTransitionError(status_code=403, detail="deal_stage_lost_locked")

    if _is_lost(to_stage):
        lr = (lost_reason_effective or "").strip()
        if not lr:
            raise DealStageTransitionError(status_code=422, detail="deal_lost_reason_required")

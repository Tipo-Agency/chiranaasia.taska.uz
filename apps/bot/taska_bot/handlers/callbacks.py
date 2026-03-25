"""Inline-кнопки: задачи, сделки, заявки (админ)."""
from __future__ import annotations

import html
from datetime import datetime, timezone

from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.ext import CallbackQueryHandler, ContextTypes

from taska_bot.domain.task_filters import (
    overdue_tasks_for_user,
    today_tasks_for_user,
    user_open_tasks,
)
from taska_bot.handlers.crm_context import is_admin, resolve_crm_user, user_name


def _idx(s: str, prefix: str) -> int | None:
    if not s.startswith(prefix):
        return None
    tail = s[len(prefix) :].strip()
    try:
        return int(tail, 10)
    except ValueError:
        return None


def _two_idx(data: str, prefix: str) -> tuple[int, int] | None:
    if not data.startswith(prefix):
        return None
    rest = data[len(prefix) :]
    parts = rest.split(":")
    if len(parts) != 2:
        return None
    try:
        return int(parts[0], 10), int(parts[1], 10)
    except ValueError:
        return None


async def _answer(query, text: str | None = None, alert: bool = False) -> None:
    try:
        await query.answer(text=text, show_alert=alert)
    except Exception:
        pass


def _build_web_url(base: str, params: dict[str, str]) -> str:
    base = (base or "").strip().rstrip("/")
    if not base or not base.startswith("http"):
        return ""
    from urllib.parse import urlencode

    return f"{base}/?{urlencode(params)}"


async def on_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    if not query or not query.data:
        return
    data = query.data
    api = context.application.bot_data["api"]

    crm = await resolve_crm_user(update, context)
    if not crm:
        await _answer(query, "Сначала /start", alert=True)
        return
    uid = str(crm.get("id") or "")
    users = await api.get_users()

    if data == "t:all":
        await _answer(query)
        await _show_open_tasks(query, context, api, uid, crm, users)
        return
    if data == "t:sum":
        await _answer(query)
        await _show_task_summary(query, context, api, uid, users)
        return
    if data.startswith("t:o:"):
        i = _idx(data, "t:o:")
        if i is None:
            await _answer(query, "Ошибка", alert=True)
            return
        await _answer(query)
        await _show_task_detail(query, context, api, uid, users, i)
        return
    if data.startswith("t:s:"):
        pair = _two_idx(data, "t:s:")
        if pair is None:
            await _answer(query, "Ошибка", alert=True)
            return
        ti, sj = pair
        await _answer(query)
        await _apply_task_status(query, context, api, uid, users, ti, sj)
        return

    if data == "d:mine":
        await _answer(query)
        await _show_deals_mine(query, context, api, uid, users)
        return
    if data.startswith("d:fn:"):
        fi = _idx(data, "d:fn:")
        if fi is None:
            await _answer(query, "Ошибка", alert=True)
            return
        await _answer(query)
        await _show_deals_in_funnel(query, context, api, uid, users, fi)
        return
    if data.startswith("d:o:"):
        i = _idx(data, "d:o:")
        if i is None:
            await _answer(query, "Ошибка", alert=True)
            return
        await _answer(query)
        await _show_deal_detail(query, context, api, uid, users, i)
        return
    if data.startswith("d:s:"):
        pair = _two_idx(data, "d:s:")
        if pair is None:
            await _answer(query, "Ошибка", alert=True)
            return
        di, sj = pair
        await _answer(query)
        await _apply_deal_stage(query, context, api, uid, users, di, sj)
        return

    if data.startswith("r:a:"):
        i = _idx(data, "r:a:")
        if i is None:
            await _answer(query, "Ошибка", alert=True)
            return
        await _answer(query)
        await _finance_decide(query, context, api, crm, i, "approved")
        return
    if data.startswith("r:x:"):
        i = _idx(data, "r:x:")
        if i is None:
            await _answer(query, "Ошибка", alert=True)
            return
        await _answer(query)
        await _finance_decide(query, context, api, crm, i, "rejected")
        return

    if data.startswith("d:c:"):
        ci = _idx(data, "d:c:")
        if ci is None:
            await _answer(query, "Ошибка", alert=True)
            return
        await _answer(query)
        context.user_data["deal_comment_pick_idx"] = ci
        await query.message.reply_text(
            "Напишите комментарий одним сообщением.\n/cancel_comment — отмена."
        )
        return

    if data.startswith("c:rp:"):
        mid = data[5:]
        meta = context.application.bot_data.get("chat_msg_meta", {})
        sender = meta.get(mid) if isinstance(meta, dict) else None
        if not sender:
            await _answer(query, "Сообщение устарело", alert=True)
            return
        await _answer(query)
        context.user_data["pending_reply_sender_id"] = str(sender)
        await query.message.reply_text(
            "Напишите ответ одним сообщением.\n/cancel_reply — отмена."
        )
        return
    if data.startswith("c:rd:"):
        mid = data[5:]
        ok = await api.patch_message_read(mid, read=True)
        await _answer(query, "Отмечено прочитанным" if ok else "Не удалось")
        return
    if data.startswith("m:o:"):
        i = _idx(data, "m:o:")
        if i is None:
            await _answer(query, "Ошибка", alert=True)
            return
        mids = context.user_data.get("meeting_pick_list") or []
        if i < 0 or i >= len(mids):
            await _answer(query, "Список устарел", alert=True)
            return
        meetings = await api.get_meetings()
        meet = next((m for m in meetings if str(m.get("id")) == mids[i]), None)
        if not meet:
            await _answer(query, "Встреча не найдена", alert=True)
            return
        title = html.escape(str(meet.get("title") or "—"))
        d = html.escape(str(meet.get("date") or "—"))
        t = html.escape(str(meet.get("time") or "—"))
        summary = html.escape(str(meet.get("summary") or ""))
        pids = [str(x) for x in (meet.get("participantIds") or [])]
        pnames = [user_name(users, pid) for pid in pids]
        ppl = ", ".join(html.escape(x) for x in pnames[:8]) or "—"
        text = (
            f"📅 <b>{title}</b>\n"
            f"Дата: {d}\n"
            f"Время: {t}\n"
            f"Участники: {ppl}\n"
        )
        if summary:
            text += f"\nОписание:\n{summary[:900]}"
        settings = context.application.bot_data.get("settings")
        web = getattr(settings, "web_app_url", "") if settings else ""
        url = _build_web_url(web, {"openMeetingId": str(meet.get("id") or "")})
        kb = InlineKeyboardMarkup([[InlineKeyboardButton("🌐 Открыть в системе", url=url)]]) if url else None
        await query.message.reply_text(text, parse_mode="HTML", reply_markup=kb)
        await _answer(query)
        return


async def _show_task_summary(query, context, api, uid, users) -> None:
    all_tasks = await api.get_tasks()
    today = today_tasks_for_user(all_tasks, uid)
    overdue = overdue_tasks_for_user(all_tasks, uid)
    lines = ["📋 <b>Задачи</b>"]
    if overdue:
        lines.append(f"\n⚠️ Просрочено: {len(overdue)}")
    if today:
        lines.append(f"📅 На сегодня: {len(today)}")
    if not overdue and not today:
        lines.append("\nПросроченных и на сегодня нет.")
    kb = [
        [
            InlineKeyboardButton("Все мои открытые", callback_data="t:all"),
            InlineKeyboardButton("➕ Новая задача", callback_data="task:n"),
        ],
    ]
    await query.message.reply_text(
        "\n".join(lines), parse_mode="HTML", reply_markup=InlineKeyboardMarkup(kb)
    )


async def _show_open_tasks(query, context, api, uid, crm, users) -> None:
    all_tasks = await api.get_tasks()
    mine = user_open_tasks(all_tasks, uid)
    if not mine:
        await query.message.reply_text("Открытых задач на вас нет.")
        return
    pick = [str(t.get("id")) for t in mine[:20]]
    context.user_data["task_pick_list"] = pick
    lines = [f"📋 <b>Открытые задачи</b> ({len(mine)})\n"]
    kb = []
    row = []
    for i, t in enumerate(mine[:20]):
        title = (t.get("title") or "—")[:40]
        lines.append(f"{i + 1}. {html.escape(title)}")
        row.append(InlineKeyboardButton(str(i + 1), callback_data=f"t:o:{i:02d}"))
        if len(row) == 5:
            kb.append(row)
            row = []
    if row:
        kb.append(row)
    kb.append([InlineKeyboardButton("⟵ К сводке", callback_data="t:sum")])
    await query.message.reply_text(
        "\n".join(lines), parse_mode="HTML", reply_markup=InlineKeyboardMarkup(kb)
    )


async def _show_task_detail(query, context, api, uid, users, idx: int) -> None:
    pick = context.user_data.get("task_pick_list") or []
    if idx < 0 or idx >= len(pick):
        await query.message.reply_text("Список устарел. Нажми «Задачи» снова.")
        return
    tid = pick[idx]
    all_tasks = await api.get_tasks()
    task = next((t for t in all_tasks if str(t.get("id")) == tid), None)
    if not task:
        await query.message.reply_text("Задача не найдена.")
        return
    statuses = await api.get_statuses()
    context.user_data["task_status_order"] = [str(s.get("id")) for s in statuses]

    title = html.escape(str(task.get("title") or "—"))
    st = html.escape(str(task.get("status") or "—"))
    end = html.escape(str(task.get("endDate") or "—"))
    desc = task.get("description")
    desc_part = f"\n{html.escape(str(desc)[:800])}" if desc else ""

    lines = [
        f"📌 <b>{title}</b>",
        f"Статус: <i>{st}</i>",
        f"Срок: {end}" + desc_part,
        "",
        "Сменить статус:",
    ]
    kb = []
    row = []
    for j, s in enumerate(statuses[:10]):
        nm = str(s.get("name") or j)[:18]
        row.append(InlineKeyboardButton(nm, callback_data=f"t:s:{idx:02d}:{j:02d}"))
        if len(row) == 3:
            kb.append(row)
            row = []
    if row:
        kb.append(row)
    settings = context.application.bot_data.get("settings")
    web = getattr(settings, "web_app_url", "") if settings else ""
    url = _build_web_url(web, {"openTaskId": tid})
    if url:
        kb.append([InlineKeyboardButton("🌐 Открыть в системе", url=url)])
    kb.append([InlineKeyboardButton("⟵ К списку", callback_data="t:all")])
    await query.message.reply_text(
        "\n".join(lines), parse_mode="HTML", reply_markup=InlineKeyboardMarkup(kb)
    )


async def _apply_task_status(query, context, api, uid, users, idx: int, sj: int) -> None:
    order = context.user_data.get("task_status_order") or []
    if sj < 0 or sj >= len(order):
        await query.message.reply_text("Статус не найден.")
        return
    pick = context.user_data.get("task_pick_list") or []
    if idx < 0 or idx >= len(pick):
        await query.message.reply_text("Список устарел.")
        return
    tid = pick[idx]
    new_status = order[sj]
    ok = await api.put_tasks([{"id": tid, "status": new_status}])
    if ok:
        sn = user_name(users, uid)
        await query.message.reply_text(f"✅ Статус обновлён ({sn}).")
    else:
        await query.message.reply_text("Не удалось сохранить.")


async def _show_deals_mine(query, context, api, uid, users) -> None:
    deals = await api.get_deals()
    mine = [d for d in deals if not d.get("isArchived") and str(d.get("assigneeId") or "") == uid]
    mine.sort(key=lambda d: str(d.get("updatedAt") or d.get("createdAt") or ""), reverse=True)
    if not mine:
        await query.message.reply_text("Активных сделок на вас нет.")
        return
    pick = [str(d.get("id")) for d in mine[:20]]
    context.user_data["deal_pick_list"] = pick
    lines = [f"🎯 <b>Ваши сделки</b> ({len(mine)})\n"]
    kb = []
    row = []
    for i, d in enumerate(mine[:20]):
        title = (d.get("title") or "—")[:35]
        lines.append(f"{i + 1}. {html.escape(title)}")
        row.append(InlineKeyboardButton(str(i + 1), callback_data=f"d:o:{i:02d}"))
        if len(row) == 5:
            kb.append(row)
            row = []
    if row:
        kb.append(row)
    funnels = [
        f
        for f in await api.get_funnels()
        if not f.get("isArchived")
    ]
    shown = funnels[:6]
    context.user_data["funnel_pick_list"] = [str(f.get("id")) for f in shown]
    for j in range(0, len(shown), 2):
        chunk = shown[j : j + 2]
        kb.append(
            [
                InlineKeyboardButton(
                    str(fn.get("name") or "?")[:22],
                    callback_data=f"d:fn:{(j + k):02d}",
                )
                for k, fn in enumerate(chunk)
            ]
        )
    await query.message.reply_text(
        "\n".join(lines), parse_mode="HTML", reply_markup=InlineKeyboardMarkup(kb)
    )


async def _show_deals_in_funnel(query, context, api, uid, users, funnel_idx: int) -> None:
    ids = context.user_data.get("funnel_pick_list") or []
    if funnel_idx < 0 or funnel_idx >= len(ids):
        await query.message.reply_text("Воронка не найдена. Откройте «Сделки» снова.")
        return
    fid = ids[funnel_idx]
    deals = await api.get_deals()
    subset = [d for d in deals if not d.get("isArchived") and str(d.get("funnelId") or "") == fid]
    subset.sort(
        key=lambda d: str(d.get("updatedAt") or d.get("createdAt") or ""),
        reverse=True,
    )
    if not subset:
        await query.message.reply_text("В этой воронке нет активных сделок.")
        return
    pick = [str(d.get("id")) for d in subset[:20]]
    context.user_data["deal_pick_list"] = pick
    lines = [f"🎯 <b>Сделки в воронке</b> ({len(subset)})\n"]
    kb = []
    row = []
    for i, d in enumerate(subset[:20]):
        title = (d.get("title") or "—")[:35]
        lines.append(f"{i + 1}. {html.escape(title)}")
        row.append(InlineKeyboardButton(str(i + 1), callback_data=f"d:o:{i:02d}"))
        if len(row) == 5:
            kb.append(row)
            row = []
    if row:
        kb.append(row)
    kb.append([InlineKeyboardButton("⟵ Мои сделки", callback_data="d:mine")])
    await query.message.reply_text(
        "\n".join(lines), parse_mode="HTML", reply_markup=InlineKeyboardMarkup(kb)
    )


async def _show_deal_detail(query, context, api, uid, users, idx: int) -> None:
    pick = context.user_data.get("deal_pick_list") or []
    if idx < 0 or idx >= len(pick):
        await query.message.reply_text("Список устарел.")
        return
    did = pick[idx]
    deals = await api.get_deals()
    deal = next((d for d in deals if str(d.get("id")) == did), None)
    if not deal:
        await query.message.reply_text("Сделка не найдена.")
        return
    funnels = await api.get_funnels()
    fid = str(deal.get("funnelId") or "")
    funnel = next((f for f in funnels if str(f.get("id")) == fid), None)
    stages = funnel.get("stages") or [] if funnel else []
    context.user_data["deal_stage_ids"] = [str(s.get("id")) for s in stages]

    title = html.escape(str(deal.get("title") or "—"))
    stage_id = str(deal.get("stage") or "")
    st_label = stage_id
    for s in stages:
        if str(s.get("id")) == stage_id:
            st_label = str(s.get("label") or stage_id)
            break
    amt = deal.get("amount")
    lines = [
        f"🎯 <b>{title}</b>",
        f"Стадия: <i>{html.escape(st_label)}</i>",
        f"Сумма: {html.escape(str(amt))} {html.escape(str(deal.get('currency') or ''))}",
    ]
    kb = []
    row = []
    for j, s in enumerate(stages[:9]):
        label = str(s.get("label") or j)[:14]
        row.append(InlineKeyboardButton(label, callback_data=f"d:s:{idx:02d}:{j:02d}"))
        if len(row) == 3:
            kb.append(row)
            row = []
    if row:
        kb.append(row)
    settings = context.application.bot_data.get("settings")
    web = getattr(settings, "web_app_url", "") if settings else ""
    url = _build_web_url(web, {"openDealId": did})
    if url:
        kb.append([InlineKeyboardButton("🌐 Открыть в системе", url=url)])
    kb.append([InlineKeyboardButton("💬 Комментарий", callback_data=f"d:c:{idx:02d}")])
    kb.append([InlineKeyboardButton("⟵ К списку", callback_data="d:mine")])
    await query.message.reply_text(
        "\n".join(lines), parse_mode="HTML", reply_markup=InlineKeyboardMarkup(kb)
    )


async def _apply_deal_stage(query, context, api, uid, users, idx: int, sj: int) -> None:
    stages = context.user_data.get("deal_stage_ids") or []
    if sj < 0 or sj >= len(stages):
        await query.message.reply_text("Стадия не найдена.")
        return
    new_stage = stages[sj]
    pick = context.user_data.get("deal_pick_list") or []
    if idx < 0 or idx >= len(pick):
        await query.message.reply_text("Список устарел.")
        return
    did = pick[idx]
    deals = await api.get_deals()
    deal = next((d for d in deals if str(d.get("id")) == did), None)
    if not deal:
        await query.message.reply_text("Сделка не найдена.")
        return
    merged = dict(deal)
    merged["stage"] = new_stage
    merged["updatedAt"] = datetime.now(timezone.utc).isoformat()
    ok = await api.put_deals([merged])
    if ok:
        await query.message.reply_text("✅ Стадия обновлена.")
    else:
        await query.message.reply_text("Не удалось сохранить.")


async def _finance_decide(query, context, api, crm, idx: int, new_status: str) -> None:
    if not is_admin(crm):
        await query.message.reply_text("Только для роли ADMIN.")
        return
    pending = context.user_data.get("fin_pending_ids") or []
    if idx < 0 or idx >= len(pending):
        await query.message.reply_text("Список заявок устарел. Откройте «Заявки» снова.")
        return
    rid = pending[idx]
    rows = await api.get_finance_requests()
    row = next((r for r in rows if str(r.get("id")) == str(rid)), None)
    if not row:
        await query.message.reply_text("Заявка не найдена.")
        return
    merged = dict(row)
    merged["status"] = new_status
    merged["decisionDate"] = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    ok = await api.put_finance_requests([merged])
    if ok:
        await query.message.reply_text(
            "✅ Заявка: " + ("согласована" if new_status == "approved" else "отклонена")
        )
    else:
        await query.message.reply_text("Не удалось сохранить.")


def register(application) -> None:
    application.add_handler(
        CallbackQueryHandler(on_callback, pattern=r"^(t:|d:|r:|c:rp:|c:rd:|m:o:)")
    )

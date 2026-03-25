"""Команды для групп: выбор исполнителя, процессы, встречи, недельные планы."""
from __future__ import annotations

import html
import re
import uuid
from datetime import datetime, timedelta, timezone

from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.ext import (
    CallbackQueryHandler,
    CommandHandler,
    ContextTypes,
    ConversationHandler,
    MessageHandler,
    filters,
)

from taska_bot.handlers.crm_context import is_admin, resolve_crm_user, user_name


async def cmd_task_in_group(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not update.message or not update.effective_chat or not update.effective_user:
        return
    if update.effective_chat.type == "private":
        return

    api = context.application.bot_data["api"]
    crm = await api.find_user_by_telegram_id(update.effective_user.id)
    if not crm:
        await update.message.reply_text("Сначала привяжите Telegram: напишите боту в личку и сделайте /start.")
        return

    raw = " ".join(context.args or []).strip()
    if not raw and update.message.reply_to_message:
        raw = (update.message.reply_to_message.text or "").strip()
    if not raw:
        await update.message.reply_text("Использование: /task текст задачи (или ответьте /task на сообщение).")
        return

    creator_uid = str(crm.get("id") or "")
    if not creator_uid:
        await update.message.reply_text("Не удалось определить пользователя в CRM.")
        return

    task_id = str(uuid.uuid4())
    context.user_data["group_task_draft"] = {
        "task_id": task_id,
        "title": raw[:500],
        "creator_uid": creator_uid,
    }

    users = [u for u in await api.get_users() if not u.get("isArchived")]
    context.user_data["group_task_users"] = users

    kb_rows: list[list[InlineKeyboardButton]] = []
    row: list[InlineKeyboardButton] = []
    for idx, u in enumerate(users[:24]):
        name = str(u.get("name") or u.get("login") or u.get("id") or "?")[:18]
        row.append(InlineKeyboardButton(name, callback_data=f"g:taska:{idx:02d}"))
        if len(row) == 3:
            kb_rows.append(row)
            row = []
    if row:
        kb_rows.append(row)

    await update.message.reply_text(
        "Выберите ответственного за задачу:",
        reply_markup=InlineKeyboardMarkup(kb_rows),
    )


async def on_group_task_assignee(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    if not query or not query.data:
        return
    data = query.data
    m = re.fullmatch(r"g:taska:(\d{2})", data)
    if not m:
        return
    idx = int(m.group(1), 10)

    draft = context.user_data.get("group_task_draft") or {}
    users = context.user_data.get("group_task_users") or []
    task_id = draft.get("task_id")
    title = draft.get("title")
    creator_uid = draft.get("creator_uid")
    if not task_id or not title or not creator_uid or not users:
        await query.answer()
        await query.message.reply_text("Список устарел. Повторите /task снова.")
        return
    if idx < 0 or idx >= len(users):
        await query.answer()
        await query.message.reply_text("Пользователь не найден. Повторите /task снова.")
        return

    assignee_uid = str(users[idx].get("id") or "").strip()
    if not assignee_uid:
        await query.answer()
        await query.message.reply_text("У выбранного пользователя нет id в CRM.")
        return

    api = context.application.bot_data["api"]
    statuses = await api.get_statuses()
    priorities = await api.get_priorities()
    st = str(statuses[0].get("name") or "Не начато") if statuses else "Не начато"
    pr = (
        str(priorities[1].get("name") or priorities[0].get("name") or "Средний")
        if priorities
        else "Средний"
    )
    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")

    ok = await api.put_tasks(
        [
            {
                "id": task_id,
                "title": title,
                "description": None,
                "status": st,
                "priority": pr,
                "assigneeId": assignee_uid,
                "assigneeIds": [],
                "endDate": "",
                "isArchived": False,
                "entityType": "task",
                "createdByUserId": creator_uid,
                "createdAt": now,
                "comments": [],
                "source": "telegram_group",
            }
        ]
    )
    creator_name = user_name(users, creator_uid)  # fallback: show id
    assignee_name = user_name(users, assignee_uid)
    if ok:
        await query.message.reply_text(
            f"✅ Задача создана.\n"
            f"От: <b>{html.escape(creator_name)}</b>\n"
            f"Ответственный: <b>{html.escape(assignee_name)}</b>\n"
            f"Текст: <b>{html.escape(title[:120])}</b>",
            parse_mode="HTML",
        )
    else:
        await query.message.reply_text("Не удалось создать задачу.")

    context.user_data.pop("group_task_draft", None)
    context.user_data.pop("group_task_users", None)
    await query.answer()


def register(application) -> None:
    application.add_handler(CommandHandler("task", cmd_task_in_group))
    application.add_handler(
        CallbackQueryHandler(on_group_task_assignee, pattern=r"^g:taska:\d{2}$")
    )

    application.add_handler(CommandHandler("process", cmd_process_start_group))
    application.add_handler(
        CallbackQueryHandler(on_group_process_pick, pattern=r"^g:proc:\d{2}$")
    )

    application.add_handler(CommandHandler("weekly", cmd_weekly_in_group))
    application.add_handler(
        CallbackQueryHandler(on_group_weekly_send, pattern=r"^g:weekly:\d{2}$")
    )

    application.add_handler(build_group_meeting_conversation())

    application.add_handler(CommandHandler("bindgroup", cmd_bind_group))
    application.add_handler(CommandHandler("groupstatus", cmd_group_status))


async def _resolve_admin(update: Update, context: ContextTypes.DEFAULT_TYPE) -> dict | None:
    if not update.effective_user:
        return None
    api = context.application.bot_data["api"]
    crm = await api.find_user_by_telegram_id(update.effective_user.id)
    if not crm:
        return None
    role = str(crm.get("role") or "").upper()
    return crm if role == "ADMIN" else None


async def cmd_bind_group(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not update.message or not update.effective_chat:
        return
    if update.effective_chat.type == "private":
        await update.message.reply_text("Эта команда работает только в группе.")
        return
    admin = await _resolve_admin(update, context)
    if not admin:
        await update.message.reply_text("Только ADMIN с привязанным Telegram может выполнить /bindgroup.")
        return
    api = context.application.bot_data["api"]
    prefs = await api.get_notification_prefs("default") or {}
    prefs["telegramGroupChatId"] = str(update.effective_chat.id)
    gds = dict(prefs.get("groupDailySummary") or {})
    if "telegramGroup" not in gds:
        gds["telegramGroup"] = True
    prefs["groupDailySummary"] = gds
    ok = await api.put_notification_prefs(prefs, "default")
    if ok:
        await update.message.reply_text(
            f"✅ Группа привязана для уведомлений.\nchat_id: <code>{update.effective_chat.id}</code>",
            parse_mode="HTML",
        )
    else:
        await update.message.reply_text("Не удалось сохранить настройки группы.")


async def cmd_group_status(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not update.message:
        return
    api = context.application.bot_data["api"]
    prefs = await api.get_notification_prefs("default") or {}
    cid = str(prefs.get("telegramGroupChatId") or "")
    gds = dict(prefs.get("groupDailySummary") or {})
    enabled = bool(gds.get("telegramGroup", True))
    text = (
        "📣 <b>Статус групповых уведомлений</b>\n"
        f"chat_id: <code>{html.escape(cid or 'не задан')}</code>\n"
        f"groupDailySummary.telegramGroup: <b>{'on' if enabled else 'off'}</b>\n\n"
        "Для привязки текущей группы: /bindgroup (только ADMIN)."
    )
    await update.message.reply_text(text, parse_mode="HTML")


async def _resolve_crm_in_group(update: Update, context: ContextTypes.DEFAULT_TYPE) -> dict | None:
    if not update.effective_user:
        return None
    api = context.application.bot_data["api"]
    return await api.find_user_by_telegram_id(update.effective_user.id)


async def cmd_process_start_group(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not update.message or not update.effective_chat:
        return
    if update.effective_chat.type == "private":
        return

    crm = await _resolve_crm_in_group(update, context)
    if not crm:
        await update.message.reply_text("Сначала привяжите Telegram: напишите боту в личку и сделайте /start.")
        return
    creator_uid = str(crm.get("id") or "")
    if not creator_uid:
        await update.message.reply_text("Не удалось определить пользователя в CRM.")
        return

    api = context.application.bot_data["api"]
    processes = [p for p in await api.get_processes() if not p.get("isArchived") and (p.get("steps") or [])]
    if not processes:
        await update.message.reply_text("В системе нет бизнес-процессов.")
        return
    shown = processes[:12]
    context.user_data["group_proc_creator_uid"] = creator_uid
    context.user_data["group_proc_list"] = shown

    kb = []
    row = []
    for i, p in enumerate(shown):
        label = str(p.get("title") or p.get("id") or "Процесс")[:26]
        row.append(InlineKeyboardButton(label, callback_data=f"g:proc:{i:02d}"))
        if len(row) == 2:
            kb.append(row)
            row = []
    if row:
        kb.append(row)

    await update.message.reply_text(
        "Выберите бизнес-процесс, который запустить:",
        reply_markup=InlineKeyboardMarkup(kb),
    )


async def on_group_process_pick(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    if not query or not query.data:
        return
    m = re.fullmatch(r"g:proc:(\d{2})", query.data)
    if not m:
        return
    idx = int(m.group(1), 10)

    draft_uid = context.user_data.get("group_proc_creator_uid")
    proc_list = context.user_data.get("group_proc_list") or []
    if not draft_uid or not proc_list:
        await query.answer()
        await query.message.reply_text("Список устарел. Повторите команду /process.")
        return
    if idx < 0 or idx >= len(proc_list):
        await query.answer()
        await query.message.reply_text("Процесс не найден. Повторите /process.")
        return

    api = context.application.bot_data["api"]
    creator_uid = str(draft_uid)

    processes_all = await api.get_processes()
    selected = next((p for p in processes_all if str(p.get("id")) == str(proc_list[idx].get("id"))), None)
    if not selected:
        await query.answer()
        await query.message.reply_text("Процесс не найден (обновите список).")
        return
    first_step = (selected.get("steps") or [])[0]
    if not first_step:
        await query.answer()
        await query.message.reply_text("У процесса нет первого шага.")
        return

    # Определяем ответственного: user или position(holderUserId)
    users = [u for u in await api.get_users() if not u.get("isArchived")]
    positions = await api.get_positions()
    assignee_uid: str = ""
    if first_step.get("assigneeType") == "position":
        pos_id = str(first_step.get("assigneeId") or "")
        pos = next((p for p in positions if str(p.get("id")) == pos_id), None)
        assignee_uid = str(pos.get("holderUserId") or "") if pos else ""
    else:
        assignee_uid = str(first_step.get("assigneeId") or "")

    if not assignee_uid:
        await query.answer()
        await query.message.reply_text("Не удалось определить ответственного из первого шага процесса.")
        return

    statuses = await api.get_statuses()
    priorities = await api.get_priorities()
    st = str(statuses[0].get("name") or "Не начато") if statuses else "Не начато"
    pr = str(priorities[1].get("name") if len(priorities) > 1 else (priorities[0].get("name") if priorities else "Средний"))

    now = datetime.now(timezone.utc)
    today = now.strftime("%Y-%m-%d")
    end = (now + timedelta(days=7)).strftime("%Y-%m-%d")
    now_iso = now.isoformat()
    instance_id = f"inst-{int(now.timestamp() * 1000)}"
    task_id = f"task-{int(now.timestamp() * 1000)}"

    # 1) Добавляем экземпляр процесса в BPM
    instances = selected.get("instances") or []
    new_instance = {
        "id": instance_id,
        "processId": selected.get("id"),
        "processVersion": selected.get("version") or 1,
        "currentStepId": first_step.get("id"),
        "status": "active",
        "startedAt": now_iso,
        "taskIds": [task_id],
    }
    selected_updated = dict(selected)
    selected_updated["instances"] = [*instances, new_instance]

    updated_processes = []
    for p in processes_all:
        if str(p.get("id")) == str(selected.get("id")):
            updated_processes.append(selected_updated)
        else:
            updated_processes.append(p)
    ok_proc = await api.put_processes(updated_processes)
    if not ok_proc:
        await query.answer()
        await query.message.reply_text("Не удалось запустить процесс (обновление BPM).")
        return

    # 2) Создаем задачу для первого шага
    first_step_id = str(first_step.get("id") or "")
    step_title = str(first_step.get("title") or "Шаг")
    proc_title = str(selected.get("title") or "Процесс")
    created_task_ok = await api.put_tasks(
        [
            {
                "id": task_id,
                "title": f"{proc_title}: {step_title}",
                "description": first_step.get("description") or "",
                "status": st,
                "priority": pr,
                "assigneeId": assignee_uid,
                "assigneeIds": [],
                "endDate": end,
                "isArchived": False,
                "entityType": "task",
                "createdByUserId": creator_uid,
                "createdAt": now_iso,
                "comments": [],
                "source": "Процесс",
                "startDate": today,
                "processId": selected.get("id"),
                "processInstanceId": instance_id,
                "stepId": first_step_id,
            }
        ]
    )

    if created_task_ok:
        await query.message.reply_text(
            f"✅ Запущен процесс:\n<b>{html.escape(proc_title)}</b>\nШаг: <i>{html.escape(step_title)}</i>\n"
            f"Ответственный: <b>{html.escape(user_name(users, assignee_uid))}</b>",
            parse_mode="HTML",
        )
    else:
        await query.message.reply_text("Процесс обновили, но не удалось создать задачу для первого шага.")

    context.user_data.pop("group_proc_creator_uid", None)
    context.user_data.pop("group_proc_list", None)
    await query.answer()


async def cmd_weekly_in_group(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if not update.message or not update.effective_chat:
        return
    if update.effective_chat.type == "private":
        return

    crm = await _resolve_crm_in_group(update, context)
    if not crm:
        await update.message.reply_text("Сначала привяжите Telegram: напишите боту в личку и сделайте /start.")
        return
    uid = str(crm.get("id") or "")
    if not uid:
        await update.message.reply_text("Не удалось определить пользователя в CRM.")
        return

    api = context.application.bot_data["api"]
    plans = await api.get_weekly_plans(user_id=uid)
    shown = plans[:4]
    if not shown:
        await update.message.reply_text("У вас пока нет недельных планов.")
        return

    context.user_data["group_weekly_plans"] = shown

    kb = []
    row = []
    for i, p in enumerate(shown):
        w = str(p.get("weekStart") or "Неделя")
        label = f"📌 {w}"
        row.append(InlineKeyboardButton(label[:24], callback_data=f"g:weekly:{i:02d}"))
        if len(row) == 2:
            kb.append(row)
            row = []
    if row:
        kb.append(row)

    await update.message.reply_text(
        "Выберите один из последних 4 недельных планов, чтобы отправить в этот чат:",
        reply_markup=InlineKeyboardMarkup(kb),
    )


async def on_group_weekly_send(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    if not query or not query.data:
        return
    m = re.fullmatch(r"g:weekly:(\d{2})", query.data)
    if not m:
        return
    idx = int(m.group(1), 10)

    plans = context.user_data.get("group_weekly_plans") or []
    if not plans or idx < 0 or idx >= len(plans):
        await query.answer()
        await query.message.reply_text("Список планов устарел. Повторите /weekly.")
        return

    api = context.application.bot_data["api"]
    plan = plans[idx]
    week_start = str(plan.get("weekStart") or "")
    notes = str(plan.get("notes") or "")
    task_ids = plan.get("taskIds") or []
    task_count = len(task_ids)
    all_tasks = await api.get_tasks()
    by_id = {str(t.get("id") or ""): t for t in all_tasks if t.get("id")}

    task_lines: list[str] = []
    for tid in [str(x) for x in task_ids if x][:30]:
        t = by_id.get(tid)
        if not t:
            task_lines.append(f"• <i>не найдено</i> — <code>{html.escape(tid)}</code>")
            continue
        title = html.escape(str(t.get("title") or "—"))
        status = html.escape(str(t.get("status") or "—"))
        task_lines.append(f"• <b>{status}</b> — {title}")

    text = (
        f"📌 Недельный план: <b>{html.escape(week_start)}</b>\n"
        f"Заметки: {html.escape(notes[:600]) or '—'}\n"
        f"Задач: <b>{task_count}</b>\n"
    )
    if task_lines:
        text += "\n".join(task_lines)
        if task_count > len(task_lines):
            text += f"\n… и ещё {task_count - len(task_lines)}"

    await query.message.reply_text(text, parse_mode="HTML")
    await query.answer()
    context.user_data.pop("group_weekly_plans", None)


# --- Групповая встреча (wizard) ---
(GM_TITLE, GM_DATE, GM_TIME, GM_PICK) = range(4)


async def gm_meet_cancel(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    for k in ("gm_title", "gm_date", "gm_time", "gm_pick_users", "gm_pick_selected"):
        context.user_data.pop(k, None)
    if update.message:
        await update.message.reply_text("Отменено.")
    return ConversationHandler.END


def _gm_pick_kb(context: ContextTypes.DEFAULT_TYPE) -> InlineKeyboardMarkup:
    users = context.user_data.get("gm_pick_users") or []
    sel = context.user_data.get("gm_pick_selected") or set()
    kb: list[list[InlineKeyboardButton]] = []
    row: list[InlineKeyboardButton] = []
    for i, u in enumerate(users[:36]):
        uid = str(u.get("id") or "")
        mark = "✓ " if uid in sel else ""
        name = str(u.get("name") or u.get("login") or "?")[:16]
        row.append(InlineKeyboardButton(f"{mark}{name}", callback_data=f"gm:mp:{i:02d}"))
        if len(row) == 3:
            kb.append(row)
            row = []
    if row:
        kb.append(row)
    kb.append([InlineKeyboardButton("✅ Создать встречу", callback_data="gm:go")])
    return InlineKeyboardMarkup(kb)


async def gm_meet_entry(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    if not update.message:
        return ConversationHandler.END
    crm = await _resolve_crm_in_group(update, context)
    if not crm:
        await update.message.reply_text("Сначала привяжите Telegram: напишите боту в личку и сделайте /start.")
        return ConversationHandler.END
    creator_uid = str(crm.get("id") or "")
    if not creator_uid:
        await update.message.reply_text("Не удалось определить пользователя в CRM.")
        return ConversationHandler.END

    title = " ".join(context.args or []).strip()
    if not title and update.message.reply_to_message:
        title = (update.message.reply_to_message.text or "").strip()

    if not title:
        await update.message.reply_text("Название встречи:")
        context.user_data["gm_creator_uid"] = creator_uid
        return GM_TITLE

    context.user_data["gm_title"] = title
    context.user_data["gm_creator_uid"] = creator_uid
    await update.message.reply_text("Дата: ГГГГ-ММ-ДД")
    return GM_DATE


async def gm_meet_title(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    context.user_data["gm_title"] = (update.message.text or "").strip()
    if not context.user_data["gm_title"]:
        await update.message.reply_text("Название не может быть пустым. Название встречи:")
        return GM_TITLE
    await update.message.reply_text("Дата: ГГГГ-ММ-ДД")
    return GM_DATE


async def gm_meet_date(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    context.user_data["gm_date"] = (update.message.text or "").strip()
    await update.message.reply_text("Время (ЧЧ:ММ):")
    return GM_TIME


async def gm_meet_time(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    context.user_data["gm_time"] = (update.message.text or "").strip()

    api = context.application.bot_data["api"]
    users = [u for u in await api.get_users() if not u.get("isArchived")]
    context.user_data["gm_pick_users"] = users
    creator_uid = str(context.user_data.get("gm_creator_uid") or "")
    sel = set([creator_uid]) if creator_uid else set()
    context.user_data["gm_pick_selected"] = sel

    await update.message.reply_text(
        "Выберите участников (нажимайте по имени). Можно выбрать несколько:",
        reply_markup=_gm_pick_kb(context),
    )
    return GM_PICK


async def gm_meet_pick_cb(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    query = update.callback_query
    if not query or not query.data:
        return GM_PICK
    await query.answer()

    if query.data == "gm:go":
        api = context.application.bot_data["api"]
        title = context.user_data.get("gm_title") or ""
        date_s = context.user_data.get("gm_date") or ""
        time_s = context.user_data.get("gm_time") or ""
        sel = context.user_data.get("gm_pick_selected") or set()
        if not title or not date_s or not time_s:
            await query.message.reply_text("Проверьте ввод: название/дата/время.")
            return ConversationHandler.END
        if not sel:
            await query.message.reply_text("Нужно выбрать хотя бы одного участника.")
            return GM_PICK
        ok = await api.put_meetings(
            [
                {
                    "id": str(uuid.uuid4()),
                    "title": title[:500],
                    "date": date_s,
                    "time": time_s,
                    "participantIds": list(sel),
                    "type": "work",
                    "recurrence": "none",
                    "isArchived": False,
                }
            ]
        )
        if ok:
            await query.message.reply_text("✅ Встреча создана.")
        else:
            await query.message.reply_text("Не удалось создать встречу.")
        for k in ("gm_title", "gm_date", "gm_time", "gm_creator_uid", "gm_pick_users", "gm_pick_selected"):
            context.user_data.pop(k, None)
        return ConversationHandler.END

    m = re.fullmatch(r"gm:mp:(\d{2})", query.data)
    if not m:
        return GM_PICK
    idx = int(m.group(1), 10)
    users = context.user_data.get("gm_pick_users") or []
    if idx < 0 or idx >= len(users):
        return GM_PICK
    uid = str(users[idx].get("id") or "")
    sel = context.user_data.get("gm_pick_selected") or set()
    if uid in sel:
        sel.remove(uid)
    else:
        sel.add(uid)
    context.user_data["gm_pick_selected"] = sel
    await query.edit_message_reply_markup(reply_markup=_gm_pick_kb(context))
    return GM_PICK


def build_group_meeting_conversation() -> ConversationHandler:
    return ConversationHandler(
        entry_points=[CommandHandler("meeting", gm_meet_entry, filters=filters.ChatType.GROUPS)],
        states={
            GM_TITLE: [MessageHandler(filters.TEXT & ~filters.COMMAND, gm_meet_title)],
            GM_DATE: [MessageHandler(filters.TEXT & ~filters.COMMAND, gm_meet_date)],
            GM_TIME: [MessageHandler(filters.TEXT & ~filters.COMMAND, gm_meet_time)],
            GM_PICK: [CallbackQueryHandler(gm_meet_pick_cb, pattern=r"^gm:")],
        },
        fallbacks=[CommandHandler("cancel_meeting", gm_meet_cancel)],
        name="group_meeting_create",
        allow_reentry=False,
    )


"""
Главный файл Telegram бота
"""
# ВАЖНО: Этот файл должен обновляться при каждом деплое!
# Если версия не меняется в логах - проверьте кэш Python и systemd service

import asyncio
import logging
import sys
import os
import subprocess
from datetime import datetime
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import (
    Application,
    CommandHandler,
    CallbackQueryHandler,
    MessageHandler,
    ConversationHandler,
    filters,
    ContextTypes
)
import config
from auth import authenticate_user, check_user_active, update_user_password, update_user_avatar
from firebase_client import firebase
from keyboards import (
    get_main_menu, get_tasks_menu, get_deals_menu, get_deal_menu, get_task_menu,
    get_settings_menu, get_profile_menu, get_statuses_keyboard, get_stages_keyboard,
    get_funnels_keyboard, get_clients_keyboard, get_users_keyboard, get_confirm_keyboard,
    get_back_button, get_tasks_list_keyboard
)
from messages import format_task_message, format_deal_message, format_meeting_message, format_document_message
from tasks import (
    get_user_tasks, get_today_tasks, get_overdue_tasks, get_task_by_id,
    update_task_status, create_task, get_statuses
)
from deals import (
    get_all_deals, get_user_deals, get_deal_by_id, create_deal, update_deal,
    update_deal_stage, delete_deal, search_deals, get_sales_funnels, get_funnel_stages,
    get_won_deals_today
)
from clients import get_all_clients, get_client_by_id, create_client, search_clients
from profile import get_user_profile, format_profile_message
from notifications import (
    check_new_tasks, check_new_deals, check_upcoming_meetings,
    get_successful_deal_message
)
from notification_queue import (
    get_pending_notifications, mark_notification_sent, cleanup_old_notifications
)
from scheduler import TaskScheduler
from utils import get_today_date, is_overdue

# Версия кода - определяем ДО всего остального
CODE_VERSION_AT_START = "2026-01-24-refactored"
BOT_FILE_PATH = os.path.abspath(__file__)

# Настройка логирования
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO,
    force=True  # Принудительно перезаписываем конфигурацию
)
logger = logging.getLogger(__name__)

# ВАЖНО: Отключаем INFO логи для httpx, чтобы токен не попадал в логи
# httpx логирует полные URL запросов вида https://api.telegram.org/bot<TOKEN>/...
# Устанавливаем WARNING, чтобы видеть только ошибки, а не все запросы
logging.getLogger("httpx").setLevel(logging.WARNING)

# Также настраиваем telegram логгеры
# telegram.ext оставляем на INFO для отладки бота, но без URL с токенами
logging.getLogger("telegram").setLevel(logging.WARNING)
logging.getLogger("telegram.ext").setLevel(logging.INFO)

# Логируем версию кода СРАЗУ после настройки логирования
logger.info("=" * 60)
logger.info(f"[BOT] ===== MODULE LOADED ===== Code version: {CODE_VERSION_AT_START} =====")
logger.info(f"[BOT] Bot file path: {BOT_FILE_PATH}")
logger.info(f"[BOT] Bot file exists: {os.path.exists(BOT_FILE_PATH)}")
if os.path.exists(BOT_FILE_PATH):
    logger.info(f"[BOT] Bot file modified: {os.path.getmtime(BOT_FILE_PATH)}")
logger.info("=" * 60)

# Также выводим в stdout/stderr для systemd
print(f"[BOT] ===== MODULE LOADED ===== Code version: {CODE_VERSION_AT_START} =====", flush=True)
print(f"[BOT] Bot file path: {BOT_FILE_PATH}", flush=True)

# Состояния для ConversationHandler
(LOGIN, PASSWORD) = range(2)
# Состояния для создания задачи из сообщения в группе
(TASK_FROM_MESSAGE_TITLE, TASK_FROM_MESSAGE_DATE, TASK_FROM_MESSAGE_ASSIGNEE) = range(2, 5)
# Состояние для ввода ID группового чата
SETTING_GROUP_CHAT_ID = 5

# Хранилище сессий пользователей (в продакшене использовать Redis)
user_sessions = {}  # {telegram_user_id: {user_id: str, last_check: datetime}}

# Хранилище состояний для создания/редактирования
user_states = {}  # {telegram_user_id: {state: str, data: dict}}

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Обработчик команды /start. Авторизация только в личных сообщениях."""
    try:
        chat_type = update.effective_chat.type if update.effective_chat else "unknown"
        if chat_type not in ("private",):
            await update.message.reply_text(
                "👋 Для авторизации и работы с системой напишите боту в личные сообщения (Private message).\n\n"
                "Откройте бота по имени и нажмите «Начать» или отправьте /start."
            )
            return ConversationHandler.END

        telegram_user_id = update.effective_user.id
        username = update.effective_user.username or update.effective_user.first_name or "Unknown"
        logger.info(f"[START] Command received from user {telegram_user_id} (@{username}) [private]")
        
        # Проверяем, авторизован ли пользователь
        if telegram_user_id in user_sessions:
            user_id = user_sessions[telegram_user_id]['user_id']
            if check_user_active(user_id):
                logger.info(f"[START] User {telegram_user_id} already authorized")
                await update.message.reply_text(
                    "Вы уже авторизованы! Используйте меню для навигации.",
                    reply_markup=get_main_menu()
                )
                return ConversationHandler.END
        
        logger.info(f"[START] Starting authorization for user {telegram_user_id}")
        await update.message.reply_text(
            "Добро пожаловать в бот системы управления задачами!\n\n"
            "Для начала работы необходимо авторизоваться.\n"
            "Введите ваш логин:"
        )
        return LOGIN
    except Exception as e:
        logger.error(f"[START] Error in start handler: {e}", exc_info=True)
        try:
            await update.message.reply_text(
                "Произошла ошибка при обработке команды. Попробуйте еще раз."
            )
        except:
            pass
        return ConversationHandler.END

async def login(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Обработчик ввода логина (только в личке)."""
    try:
        if update.effective_chat and update.effective_chat.type != "private":
            await update.message.reply_text("Авторизация только в личных сообщениях. Напишите боту в личку.")
            return ConversationHandler.END
        login_text = update.message.text.strip()
        logger.info(f"[LOGIN] User {update.effective_user.id} entered login: {login_text[:3]}...")
        context.user_data['login'] = login_text
        
        await update.message.reply_text("Введите ваш пароль:")
        return PASSWORD
    except Exception as e:
        logger.error(f"[LOGIN] Error: {e}", exc_info=True)
        try:
            await update.message.reply_text("Произошла ошибка. Попробуйте еще раз.")
        except:
            pass
        return ConversationHandler.END

async def password(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Обработчик ввода пароля (только в личке)."""
    try:
        if update.effective_chat and update.effective_chat.type != "private":
            await update.message.reply_text("Авторизация только в личных сообщениях. Напишите боту в личку.")
            return ConversationHandler.END
        password_text = update.message.text
        login_text = context.user_data.get('login')
        logger.info(f"[PASSWORD] User {update.effective_user.id} attempting login: {login_text}")
        
        # Аутентификация
        user = authenticate_user(login_text, password_text)
        
        if user:
            telegram_user_id = update.effective_user.id
            user_sessions[telegram_user_id] = {
                'user_id': user['id'],
                'last_check': datetime.now()
            }
            
            # Сохраняем telegram_user_id в профиле пользователя
            user['telegramUserId'] = str(telegram_user_id)
            firebase.save('users', user)
            
            logger.info(f"[PASSWORD] User {telegram_user_id} authenticated successfully as {user.get('name', 'Unknown')}")
            await update.message.reply_text(
                f"✅ Авторизация успешна!\n\n"
                f"Добро пожаловать, {user.get('name', 'Пользователь')}!",
                reply_markup=get_main_menu()
            )
            return ConversationHandler.END
        else:
            logger.warning(f"[PASSWORD] User {update.effective_user.id} failed authentication for login: {login_text}")
            await update.message.reply_text(
                "❌ Неверный логин или пароль. Попробуйте еще раз.\n"
                "Используйте команду /start для повторной попытки."
            )
            return ConversationHandler.END
    except Exception as e:
        logger.error(f"[PASSWORD] Error: {e}", exc_info=True)
        try:
            await update.message.reply_text("Произошла ошибка при авторизации. Попробуйте еще раз.")
        except:
            pass
        return ConversationHandler.END

async def logout(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обработчик команды /logout"""
    telegram_user_id = update.effective_user.id
    if telegram_user_id in user_sessions:
        del user_sessions[telegram_user_id]
    if telegram_user_id in user_states:
        del user_states[telegram_user_id]
    
    await update.message.reply_text("Вы вышли из системы. Используйте /start для повторной авторизации.")

async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обработчик команды /help"""
    help_text = (
        "📖 Справка по боту\n\n"
        "Основные команды:\n"
        "/start - Начать работу с ботом\n"
        "/logout - Выйти из системы\n"
        "/help - Показать эту справку\n\n"
        "Используйте кнопки меню для навигации по функциям бота."
    )
    await update.message.reply_text(help_text)

def require_auth(func):
    """Декоратор для проверки авторизации"""
    async def wrapper(update: Update, context: ContextTypes.DEFAULT_TYPE, *args, **kwargs):
        telegram_user_id = update.effective_user.id
        
        if telegram_user_id not in user_sessions:
            await update.callback_query.answer("❌ Вы не авторизованы. Используйте /start")
            return
        
        user_id = user_sessions[telegram_user_id]['user_id']
        if not check_user_active(user_id):
            del user_sessions[telegram_user_id]
            await update.callback_query.answer("❌ Ваш аккаунт был деактивирован. Используйте /start")
            return
        
        return await func(update, context, *args, **kwargs)
    return wrapper

@require_auth
async def menu_main(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Главное меню"""
    query = update.callback_query
    await query.answer()
    await query.edit_message_text("🏠 Главное меню", reply_markup=get_main_menu())

@require_auth
async def menu_tasks(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Меню задач"""
    query = update.callback_query
    await query.answer()
    await query.edit_message_text("📋 Задачи", reply_markup=get_tasks_menu())

@require_auth
async def tasks_all(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Все задачи пользователя"""
    query = update.callback_query
    await query.answer()
    
    telegram_user_id = update.effective_user.id
    user_id = user_sessions[telegram_user_id]['user_id']
    
    all_user_tasks = get_user_tasks(user_id)
    
    if not all_user_tasks:
        await query.edit_message_text(
            "✅ У вас нет активных задач!",
            reply_markup=get_tasks_menu()
        )
        return
    
    # Показываем список с фильтрами (по умолчанию "all")
    await show_tasks_list(query, all_user_tasks, 'all', 0)

@require_auth
async def tasks_filter(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Фильтрация задач"""
    query = update.callback_query
    await query.answer()
    
    telegram_user_id = update.effective_user.id
    user_id = user_sessions[telegram_user_id]['user_id']
    
    # Парсим callback_data: tasks_filter_{filter_type}_{page}
    data = query.data.split('_')
    filter_type = data[2]  # all, today, overdue
    page = int(data[3]) if len(data) > 3 else 0
    
    # Получаем все задачи
    all_user_tasks = get_user_tasks(user_id)
    
    # Применяем фильтр
    filtered_tasks = []
    if filter_type == 'today':
        filtered_tasks = get_today_tasks(user_id)
    elif filter_type == 'overdue':
        filtered_tasks = get_overdue_tasks(user_id)
    else:  # all
        filtered_tasks = all_user_tasks
    
    await show_tasks_list(query, filtered_tasks, filter_type, page)

@require_auth
async def tasks_page(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Навигация по страницам задач"""
    query = update.callback_query
    await query.answer()
    
    telegram_user_id = update.effective_user.id
    user_id = user_sessions[telegram_user_id]['user_id']
    
    # Парсим callback_data: tasks_page_{filter_type}_{page}
    data = query.data.split('_')
    filter_type = data[2]  # all, today, overdue
    page = int(data[3]) if len(data) > 3 else 0
    
    # Получаем все задачи
    all_user_tasks = get_user_tasks(user_id)
    
    # Применяем фильтр
    filtered_tasks = []
    if filter_type == 'today':
        filtered_tasks = get_today_tasks(user_id)
    elif filter_type == 'overdue':
        filtered_tasks = get_overdue_tasks(user_id)
    else:  # all
        filtered_tasks = all_user_tasks
    
    await show_tasks_list(query, filtered_tasks, filter_type, page)

async def show_tasks_list(query, tasks: list, filter_type: str, page: int):
    """Показать список задач с фильтрами и навигацией"""
    page_size = 10
    start_idx = page * page_size
    end_idx = start_idx + page_size
    total = len(tasks)
    
    # Формируем сообщение
    filter_names = {
        'all': 'Все задачи',
        'today': 'Задачи на сегодня',
        'overdue': 'Просроченные задачи'
    }
    filter_name = filter_names.get(filter_type, 'Все задачи')
    
    message = f"📋 {filter_name} ({total}):\n\n"
    
    if total == 0:
        message += "✅ Задач не найдено"
    else:
        page_tasks = tasks[start_idx:end_idx]
        for i, task in enumerate(page_tasks, start=start_idx + 1):
            task_title = task.get('title', 'Без названия')
            end_date = task.get('endDate', '')
            status = task.get('status', 'Не начато')
            
            # Форматируем дату если есть
            date_str = ""
            if end_date:
                try:
                    if 'T' in end_date:
                        end_date = end_date.split('T')[0]
                    elif ' ' in end_date:
                        end_date = end_date.split(' ')[0]
                    from datetime import datetime
                    date_obj = datetime.strptime(end_date, '%Y-%m-%d')
                    date_str = f" | 📅 {date_obj.strftime('%d.%m.%Y')}"
                except:
                    date_str = f" | 📅 {end_date}"
            
            message += f"{i}. {task_title}{date_str}\n   Статус: {status}\n\n"
        
        if total > page_size:
            message += f"\nСтраница {page + 1} из {(total + page_size - 1) // page_size}"
    
    keyboard = get_tasks_list_keyboard(tasks, filter_type, page, page_size)
    
    try:
        await query.edit_message_text(
            message,
            reply_markup=keyboard
        )
    except Exception as e:
        logger.error(f"Error showing tasks list: {e}", exc_info=True)

@require_auth
async def task_create(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Создать новую задачу"""
    query = update.callback_query
    await query.answer()
    
    telegram_user_id = update.effective_user.id
    user_id = user_sessions[telegram_user_id]['user_id']
    
    # Устанавливаем состояние для создания задачи
    user_states[telegram_user_id] = {
        'state': 'creating_task',
        'data': {}
    }
    
    await query.edit_message_text(
        "➕ Создание новой задачи\n\n"
        "Введите название задачи:",
        reply_markup=get_back_button("menu_tasks")
    )

@require_auth
async def task_detail(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Детальная информация о задаче"""
    query = update.callback_query
    await query.answer()
    
    task_id = query.data.split('_')[1]
    task = get_task_by_id(task_id)
    
    if not task:
        await query.edit_message_text("❌ Задача не найдена", reply_markup=get_tasks_menu())
        return
    
    users = firebase.get_all('users')
    projects = firebase.get_all('projects')
    message = format_task_message(task, users, projects)
    
    await query.edit_message_text(message, reply_markup=get_task_menu(task_id))

@require_auth
async def task_set_status(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Изменить статус задачи"""
    query = update.callback_query
    await query.answer()
    
    parts = query.data.split('_')
    task_id = parts[3]
    new_status = parts[4] if len(parts) > 4 else None
    
    if new_status:
        # Устанавливаем статус
        task = get_task_by_id(task_id)
        if task:
            statuses = get_statuses()
            status_obj = next((s for s in statuses if s.get('id') == new_status or s.get('name') == new_status), None)
            if status_obj:
                status_name = status_obj.get('name', new_status)
                update_task_status(task_id, status_name)
                await query.edit_message_text(
                    f"✅ Статус задачи изменен на: {status_name}",
                    reply_markup=get_task_menu(task_id)
                )
            else:
                await query.answer("❌ Статус не найден")
        else:
            await query.answer("❌ Задача не найдена")
    else:
        # Показываем список статусов
        statuses = get_statuses()
        if not statuses:
            await query.answer("❌ Статусы не найдены")
            return
        
        await query.edit_message_text(
            "Выберите новый статус:",
            reply_markup=get_statuses_keyboard(statuses, task_id)
        )

@require_auth
async def menu_deals(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Меню сделок"""
    query = update.callback_query
    await query.answer()
    await query.edit_message_text("🎯 Сделки", reply_markup=get_deals_menu())

@require_auth
async def deals_all(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Все сделки"""
    query = update.callback_query
    await query.answer()
    
    # Получаем только активные сделки (не архивные)
    deals = get_all_deals(include_archived=False)
    funnels = get_sales_funnels()
    
    if not deals:
        await query.edit_message_text(
            "📭 Сделок нет",
            reply_markup=get_deals_menu()
        )
        return
    
    # Показываем список воронок для фильтрации
    if funnels:
        message = f"🎯 Все сделки ({len(deals)})\n\nВыберите воронку для фильтрации:"
        keyboard = []
        keyboard.append([InlineKeyboardButton("📊 Все сделки", callback_data="deals_all_show")])
        for funnel in funnels:
            funnel_name = funnel.get('name', funnel.get('id', ''))[:30]
            keyboard.append([
                InlineKeyboardButton(
                    f"🎯 {funnel_name}",
                    callback_data=f"deals_funnel_{funnel.get('id', '')}"
                )
            ])
        keyboard.append([InlineKeyboardButton("🔙 Назад", callback_data="menu_deals")])
        
        await query.edit_message_text(
            message,
            reply_markup=InlineKeyboardMarkup(keyboard)
        )
    else:
        # Если воронок нет, показываем все сделки
        await deals_all_show(update, context)

@require_auth
async def deals_all_show(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Показать все сделки (без фильтрации)"""
    query = update.callback_query
    await query.answer()
    
    deals = get_all_deals(include_archived=False)
    clients = firebase.get_all('clients')
    users = firebase.get_all('users')
    
    if not deals:
        await query.edit_message_text(
            "📭 Сделок нет",
            reply_markup=get_deals_menu()
        )
        return
    
    message = f"🎯 Все сделки ({len(deals)}):\n\n"
    keyboard = []
    for deal in deals[:20]:  # Ограничиваем 20 сделками
        deal_id = deal.get('id', '')
        deal_title = deal.get('title', deal.get('contactName', 'Без названия'))[:30]
        keyboard.append([
            InlineKeyboardButton(
                f"🎯 {deal_title}",
                callback_data=f"deal_{deal_id}"
            )
        ])
    keyboard.append([InlineKeyboardButton("🔙 Назад", callback_data="menu_deals")])
    
    await query.edit_message_text(
        message,
        reply_markup=InlineKeyboardMarkup(keyboard)
    )

@require_auth
async def deals_funnel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Сделки по воронке - выбор этапа"""
    query = update.callback_query
    await query.answer()
    
    parts = query.data.split('_')
    funnel_id = parts[2] if len(parts) > 2 else None
    
    if not funnel_id:
        await query.answer("❌ Воронка не указана")
        return
    
    funnel = firebase.get_by_id('salesFunnels', funnel_id)
    
    if not funnel:
        await query.answer("❌ Воронка не найдена")
        return
    
    # Получаем стадии воронки
    stages = get_funnel_stages(funnel_id)
    
    if not stages:
        await query.edit_message_text(
            f"❌ В воронке '{funnel.get('name', '')}' нет стадий",
            reply_markup=get_deals_menu()
        )
        return
    
    # Показываем выбор стадии
    message = f"🎯 Воронка: {funnel.get('name', '')}\n\nВыберите этап воронки:"
    keyboard = []
    keyboard.append([InlineKeyboardButton("📊 Все этапы", callback_data=f"deals_funnel_stage_all_{funnel_id}")])
    for stage in stages:
        stage_name = stage.get('name', stage.get('id', ''))[:30]
        keyboard.append([
            InlineKeyboardButton(
                f"📌 {stage_name}",
                callback_data=f"deals_funnel_stage_{funnel_id}_{stage.get('id', '')}"
            )
        ])
    keyboard.append([InlineKeyboardButton("🔙 Назад", callback_data="deals_all")])
    
    await query.edit_message_text(
        message,
        reply_markup=InlineKeyboardMarkup(keyboard)
    )

@require_auth
async def deals_funnel_stage(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Сделки по воронке и этапу"""
    query = update.callback_query
    await query.answer()
    
    parts = query.data.split('_')
    funnel_id = parts[3] if len(parts) > 3 else None
    stage_id = parts[4] if len(parts) > 4 else None
    
    if not funnel_id:
        await query.answer("❌ Воронка не указана")
        return
    
    funnel = firebase.get_by_id('salesFunnels', funnel_id)
    
    if not funnel:
        await query.answer("❌ Воронка не найдена")
        return
    
    deals = get_all_deals(include_archived=False)
    
    # Фильтруем сделки по воронке и этапу
    if stage_id == 'all':
        # Все сделки воронки
        funnel_deals = [d for d in deals if d.get('funnelId') == funnel_id]
        stage_name = "Все этапы"
    else:
        # Сделки конкретного этапа
        funnel_deals = [d for d in deals if d.get('funnelId') == funnel_id and d.get('stage') == stage_id]
        stages = get_funnel_stages(funnel_id)
        stage = next((s for s in stages if s.get('id') == stage_id), None)
        stage_name = stage.get('name', stage_id) if stage else stage_id
    
    if not funnel_deals:
        await query.edit_message_text(
            f"📭 Сделок в воронке '{funnel.get('name', '')}' на этапе '{stage_name}' нет",
            reply_markup=get_deals_menu()
        )
        return
    
    message = f"🎯 Воронка: {funnel.get('name', '')}\n📌 Этап: {stage_name}\n\nСделки ({len(funnel_deals)}):\n\n"
    keyboard = []
    for deal in funnel_deals[:20]:
        deal_id = deal.get('id', '')
        deal_title = deal.get('title', deal.get('contactName', 'Без названия'))[:30]
        keyboard.append([
            InlineKeyboardButton(
                f"🎯 {deal_title}",
                callback_data=f"deal_{deal_id}"
            )
        ])
    keyboard.append([InlineKeyboardButton("🔙 Назад", callback_data=f"deals_funnel_{funnel_id}")])
    
    await query.edit_message_text(
        message,
        reply_markup=InlineKeyboardMarkup(keyboard)
    )

@require_auth
async def deals_new(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Новые заявки (на этапе 'НОВАЯ ЗАЯВКА')"""
    query = update.callback_query
    await query.answer()
    
    deals = get_all_deals(include_archived=False)
    
    # Фильтруем сделки на этапе "НОВАЯ ЗАЯВКА"
    # Ищем по stage = "НОВАЯ ЗАЯВКА" или похожим значениям
    new_deals = []
    for deal in deals:
        stage = deal.get('stage', '').lower()
        if 'новая' in stage or 'new' in stage or stage == 'new':
            new_deals.append(deal)
    
    if not new_deals:
        await query.edit_message_text(
            "📭 Новых заявок нет",
            reply_markup=get_deals_menu()
        )
        return
    
    message = f"🆕 Новые заявки ({len(new_deals)}):\n\n"
    keyboard = []
    for deal in new_deals[:20]:  # Ограничиваем 20 сделками
        deal_id = deal.get('id', '')
        deal_title = deal.get('title', deal.get('contactName', 'Без названия'))[:30]
        keyboard.append([
            InlineKeyboardButton(
                f"🆕 {deal_title}",
                callback_data=f"deal_{deal_id}"
            )
        ])
    keyboard.append([InlineKeyboardButton("🔙 Назад", callback_data="menu_deals")])
    
    await query.edit_message_text(
        message,
        reply_markup=InlineKeyboardMarkup(keyboard)
    )

@require_auth
async def deals_mine(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Мои заявки"""
    query = update.callback_query
    await query.answer()
    
    telegram_user_id = update.effective_user.id
    user_id = user_sessions[telegram_user_id]['user_id']
    
    deals = get_user_deals(user_id, include_archived=False)
    clients = firebase.get_all('clients')
    users = firebase.get_all('users')
    
    if not deals:
        await query.edit_message_text(
            "📭 У вас нет заявок",
            reply_markup=get_deals_menu()
        )
        return
    
    message = f"👤 Мои заявки ({len(deals)}):\n\n"
    keyboard = []
    for deal in deals[:20]:  # Ограничиваем 20 сделками
        deal_id = deal.get('id', '')
        deal_title = deal.get('title', deal.get('contactName', 'Без названия'))[:30]
        keyboard.append([
            InlineKeyboardButton(
                f"🎯 {deal_title}",
                callback_data=f"deal_{deal_id}"
            )
        ])
    keyboard.append([InlineKeyboardButton("🔙 Назад", callback_data="menu_deals")])
    
    await query.edit_message_text(
        message,
        reply_markup=InlineKeyboardMarkup(keyboard)
    )

@require_auth
async def deal_create(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Создать новую заявку"""
    query = update.callback_query
    await query.answer()
    
    telegram_user_id = update.effective_user.id
    user_id = user_sessions[telegram_user_id]['user_id']
    
    # Устанавливаем состояние для создания сделки
    user_states[telegram_user_id] = {
        'state': 'creating_deal',
        'data': {'assigneeId': user_id}
    }
    
    # Показываем выбор воронки
    funnels = get_sales_funnels()
    if funnels:
        await query.edit_message_text(
            "➕ Создание новой заявки\n\nВыберите воронку:",
            reply_markup=get_funnels_keyboard(funnels, "deal_create_funnel")
        )
    else:
        await query.edit_message_text(
            "➕ Создание новой заявки\n\nВведите название заявки:",
            reply_markup=get_back_button("menu_deals")
        )

@require_auth
async def deal_create_funnel(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Выбор воронки при создании сделки"""
    query = update.callback_query
    await query.answer()
    
    parts = query.data.split('_')
    funnel_id = parts[3] if len(parts) > 3 else None
    
    if not funnel_id:
        await query.answer("❌ Воронка не указана")
        return
    
    telegram_user_id = update.effective_user.id
    if telegram_user_id not in user_states:
        user_states[telegram_user_id] = {'state': 'creating_deal', 'data': {}}
    
    user_states[telegram_user_id]['data']['funnelId'] = funnel_id
    
    # Получаем этапы воронки
    stages = get_funnel_stages(funnel_id)
    funnel = firebase.get_by_id('salesFunnels', funnel_id)
    funnel_name = funnel.get('name', '') if funnel else ''
    
    if stages and len(stages) > 0:
        # Если есть этапы, показываем их для выбора
        user_states[telegram_user_id]['state'] = 'creating_deal_stage'
        
        keyboard = []
        for stage in stages:
            keyboard.append([
                InlineKeyboardButton(
                    stage.get('name', stage.get('id', '')),
                    callback_data=f"deal_create_stage_{funnel_id}_{stage.get('id', '')}"
                )
            ])
        keyboard.append([InlineKeyboardButton("🔙 Назад", callback_data="deal_create")])
        
        await query.edit_message_text(
            f"➕ Создание новой заявки\n\nВоронка: {funnel_name}\n\nВыберите этап:",
            reply_markup=InlineKeyboardMarkup(keyboard)
        )
    else:
        # Если этапов нет, сразу переходим к вводу названия
        user_states[telegram_user_id]['state'] = 'creating_deal_title'
        await query.edit_message_text(
            f"➕ Создание новой заявки\n\nВоронка: {funnel_name}\n\nВведите название заявки:",
            reply_markup=get_back_button("menu_deals")
        )

@require_auth
async def deal_create_stage(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Выбор этапа воронки при создании сделки"""
    query = update.callback_query
    await query.answer()
    
    parts = query.data.split('_')
    funnel_id = parts[3] if len(parts) > 3 else None
    stage_id = parts[4] if len(parts) > 4 else None
    
    if not funnel_id or not stage_id:
        await query.answer("❌ Этап не указан")
        return
    
    telegram_user_id = update.effective_user.id
    if telegram_user_id not in user_states:
        user_states[telegram_user_id] = {'state': 'creating_deal', 'data': {}}
    
    # Сохраняем выбранный этап
    user_states[telegram_user_id]['data']['stage'] = stage_id
    user_states[telegram_user_id]['state'] = 'creating_deal_title'
    
    # Получаем название этапа
    stages = get_funnel_stages(funnel_id)
    stage = next((s for s in stages if s.get('id') == stage_id), None)
    stage_name = stage.get('name', '') if stage else ''
    
    funnel = firebase.get_by_id('salesFunnels', funnel_id)
    funnel_name = funnel.get('name', '') if funnel else ''
    
    await query.edit_message_text(
        f"➕ Создание новой заявки\n\nВоронка: {funnel_name}\nЭтап: {stage_name}\n\nВведите название заявки:",
        reply_markup=get_back_button("menu_deals")
    )

@require_auth
async def deal_detail(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Детальная информация о сделке"""
    query = update.callback_query
    await query.answer()
    
    deal_id = query.data.split('_')[1]
    deal = get_deal_by_id(deal_id)
    
    if not deal:
        await query.edit_message_text("❌ Сделка не найдена", reply_markup=get_deals_menu())
        return
    
    clients = firebase.get_all('clients')
    users = firebase.get_all('users')
    funnels = get_sales_funnels()
    message = format_deal_message(deal, clients, users, funnels)
    
    await query.edit_message_text(message, reply_markup=get_deal_menu(deal_id))

@require_auth
async def deal_set_stage(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Изменить стадию сделки"""
    query = update.callback_query
    await query.answer()
    
    parts = query.data.split('_')
    deal_id = parts[3]
    new_stage = parts[4] if len(parts) > 4 else None
    
    if new_stage:
        # Устанавливаем стадию
        deal = get_deal_by_id(deal_id)
        if deal:
            update_deal_stage(deal_id, new_stage)
            
            # Проверяем, не перешла ли сделка в стадию "won"
            if new_stage == 'won':
                # Отправляем уведомление в групповой чат
                notification_prefs = firebase.get_by_id('notificationPrefs', 'default')
                telegram_chat_id = notification_prefs.get('telegramGroupChatId') if notification_prefs else None
                
                if telegram_chat_id:
                    clients = firebase.get_all('clients')
                    users = firebase.get_all('users')
                    message = get_successful_deal_message(deal, clients, users)
                    if message:
                        try:
                            await context.bot.send_message(
                                chat_id=telegram_chat_id,
                                text=message,
                                parse_mode='HTML'
                            )
                            logger.info(f"Successfully sent deal notification to group {telegram_chat_id}")
                        except Exception as e:
                            logger.error(f"Error sending successful deal message: {e}")
                else:
                    logger.warning("No telegramGroupChatId configured for deal notifications")
            
            await query.edit_message_text(
                f"✅ Стадия сделки изменена",
                reply_markup=get_deal_menu(deal_id)
            )
        else:
            await query.answer("❌ Сделка не найдена")
    else:
        # Показываем список стадий
        deal = get_deal_by_id(deal_id)
        if not deal:
            await query.answer("❌ Сделка не найдена")
            return
        
        funnel_id = deal.get('funnelId')
        if not funnel_id:
            await query.answer("❌ У сделки не указана воронка")
            return
        
        stages = get_funnel_stages(funnel_id)
        if not stages:
            await query.answer("❌ Стадии не найдены")
            return
        
        await query.edit_message_text(
            "Выберите новую стадию:",
            reply_markup=get_stages_keyboard(stages, deal_id)
        )

@require_auth
async def deal_delete(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Удалить сделку в архив"""
    query = update.callback_query
    await query.answer()
    
    parts = query.data.split('_')
    deal_id = parts[2] if len(parts) > 2 else None
    
    if not deal_id:
        await query.answer("❌ Сделка не указана")
        return
    
    deal = get_deal_by_id(deal_id)
    if not deal:
        await query.answer("❌ Сделка не найдена")
        return
    
    # Проверяем, не подтверждено ли удаление
    if 'confirm' not in query.data:
        # Показываем подтверждение
        await query.edit_message_text(
            f"🗑️ Вы уверены, что хотите удалить сделку '{deal.get('title', deal.get('contactName', 'Без названия'))}' в архив?",
            reply_markup=get_confirm_keyboard("deal_delete", deal_id, f"deal_delete_{deal_id}_confirm")
        )
        return
    
    # Удаляем в архив
    if delete_deal(deal_id):
        await query.edit_message_text(
            "✅ Сделка удалена в архив",
            reply_markup=get_deals_menu()
        )
    else:
        await query.answer("❌ Ошибка при удалении сделки")

@require_auth
async def group_id_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Команда /group_id - показать ID группового чата"""
    try:
        if not update.message:
            return
        
        chat_id = update.message.chat.id
        chat_type = update.message.chat.type
        
        # Команда работает только в группах
        if chat_type not in ['group', 'supergroup']:
            await update.message.reply_text(
                "❌ Эта команда работает только в групповых чатах.\n"
                "Добавьте бота в группу и используйте команду там."
            )
            return
        
        await update.message.reply_text(
            f"💬 ID этого группового чата:\n\n`{chat_id}`\n\n"
            "Скопируйте этот ID и используйте его в настройках уведомлений бота.",
            parse_mode='Markdown'
        )
        
    except Exception as e:
        logger.error(f"Error in group_id_command: {e}", exc_info=True)
        try:
            await update.message.reply_text("❌ Произошла ошибка.")
        except:
            pass

@require_auth
async def menu_profile(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Меню профиля"""
    query = update.callback_query
    await query.answer()
    
    telegram_user_id = update.effective_user.id
    user_id = user_sessions[telegram_user_id]['user_id']
    
    user = get_user_profile(user_id)
    if user:
        message = format_profile_message(user)
        await query.edit_message_text(message, reply_markup=get_profile_menu())
    else:
        await query.edit_message_text("❌ Профиль не найден", reply_markup=get_main_menu())

@require_auth
async def menu_settings(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Меню настроек"""
    query = update.callback_query
    await query.answer()
    await query.edit_message_text("⚙️ Настройки", reply_markup=get_settings_menu())

@require_auth
async def settings_notifications(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Настройки уведомлений - главное меню"""
    query = update.callback_query
    await query.answer()
    
    # Получаем настройки уведомлений
    notification_prefs = firebase.get_by_id('notificationPrefs', 'default')
    
    if not notification_prefs:
        # Создаем дефолтные настройки (все включены по умолчанию)
        notification_prefs = {
            'id': 'default',
            'newTask': {'telegramPersonal': True, 'telegramGroup': False},
            'statusChange': {'telegramPersonal': True, 'telegramGroup': False},
            'taskComment': {'telegramPersonal': True, 'telegramGroup': False},
            'docCreated': {'telegramPersonal': True, 'telegramGroup': False},
            'docUpdated': {'telegramPersonal': True, 'telegramGroup': False},
            'docShared': {'telegramPersonal': True, 'telegramGroup': False},
            'meetingCreated': {'telegramPersonal': True, 'telegramGroup': False},
            'meetingReminder': {'telegramPersonal': True, 'telegramGroup': False},
            'meetingUpdated': {'telegramPersonal': True, 'telegramGroup': False},
            'dealCreated': {'telegramPersonal': True, 'telegramGroup': False},
            'dealStatusChanged': {'telegramPersonal': True, 'telegramGroup': False},
            'clientCreated': {'telegramPersonal': True, 'telegramGroup': False},
            'contractCreated': {'telegramPersonal': True, 'telegramGroup': False},
            'purchaseRequestCreated': {'telegramPersonal': True, 'telegramGroup': False},
            'purchaseRequestStatusChanged': {'telegramPersonal': True, 'telegramGroup': False},
            'financePlanUpdated': {'telegramPersonal': True, 'telegramGroup': False},
            # Групповые уведомления (включены по умолчанию)
            'groupDailySummary': {'telegramGroup': True},
            'groupSuccessfulDeals': {'telegramGroup': True},
        }
        firebase.save('notificationPrefs', notification_prefs)
    
    message = "🔔 Настройки уведомлений\n\nВыберите категорию для настройки:"
    
    keyboard = [
        [InlineKeyboardButton("📋 Задачи", callback_data="settings_notif_tasks")],
        [InlineKeyboardButton("📄 Документы", callback_data="settings_notif_docs")],
        [InlineKeyboardButton("📅 Встречи", callback_data="settings_notif_meetings")],
        [InlineKeyboardButton("🎯 CRM (Сделки, Клиенты)", callback_data="settings_notif_crm")],
        [InlineKeyboardButton("💰 Финансы", callback_data="settings_notif_finance")],
        [InlineKeyboardButton("👥 Групповой чат", callback_data="settings_notif_group")],
        [InlineKeyboardButton("🔙 Назад", callback_data="menu_settings")]
    ]
    
    await query.edit_message_text(
        message,
        reply_markup=InlineKeyboardMarkup(keyboard)
    )

@require_auth
async def settings_notif_tasks(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Настройки уведомлений для задач"""
    query = update.callback_query
    await query.answer()
    
    notification_prefs = firebase.get_by_id('notificationPrefs', 'default')
    if not notification_prefs:
        notification_prefs = {'id': 'default'}
    
    # Получаем настройки задач (создаем дефолтные если нет)
    new_task = notification_prefs.get('newTask', {'telegramPersonal': True, 'telegramGroup': False})
    status_change = notification_prefs.get('statusChange', {'telegramPersonal': True, 'telegramGroup': False})
    task_comment = notification_prefs.get('taskComment', {'telegramPersonal': True, 'telegramGroup': False})
    
    message = "📋 Уведомления о задачах\n\n"
    message += f"📱 Новая задача: {'✅' if new_task.get('telegramPersonal') else '❌'}\n"
    message += f"📱 Изменение статуса: {'✅' if status_change.get('telegramPersonal') else '❌'}\n"
    message += f"📱 Комментарий к задаче: {'✅' if task_comment.get('telegramPersonal') else '❌'}\n"
    message += "\nНажмите на уведомление, чтобы переключить его."
    
    keyboard = [
        [InlineKeyboardButton(
            f"{'✅' if new_task.get('telegramPersonal') else '❌'} Новая задача",
            callback_data="settings_toggle_newTask"
        )],
        [InlineKeyboardButton(
            f"{'✅' if status_change.get('telegramPersonal') else '❌'} Изменение статуса",
            callback_data="settings_toggle_statusChange"
        )],
        [InlineKeyboardButton(
            f"{'✅' if task_comment.get('telegramPersonal') else '❌'} Комментарий",
            callback_data="settings_toggle_taskComment"
        )],
        [InlineKeyboardButton("🔙 Назад", callback_data="settings_notifications")]
    ]
    
    await query.edit_message_text(
        message,
        reply_markup=InlineKeyboardMarkup(keyboard)
    )

@require_auth
async def settings_notif_crm(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Настройки уведомлений для CRM"""
    query = update.callback_query
    await query.answer()
    
    notification_prefs = firebase.get_by_id('notificationPrefs', 'default')
    if not notification_prefs:
        notification_prefs = {'id': 'default'}
    
    deal_created = notification_prefs.get('dealCreated', {'telegramPersonal': True, 'telegramGroup': False})
    deal_status = notification_prefs.get('dealStatusChanged', {'telegramPersonal': True, 'telegramGroup': False})
    client_created = notification_prefs.get('clientCreated', {'telegramPersonal': True, 'telegramGroup': False})
    contract_created = notification_prefs.get('contractCreated', {'telegramPersonal': True, 'telegramGroup': False})
    
    message = "🎯 Уведомления CRM\n\n"
    message += f"📱 Новая сделка: {'✅' if deal_created.get('telegramPersonal') else '❌'}\n"
    message += f"📱 Изменение статуса сделки: {'✅' if deal_status.get('telegramPersonal') else '❌'}\n"
    message += f"📱 Новый клиент: {'✅' if client_created.get('telegramPersonal') else '❌'}\n"
    message += f"📱 Новый договор: {'✅' if contract_created.get('telegramPersonal') else '❌'}\n"
    message += "\nНажмите на уведомление, чтобы переключить его."
    
    keyboard = [
        [InlineKeyboardButton(
            f"{'✅' if deal_created.get('telegramPersonal') else '❌'} Новая сделка",
            callback_data="settings_toggle_dealCreated"
        )],
        [InlineKeyboardButton(
            f"{'✅' if deal_status.get('telegramPersonal') else '❌'} Изменение статуса сделки",
            callback_data="settings_toggle_dealStatusChanged"
        )],
        [InlineKeyboardButton(
            f"{'✅' if client_created.get('telegramPersonal') else '❌'} Новый клиент",
            callback_data="settings_toggle_clientCreated"
        )],
        [InlineKeyboardButton(
            f"{'✅' if contract_created.get('telegramPersonal') else '❌'} Новый договор",
            callback_data="settings_toggle_contractCreated"
        )],
        [InlineKeyboardButton("🔙 Назад", callback_data="settings_notifications")]
    ]
    
    await query.edit_message_text(
        message,
        reply_markup=InlineKeyboardMarkup(keyboard)
    )

@require_auth
async def settings_notif_docs(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Настройки уведомлений для документов"""
    query = update.callback_query
    await query.answer()
    
    notification_prefs = firebase.get_by_id('notificationPrefs', 'default')
    if not notification_prefs:
        notification_prefs = {'id': 'default'}
    
    doc_created = notification_prefs.get('docCreated', {'telegramPersonal': True, 'telegramGroup': False})
    doc_updated = notification_prefs.get('docUpdated', {'telegramPersonal': True, 'telegramGroup': False})
    doc_shared = notification_prefs.get('docShared', {'telegramPersonal': True, 'telegramGroup': False})
    
    message = "📄 Уведомления о документах\n\n"
    message += f"📱 Создан документ: {'✅' if doc_created.get('telegramPersonal') else '❌'}\n"
    message += f"📱 Обновлен документ: {'✅' if doc_updated.get('telegramPersonal') else '❌'}\n"
    message += f"📱 Документ расшарен: {'✅' if doc_shared.get('telegramPersonal') else '❌'}\n"
    message += "\nНажмите на уведомление, чтобы переключить его."
    
    keyboard = [
        [InlineKeyboardButton(
            f"{'✅' if doc_created.get('telegramPersonal') else '❌'} Создан документ",
            callback_data="settings_toggle_docCreated"
        )],
        [InlineKeyboardButton(
            f"{'✅' if doc_updated.get('telegramPersonal') else '❌'} Обновлен документ",
            callback_data="settings_toggle_docUpdated"
        )],
        [InlineKeyboardButton(
            f"{'✅' if doc_shared.get('telegramPersonal') else '❌'} Документ расшарен",
            callback_data="settings_toggle_docShared"
        )],
        [InlineKeyboardButton("🔙 Назад", callback_data="settings_notifications")]
    ]
    
    await query.edit_message_text(
        message,
        reply_markup=InlineKeyboardMarkup(keyboard)
    )

@require_auth
async def settings_notif_meetings(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Настройки уведомлений для встреч"""
    query = update.callback_query
    await query.answer()
    
    notification_prefs = firebase.get_by_id('notificationPrefs', 'default')
    if not notification_prefs:
        notification_prefs = {'id': 'default'}
    
    meeting_created = notification_prefs.get('meetingCreated', {'telegramPersonal': True, 'telegramGroup': False})
    meeting_reminder = notification_prefs.get('meetingReminder', {'telegramPersonal': True, 'telegramGroup': False})
    meeting_updated = notification_prefs.get('meetingUpdated', {'telegramPersonal': True, 'telegramGroup': False})
    
    message = "📅 Уведомления о встречах\n\n"
    message += f"📱 Создана встреча: {'✅' if meeting_created.get('telegramPersonal') else '❌'}\n"
    message += f"📱 Напоминание о встрече: {'✅' if meeting_reminder.get('telegramPersonal') else '❌'}\n"
    message += f"📱 Обновлена встреча: {'✅' if meeting_updated.get('telegramPersonal') else '❌'}\n"
    message += "\nНажмите на уведомление, чтобы переключить его."
    
    keyboard = [
        [InlineKeyboardButton(
            f"{'✅' if meeting_created.get('telegramPersonal') else '❌'} Создана встреча",
            callback_data="settings_toggle_meetingCreated"
        )],
        [InlineKeyboardButton(
            f"{'✅' if meeting_reminder.get('telegramPersonal') else '❌'} Напоминание",
            callback_data="settings_toggle_meetingReminder"
        )],
        [InlineKeyboardButton(
            f"{'✅' if meeting_updated.get('telegramPersonal') else '❌'} Обновлена встреча",
            callback_data="settings_toggle_meetingUpdated"
        )],
        [InlineKeyboardButton("🔙 Назад", callback_data="settings_notifications")]
    ]
    
    await query.edit_message_text(
        message,
        reply_markup=InlineKeyboardMarkup(keyboard)
    )

@require_auth
async def settings_notif_finance(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Настройки уведомлений для финансов"""
    query = update.callback_query
    await query.answer()
    
    notification_prefs = firebase.get_by_id('notificationPrefs', 'default')
    if not notification_prefs:
        notification_prefs = {'id': 'default'}
    
    purchase_request = notification_prefs.get('purchaseRequestCreated', {'telegramPersonal': True, 'telegramGroup': False})
    purchase_status = notification_prefs.get('purchaseRequestStatusChanged', {'telegramPersonal': True, 'telegramGroup': False})
    finance_plan = notification_prefs.get('financePlanUpdated', {'telegramPersonal': True, 'telegramGroup': False})
    
    message = "💰 Уведомления о финансах\n\n"
    message += f"📱 Новая заявка на покупку: {'✅' if purchase_request.get('telegramPersonal') else '❌'}\n"
    message += f"📱 Изменение статуса заявки: {'✅' if purchase_status.get('telegramPersonal') else '❌'}\n"
    message += f"📱 Обновлен финансовый план: {'✅' if finance_plan.get('telegramPersonal') else '❌'}\n"
    message += "\nНажмите на уведомление, чтобы переключить его."
    
    keyboard = [
        [InlineKeyboardButton(
            f"{'✅' if purchase_request.get('telegramPersonal') else '❌'} Новая заявка",
            callback_data="settings_toggle_purchaseRequestCreated"
        )],
        [InlineKeyboardButton(
            f"{'✅' if purchase_status.get('telegramPersonal') else '❌'} Изменение статуса",
            callback_data="settings_toggle_purchaseRequestStatusChanged"
        )],
        [InlineKeyboardButton(
            f"{'✅' if finance_plan.get('telegramPersonal') else '❌'} Обновлен план",
            callback_data="settings_toggle_financePlanUpdated"
        )],
        [InlineKeyboardButton("🔙 Назад", callback_data="settings_notifications")]
    ]
    
    await query.edit_message_text(
        message,
        reply_markup=InlineKeyboardMarkup(keyboard)
    )

@require_auth
async def settings_notif_group(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Настройки группового чата (только для администраторов)"""
    query = update.callback_query
    await query.answer()
    
    # Проверяем, является ли пользователь администратором
    telegram_user_id = update.effective_user.id
    if telegram_user_id not in user_sessions:
        await query.answer("❌ Вы не авторизованы")
        return
    
    user_id = user_sessions[telegram_user_id]['user_id']
    user = firebase.get_by_id('users', user_id)
    
    if not user or user.get('role') != 'ADMIN':
        await query.answer("❌ Доступно только администраторам")
        await query.edit_message_text(
            "❌ Настройки группового чата доступны только администраторам.",
            reply_markup=get_back_button("settings_notifications")
        )
        return
    
    notification_prefs = firebase.get_by_id('notificationPrefs', 'default')
    if not notification_prefs:
        notification_prefs = {'id': 'default'}
    
    telegram_group_chat_id = notification_prefs.get('telegramGroupChatId', '')
    
    # Получаем настройки групповых уведомлений
    group_daily_summary = notification_prefs.get('groupDailySummary', {'telegramGroup': True})
    group_successful_deals = notification_prefs.get('groupSuccessfulDeals', {'telegramGroup': True})
    
    message = "👥 Настройки группового чата\n\n"
    message += f"💬 ID группового чата: {telegram_group_chat_id if telegram_group_chat_id else 'Не настроен'}\n\n"
    message += "Групповые уведомления:\n"
    message += f"📋 Ежедневная сводка (9:00): {'✅' if group_daily_summary.get('telegramGroup') else '❌'}\n"
    message += f"🎉 Успешные сделки: {'✅' if group_successful_deals.get('telegramGroup') else '❌'}\n\n"
    message += "Для получения ID группового чата:\n"
    message += "1. Добавьте бота в группу\n"
    message += "2. Отправьте любое сообщение в группу\n"
    message += "3. Используйте команду /group_id в группе\n"
    message += "4. Скопируйте ID и введите его здесь"
    
    keyboard = [
        [InlineKeyboardButton(
            f"{'✅' if group_daily_summary.get('telegramGroup') else '❌'} Ежедневная сводка",
            callback_data="settings_toggle_groupDailySummary"
        )],
        [InlineKeyboardButton(
            f"{'✅' if group_successful_deals.get('telegramGroup') else '❌'} Успешные сделки",
            callback_data="settings_toggle_groupSuccessfulDeals"
        )],
        [InlineKeyboardButton("📝 Ввести ID группового чата", callback_data="settings_group_set_chat_id")],
        [InlineKeyboardButton("🔙 Назад", callback_data="settings_notifications")]
    ]
    
    await query.edit_message_text(
        message,
        reply_markup=InlineKeyboardMarkup(keyboard)
    )

@require_auth
async def settings_group_set_chat_id_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Начало ввода ID группового чата"""
    query = update.callback_query
    await query.answer()
    
    await query.edit_message_text(
        "📝 Введите ID группового чата:\n\n"
        "ID можно получить, отправив команду /group_id в группе, где находится бот.",
        reply_markup=get_back_button("settings_notif_group")
    )
    
    return SETTING_GROUP_CHAT_ID

@require_auth
async def settings_group_set_chat_id_input(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обработка ввода ID группового чата"""
    try:
        chat_id = update.message.text.strip()
        
        # Валидация ID (должен быть числом или строкой, начинающейся с -)
        if not chat_id:
            await update.message.reply_text("❌ ID не может быть пустым. Попробуйте еще раз:")
            return SETTING_GROUP_CHAT_ID
        
        # Сохраняем ID
        notification_prefs = firebase.get_by_id('notificationPrefs', 'default')
        if not notification_prefs:
            notification_prefs = {'id': 'default'}
        
        notification_prefs['telegramGroupChatId'] = chat_id
        firebase.save('notificationPrefs', notification_prefs)
        
        await update.message.reply_text(
            f"✅ ID группового чата сохранен: {chat_id}",
            reply_markup=get_settings_menu()
        )
        
        return ConversationHandler.END
        
    except Exception as e:
        logger.error(f"Error setting group chat ID: {e}", exc_info=True)
        await update.message.reply_text("❌ Произошла ошибка. Попробуйте еще раз.")
        return ConversationHandler.END

@require_auth
async def settings_toggle_notification(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Переключение настройки уведомления"""
    try:
        query = update.callback_query
        await query.answer()
        
        # Получаем название настройки из callback_data
        setting_name = query.data.replace("settings_toggle_", "")
        
        if not setting_name:
            await query.answer("❌ Ошибка: название настройки не указано")
            return
        
        notification_prefs = firebase.get_by_id('notificationPrefs', 'default')
        if not notification_prefs:
            notification_prefs = {'id': 'default'}
        
        # Получаем текущую настройку
        current_setting = notification_prefs.get(setting_name, {'telegramPersonal': True, 'telegramGroup': False})
        
        # Если настройка еще не существует, создаем ее
        if not isinstance(current_setting, dict):
            current_setting = {'telegramPersonal': True, 'telegramGroup': False}
        
        # Переключаем уведомления в зависимости от типа
        if setting_name in ['groupDailySummary', 'groupSuccessfulDeals']:
            # Для групповых уведомлений переключаем telegramGroup
            current_setting['telegramGroup'] = not current_setting.get('telegramGroup', True)
        else:
            # Для личных уведомлений переключаем telegramPersonal
            current_setting['telegramPersonal'] = not current_setting.get('telegramPersonal', True)
        
        # Обновляем настройки
        notification_prefs[setting_name] = current_setting
        notification_prefs['id'] = 'default'
        firebase.save('notificationPrefs', notification_prefs)
        
        # Определяем, в какую категорию вернуться
        category = "settings_notifications"
        # Точное сравнение для всех настроек
        if setting_name in ['newTask', 'statusChange', 'taskComment']:
            category = "settings_notif_tasks"
        elif setting_name in ['docCreated', 'docUpdated', 'docShared']:
            category = "settings_notif_docs"
        elif setting_name in ['meetingCreated', 'meetingReminder', 'meetingUpdated']:
            category = "settings_notif_meetings"
        elif setting_name in ['dealCreated', 'dealStatusChanged', 'clientCreated', 'contractCreated']:
            category = "settings_notif_crm"
        elif setting_name in ['purchaseRequestCreated', 'purchaseRequestStatusChanged', 'financePlanUpdated']:
            category = "settings_notif_finance"
        elif setting_name in ['groupDailySummary', 'groupSuccessfulDeals']:
            category = "settings_notif_group"
        
        # Возвращаемся в соответствующую категорию
        try:
            if category == "settings_notif_tasks":
                await settings_notif_tasks(update, context)
            elif category == "settings_notif_docs":
                await settings_notif_docs(update, context)
            elif category == "settings_notif_meetings":
                await settings_notif_meetings(update, context)
            elif category == "settings_notif_crm":
                await settings_notif_crm(update, context)
            elif category == "settings_notif_finance":
                await settings_notif_finance(update, context)
            elif category == "settings_notif_group":
                await settings_notif_group(update, context)
            else:
                await settings_notifications(update, context)
        except Exception as category_error:
            logger.error(f"Error returning to category {category}: {category_error}", exc_info=True)
            # Если не удалось вернуться в категорию, возвращаемся в главное меню настроек
            try:
                await settings_notifications(update, context)
            except:
                await query.answer("✅ Настройка изменена")
    except Exception as e:
        logger.error(f"Error in settings_toggle_notification: {e}", exc_info=True)
        try:
            await query.answer("❌ Произошла ошибка. Попробуйте еще раз.")
        except:
            pass

@require_auth
async def menu_help(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Меню помощи"""
    query = update.callback_query
    await query.answer()
    
    help_text = (
        "📖 Справка по боту\n\n"
        "Основные команды:\n"
        "/start - Начать работу с ботом\n"
        "/logout - Выйти из системы\n"
        "/help - Показать эту справку\n\n"
        "Используйте кнопки меню для навигации по функциям бота."
    )
    await query.edit_message_text(help_text, reply_markup=get_main_menu())

async def handle_text_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обработчик текстовых сообщений для создания задач и сделок"""
    # КРИТИЧЕСКИ ВАЖНО: Проверяем команды в самом начале
    if update.message and update.message.text and update.message.text.startswith('/'):
        return  # Игнорируем команды - они обрабатываются CommandHandler'ами
    
    telegram_user_id = update.effective_user.id
    
    # Проверяем авторизацию
    if telegram_user_id not in user_sessions:
        return  # Игнорируем сообщения от неавторизованных пользователей
    
    if telegram_user_id not in user_states:
        return  # Игнорируем сообщения, если пользователь не в процессе создания
    
    state = user_states[telegram_user_id].get('state')
    data = user_states[telegram_user_id].get('data', {})
    text = update.message.text.strip()
    
    try:
        if state == 'creating_task':
            # Создаем задачу
            user_id = user_sessions[telegram_user_id]['user_id']
            task_data = {
                'title': text,
                'assigneeId': user_id,
                'status': 'New',
                'priority': 'Medium',
                'createdByUserId': user_id,
                'entityType': 'task'
            }
            
            task_id = create_task(task_data)
            if task_id:
                await update.message.reply_text(
                    f"✅ Задача '{text}' создана!",
                    reply_markup=get_tasks_menu()
                )
            else:
                await update.message.reply_text("❌ Ошибка при создании задачи")
            
            del user_states[telegram_user_id]
            
        elif state == 'creating_deal_title':
            # Сохраняем название и запрашиваем описание
            data['title'] = text
            user_states[telegram_user_id]['state'] = 'creating_deal_description'
            await update.message.reply_text(
                "Введите описание заявки (или отправьте '-' чтобы пропустить):",
                reply_markup=get_back_button("menu_deals")
            )
            
        elif state == 'creating_deal_description':
            # Создаем сделку
            if text != '-':
                data['description'] = text
            
            deal_id = create_deal(data)
            if deal_id:
                await update.message.reply_text(
                    f"✅ Заявка '{data.get('title', '')}' создана!",
                    reply_markup=get_deals_menu()
                )
            else:
                await update.message.reply_text("❌ Ошибка при создании заявки")
            
            del user_states[telegram_user_id]
            
    except Exception as e:
        logger.error(f"Error handling text message: {e}", exc_info=True)
        await update.message.reply_text("❌ Произошла ошибка. Попробуйте еще раз.")
        if telegram_user_id in user_states:
            del user_states[telegram_user_id]

async def handle_bot_mention(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Обработчик упоминания бота в группе - начало создания задачи из сообщения"""
    try:
        # Игнорируем команды - они обрабатываются через CommandHandler
        if update.message and update.message.text and update.message.text.startswith('/'):
            return ConversationHandler.END
        
        # Проверяем, что это сообщение в группе
        if not update.message or update.message.chat.type not in ['group', 'supergroup']:
            return ConversationHandler.END
        
        # Проверяем, что бот упомянут
        message = update.message
        if not message.entities:
            return ConversationHandler.END
        
        # Получаем информацию о боте
        bot_info = await context.bot.get_me()
        bot_username = bot_info.username.lower()
        
        # Проверяем, есть ли упоминание бота
        mentioned = False
        for entity in message.entities:
            if entity.type == 'mention':
                mention_text = message.text[entity.offset:entity.offset + entity.length].lower()
                if mention_text == f'@{bot_username}':
                    mentioned = True
                    break
        
        if not mentioned:
            return ConversationHandler.END
        
        # Проверяем авторизацию пользователя
        telegram_user_id = update.effective_user.id
        if telegram_user_id not in user_sessions:
            await message.reply_text(
                "❌ Вы не авторизованы. Используйте /start в личном чате с ботом для авторизации."
            )
            return ConversationHandler.END
        
        # Сохраняем исходное сообщение в context.user_data
        original_text = message.text or message.caption or ""
        # Удаляем упоминание бота из текста
        for entity in reversed(message.entities):
            if entity.type == 'mention':
                mention_text = message.text[entity.offset:entity.offset + entity.length].lower()
                if mention_text == f'@{bot_username}':
                    original_text = (original_text[:entity.offset] + original_text[entity.offset + entity.length:]).strip()
        
        context.user_data['original_message'] = original_text
        context.user_data['original_message_id'] = message.message_id
        context.user_data['chat_id'] = message.chat.id
        
        # Запрашиваем название задачи
        await message.reply_text(
            f"📋 Создание задачи из сообщения:\n\n"
            f"💬 Исходное сообщение: {original_text[:200]}{'...' if len(original_text) > 200 else ''}\n\n"
            f"Введите название задачи:"
        )
        
        return TASK_FROM_MESSAGE_TITLE
        
    except Exception as e:
        logger.error(f"Error handling bot mention: {e}", exc_info=True)
        return ConversationHandler.END

async def task_from_message_title(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Обработка названия задачи из сообщения"""
    try:
        title = update.message.text.strip()
        if not title:
            await update.message.reply_text("❌ Название не может быть пустым. Введите название задачи:")
            return TASK_FROM_MESSAGE_TITLE
        
        context.user_data['task_title'] = title
        
        # Запрашиваем срок выполнения
        await update.message.reply_text(
            f"📅 Название задачи: {title}\n\n"
            f"Введите срок выполнения в формате ДД.ММ.ГГГГ (например, 25.01.2026)\n"
            f"Или отправьте '-' для использования сегодняшней даты:"
        )
        
        return TASK_FROM_MESSAGE_DATE
        
    except Exception as e:
        logger.error(f"Error in task_from_message_title: {e}", exc_info=True)
        await update.message.reply_text("❌ Произошла ошибка. Попробуйте еще раз.")
        return ConversationHandler.END

async def task_from_message_date(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Обработка срока выполнения задачи"""
    try:
        date_input = update.message.text.strip()
        
        from datetime import datetime
        from utils import get_today_date
        
        if date_input == '-':
            end_date = get_today_date()
        else:
            try:
                # Парсим дату в формате ДД.ММ.ГГГГ
                date_obj = datetime.strptime(date_input, '%d.%m.%Y')
                end_date = date_obj.date().isoformat()
            except ValueError:
                await update.message.reply_text(
                    "❌ Неверный формат даты. Используйте формат ДД.ММ.ГГГГ (например, 25.01.2026):"
                )
                return TASK_FROM_MESSAGE_DATE
        
        context.user_data['task_end_date'] = end_date
        
        # Получаем список пользователей для выбора исполнителя
        users = firebase.get_all('users')
        active_users = [u for u in users if not u.get('isArchived')]
        
        if not active_users:
            await update.message.reply_text("❌ Нет доступных пользователей для назначения.")
            return ConversationHandler.END
        
        # Создаем клавиатуру для выбора исполнителя
        keyboard = []
        for user in active_users[:10]:  # Ограничиваем до 10 пользователей
            keyboard.append([
                InlineKeyboardButton(
                    user.get('name', user.get('id', 'Неизвестно')),
                    callback_data=f"task_from_msg_assignee_{user.get('id')}"
                )
            ])
        keyboard.append([InlineKeyboardButton("🔙 Отмена", callback_data="task_from_msg_cancel")])
        
        await update.message.reply_text(
            f"📅 Срок выполнения: {date_input if date_input != '-' else 'Сегодня'}\n\n"
            f"Выберите исполнителя:",
            reply_markup=InlineKeyboardMarkup(keyboard)
        )
        
        return TASK_FROM_MESSAGE_ASSIGNEE
        
    except Exception as e:
        logger.error(f"Error in task_from_message_date: {e}", exc_info=True)
        await update.message.reply_text("❌ Произошла ошибка. Попробуйте еще раз.")
        return ConversationHandler.END

async def task_from_message_assignee_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> int:
    """Обработка выбора исполнителя через callback"""
    try:
        query = update.callback_query
        await query.answer()
        
        if query.data == "task_from_msg_cancel":
            await query.edit_message_text("❌ Создание задачи отменено.")
            return ConversationHandler.END
        
        if query.data.startswith("task_from_msg_assignee_"):
            assignee_id = query.data.replace("task_from_msg_assignee_", "")
            
            # Получаем данные из context.user_data
            original_message = context.user_data.get('original_message', '')
            task_title = context.user_data.get('task_title', '')
            task_end_date = context.user_data.get('task_end_date', '')
            telegram_user_id = query.from_user.id
            
            if telegram_user_id not in user_sessions:
                await query.edit_message_text("❌ Вы не авторизованы.")
                return ConversationHandler.END
            
            user_id = user_sessions[telegram_user_id]['user_id']
            
            # Создаем задачу
            from utils import get_today_date
            task_data = {
                'title': task_title,
                'description': original_message,
                'assigneeId': assignee_id,
                'status': 'New',
                'priority': 'Medium',
                'createdByUserId': user_id,
                'entityType': 'task',
                'startDate': get_today_date(),
                'endDate': task_end_date
            }
            
            task_id = create_task(task_data)
            
            if task_id:
                # Получаем имя исполнителя
                users = firebase.get_all('users')
                assignee = next((u for u in users if u.get('id') == assignee_id), None)
                assignee_name = assignee.get('name', 'Неизвестно') if assignee else 'Неизвестно'
                
                await query.edit_message_text(
                    f"✅ Задача создана!\n\n"
                    f"📋 Название: {task_title}\n"
                    f"👤 Исполнитель: {assignee_name}\n"
                    f"📅 Срок: {task_end_date}\n"
                    f"💬 Описание: {original_message[:100]}{'...' if len(original_message) > 100 else ''}"
                )
            else:
                await query.edit_message_text("❌ Ошибка при создании задачи.")
            
            # Очищаем данные
            context.user_data.pop('original_message', None)
            context.user_data.pop('original_message_id', None)
            context.user_data.pop('chat_id', None)
            context.user_data.pop('task_title', None)
            context.user_data.pop('task_end_date', None)
            
            return ConversationHandler.END
        
        return ConversationHandler.END
        
    except Exception as e:
        logger.error(f"Error in task_from_message_assignee_callback: {e}", exc_info=True)
        try:
            await query.edit_message_text("❌ Произошла ошибка. Попробуйте еще раз.")
        except:
            pass
        return ConversationHandler.END

@require_auth
async def show_task_in_group(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Команда /task <id или название> - показать задачу в группе"""
    try:
        # Проверяем, что это команда в группе
        if not update.message or update.message.chat.type not in ['group', 'supergroup']:
            return
        
        # Получаем аргумент команды (ID или название)
        if not context.args or len(context.args) == 0:
            await update.message.reply_text("❌ Использование: /task <id или название>\nПример: /task task-123456\nПример: /task Подготовить презентацию")
            return
        
        search_query = ' '.join(context.args).strip()
        
        # Сначала пытаемся найти по ID
        task = get_task_by_id(search_query)
        
        # Если не найдено по ID, ищем по названию
        if not task:
            all_tasks = firebase.get_all('tasks')
            matching_tasks = []
            search_lower = search_query.lower()
            
            for t in all_tasks:
                if t.get('isArchived'):
                    continue
                title = t.get('title', '').lower()
                if search_lower in title or title in search_lower:
                    matching_tasks.append(t)
            
            if len(matching_tasks) == 0:
                await update.message.reply_text(f"❌ Задача с ID или названием '{search_query}' не найдена.")
                return
            elif len(matching_tasks) == 1:
                task = matching_tasks[0]
            else:
                # Показываем список найденных задач
                message = f"🔍 Найдено несколько задач ({len(matching_tasks)}):\n\n"
                for i, t in enumerate(matching_tasks[:10], 1):
                    message += f"{i}. {t.get('title', 'Без названия')} (ID: {t.get('id', 'N/A')[:12]})\n"
                if len(matching_tasks) > 10:
                    message += f"\n... и еще {len(matching_tasks) - 10} задач"
                message += "\n\nИспользуйте ID для точного поиска."
                await update.message.reply_text(message)
                return
        
        # Получаем данные для форматирования
        users = firebase.get_all('users')
        projects = firebase.get_all('projects')
        
        # Форматируем сообщение
        message = format_task_message(task, users, projects)
        
        await update.message.reply_text(message, parse_mode='HTML')
        
    except Exception as e:
        logger.error(f"Error in show_task_in_group: {e}", exc_info=True)
        try:
            await update.message.reply_text("❌ Произошла ошибка при получении задачи.")
        except:
            pass

@require_auth
async def show_deal_in_group(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Команда /deal <id или название> - показать сделку в группе"""
    try:
        # Проверяем, что это команда в группе
        if not update.message or update.message.chat.type not in ['group', 'supergroup']:
            return
        
        # Получаем аргумент команды (ID или название)
        if not context.args or len(context.args) == 0:
            await update.message.reply_text("❌ Использование: /deal <id или название>\nПример: /deal deal-123456\nПример: /deal Новая заявка")
            return
        
        search_query = ' '.join(context.args).strip()
        
        # Сначала пытаемся найти по ID
        deal = get_deal_by_id(search_query)
        
        # Если не найдено по ID, ищем по названию
        if not deal:
            all_deals = get_all_deals(include_archived=False)
            matching_deals = []
            search_lower = search_query.lower()
            
            for d in all_deals:
                title = d.get('title', d.get('contactName', '')).lower()
                if search_lower in title or title in search_lower:
                    matching_deals.append(d)
            
            if len(matching_deals) == 0:
                await update.message.reply_text(f"❌ Сделка с ID или названием '{search_query}' не найдена.")
                return
            elif len(matching_deals) == 1:
                deal = matching_deals[0]
            else:
                # Показываем список найденных сделок
                message = f"🔍 Найдено несколько сделок ({len(matching_deals)}):\n\n"
                for i, d in enumerate(matching_deals[:10], 1):
                    title = d.get('title', d.get('contactName', 'Без названия'))
                    message += f"{i}. {title} (ID: {d.get('id', 'N/A')[:12]})\n"
                if len(matching_deals) > 10:
                    message += f"\n... и еще {len(matching_deals) - 10} сделок"
                message += "\n\nИспользуйте ID для точного поиска."
                await update.message.reply_text(message)
                return
        
        # Получаем данные для форматирования
        clients = firebase.get_all('clients')
        users = firebase.get_all('users')
        funnels = get_sales_funnels()
        
        # Форматируем сообщение
        message = format_deal_message(deal, clients, users, funnels)
        
        await update.message.reply_text(message, parse_mode='HTML')
        
    except Exception as e:
        logger.error(f"Error in show_deal_in_group: {e}", exc_info=True)
        try:
            await update.message.reply_text("❌ Произошла ошибка при получении сделки.")
        except:
            pass

@require_auth
async def show_meeting_in_group(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Команда /meeting <id или название> - показать встречу в группе"""
    try:
        # Проверяем, что это команда в группе
        if not update.message or update.message.chat.type not in ['group', 'supergroup']:
            return
        
        # Получаем аргумент команды (ID или название)
        if not context.args or len(context.args) == 0:
            await update.message.reply_text("❌ Использование: /meeting <id или название>\nПример: /meeting meeting-123456\nПример: /meeting Планерка")
            return
        
        search_query = ' '.join(context.args).strip()
        
        # Сначала пытаемся найти по ID
        meeting = firebase.get_by_id('meetings', search_query)
        
        # Если не найдено по ID, ищем по названию
        if not meeting:
            all_meetings = firebase.get_all('meetings')
            matching_meetings = []
            search_lower = search_query.lower()
            
            for m in all_meetings:
                if m.get('isArchived'):
                    continue
                title = m.get('title', '').lower()
                if search_lower in title or title in search_lower:
                    matching_meetings.append(m)
            
            if len(matching_meetings) == 0:
                await update.message.reply_text(f"❌ Встреча с ID или названием '{search_query}' не найдена.")
                return
            elif len(matching_meetings) == 1:
                meeting = matching_meetings[0]
            else:
                # Показываем список найденных встреч
                message = f"🔍 Найдено несколько встреч ({len(matching_meetings)}):\n\n"
                for i, m in enumerate(matching_meetings[:10], 1):
                    message += f"{i}. {m.get('title', 'Без названия')} (ID: {m.get('id', 'N/A')[:12]})\n"
                if len(matching_meetings) > 10:
                    message += f"\n... и еще {len(matching_meetings) - 10} встреч"
                message += "\n\nИспользуйте ID для точного поиска."
                await update.message.reply_text(message)
                return
        
        # Получаем данные для форматирования
        users = firebase.get_all('users')
        
        # Форматируем сообщение
        message = format_meeting_message(meeting, users)
        
        await update.message.reply_text(message, parse_mode='HTML')
        
    except Exception as e:
        logger.error(f"Error in show_meeting_in_group: {e}", exc_info=True)
        try:
            await update.message.reply_text("❌ Произошла ошибка при получении встречи.")
        except:
            pass

@require_auth
async def show_document_in_group(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Команда /document <id или название> - показать документ в группе"""
    try:
        # Проверяем, что это команда в группе
        if not update.message or update.message.chat.type not in ['group', 'supergroup']:
            return
        
        # Получаем аргумент команды (ID или название)
        if not context.args or len(context.args) == 0:
            await update.message.reply_text("❌ Использование: /document <id или название>\nПример: /document doc-123456\nПример: /document Договор")
            return
        
        search_query = ' '.join(context.args).strip()
        
        # Сначала пытаемся найти по ID
        document = firebase.get_by_id('docs', search_query)
        
        # Если не найдено по ID, ищем по названию
        if not document:
            all_docs = firebase.get_all('docs')
            matching_docs = []
            search_lower = search_query.lower()
            
            for d in all_docs:
                if d.get('isArchived'):
                    continue
                title = d.get('title', '').lower()
                if search_lower in title or title in search_lower:
                    matching_docs.append(d)
            
            if len(matching_docs) == 0:
                await update.message.reply_text(f"❌ Документ с ID или названием '{search_query}' не найден.")
                return
            elif len(matching_docs) == 1:
                document = matching_docs[0]
            else:
                # Показываем список найденных документов
                message = f"🔍 Найдено несколько документов ({len(matching_docs)}):\n\n"
                for i, d in enumerate(matching_docs[:10], 1):
                    message += f"{i}. {d.get('title', 'Без названия')} (ID: {d.get('id', 'N/A')[:12]})\n"
                if len(matching_docs) > 10:
                    message += f"\n... и еще {len(matching_docs) - 10} документов"
                message += "\n\nИспользуйте ID для точного поиска."
                await update.message.reply_text(message)
                return
        
        # Получаем данные для форматирования
        users = firebase.get_all('users')
        
        # Форматируем сообщение
        message = format_document_message(document, users)
        
        await update.message.reply_text(message, parse_mode='HTML')
        
    except Exception as e:
        logger.error(f"Error in show_document_in_group: {e}", exc_info=True)
        try:
            await update.message.reply_text("❌ Произошла ошибка при получении документа.")
        except:
            pass

async def periodic_check(context: ContextTypes.DEFAULT_TYPE):
    """Периодическая проверка новых задач, заявок и обработка очереди уведомлений"""
    try:
        now = datetime.now()
        
        # Обрабатываем очередь уведомлений из Firebase (от веб-приложения)
        try:
            pending_notifications = get_pending_notifications(limit=20)
            logger.info(f"[PERIODIC] ===== PROCESSING NOTIFICATION QUEUE =====")
            logger.info(f"[PERIODIC] Found {len(pending_notifications)} pending notifications from queue")
            
            if pending_notifications:
                logger.info(f"[PERIODIC] First notification sample: {pending_notifications[0]}")
            
            for notification_task in pending_notifications:
                task_id = notification_task.get('id')
                chat_id = notification_task.get('chatId')
                message = notification_task.get('message')
                notification_type = notification_task.get('type', 'unknown')
                user_id = notification_task.get('userId', 'unknown')
                
                logger.info(f"[PERIODIC] Processing notification {task_id}: type={notification_type}, userId={user_id}, chatId={chat_id}")
                
                if not chat_id or not message:
                    logger.warning(f"[PERIODIC] ❌ Invalid notification task {task_id}: missing chatId ({chat_id}) or message ({bool(message)})")
                    mark_notification_sent(task_id, success=False, error="Missing chatId or message")
                    continue
                
                try:
                    await context.bot.send_message(
                        chat_id=chat_id,
                        text=message,
                        parse_mode='HTML'
                    )
                    mark_notification_sent(task_id, success=True)
                    logger.info(f"[PERIODIC] ✅ Successfully sent notification {task_id} to chat {chat_id}")
                except Exception as e:
                    error_msg = str(e)
                    mark_notification_sent(task_id, success=False, error=error_msg)
                    logger.error(f"[PERIODIC] ❌ Error sending notification {task_id} to {chat_id}: {e}", exc_info=True)
                    logger.error(f"[PERIODIC] Error details: {error_msg}")
            
            # Очищаем старые уведомления (раз в час, проверяем случайно)
            import random
            if random.random() < 0.1:  # 10% вероятность
                cleanup_old_notifications(days=7)
        except Exception as e:
            logger.error(f"[PERIODIC] Error processing notification queue: {e}", exc_info=True)
        
        # Проверяем активность пользователей
        for telegram_user_id, session in list(user_sessions.items()):
            user_id = session['user_id']
            if not check_user_active(user_id):
                del user_sessions[telegram_user_id]
                if telegram_user_id in user_states:
                    del user_states[telegram_user_id]
                try:
                    await context.bot.send_message(
                        chat_id=telegram_user_id,
                        text="❌ Ваш аккаунт был деактивирован. Используйте /start для повторной авторизации."
                    )
                except:
                    pass
                continue
            
            # Проверяем новые задачи
            last_check = session.get('last_check', now)
            
            # Получаем настройки уведомлений
            notification_prefs = firebase.get_by_id('notificationPrefs', 'default')
            # ВСЕ УВЕДОМЛЕНИЯ БАЗОВО АКТИВНЫ - если настройка не существует, считаем что она включена
            if notification_prefs:
                new_task_setting = notification_prefs.get('newTask', {'telegramPersonal': True, 'telegramGroup': False})
                # Если настройка существует но не является словарем, создаем дефолтную
                if not isinstance(new_task_setting, dict):
                    new_task_setting = {'telegramPersonal': True, 'telegramGroup': False}
            else:
                # Если настроек вообще нет, все уведомления включены по умолчанию
                new_task_setting = {'telegramPersonal': True, 'telegramGroup': False}
            
            # Проверяем, включены ли уведомления о новых задачах (по умолчанию True)
            if new_task_setting.get('telegramPersonal', True):
                new_tasks = check_new_tasks(user_id, last_check)
                logger.info(f"[PERIODIC] Found {len(new_tasks)} new tasks for user {user_id}")
                
                for task in new_tasks:
                    # Проверяем, назначена ли задача на пользователя или создана пользователем
                    assignee_id = task.get('assigneeId')
                    assignee_ids = task.get('assigneeIds', [])
                    created_by = task.get('createdByUserId')
                    
                    is_assigned = (assignee_id and str(assignee_id) == str(user_id)) or \
                                 (isinstance(assignee_ids, list) and user_id in [str(uid) for uid in assignee_ids if uid])
                    is_created_by = created_by and str(created_by) == str(user_id)
                    
                    # Отправляем уведомление если задача назначена на пользователя
                    if is_assigned:
                        users = firebase.get_all('users')
                        projects = firebase.get_all('projects')
                        assignee_user = next((u for u in users if u.get('id') == assignee_id), None)
                        assignee_name = assignee_user.get('name', 'Неизвестно') if assignee_user else 'Не назначено'
                        
                        # Форматируем сообщение о новой задаче
                        message = f"🆕 <b>Новая задача</b>\n\n"
                        message += f"📝 <b>Задача:</b> {task.get('title', 'Без названия')}\n"
                        message += f"👤 <b>Ответственный:</b> {assignee_name}\n"
                        if task.get('endDate'):
                            # Форматируем дату
                            try:
                                from datetime import datetime
                                end_date = task.get('endDate')
                                if 'T' in end_date:
                                    end_date = end_date.split('T')[0]
                                elif ' ' in end_date:
                                    end_date = end_date.split(' ')[0]
                                date_obj = datetime.strptime(end_date, '%Y-%m-%d')
                                message += f"📅 <b>Срок:</b> {date_obj.strftime('%d.%m.%Y')}\n"
                            except:
                                message += f"📅 <b>Срок:</b> {task.get('endDate')}\n"
                        if task.get('priority'):
                            message += f"⚡ <b>Приоритет:</b> {task.get('priority')}\n"
                        
                        keyboard = get_task_menu(task.get('id'))
                        try:
                            await context.bot.send_message(
                                chat_id=telegram_user_id,
                                text=message,
                                reply_markup=keyboard,
                                parse_mode='HTML'
                            )
                            logger.info(f"[PERIODIC] Sent new task notification to {telegram_user_id} for task {task.get('id')}")
                        except Exception as e:
                            logger.error(f"Error sending task notification: {e}", exc_info=True)
                    
                    # Также отправляем уведомление создателю, если он не является исполнителем
                    elif is_created_by and assignee_id and str(assignee_id) != str(user_id):
                        users = firebase.get_all('users')
                        assignee_user = next((u for u in users if u.get('id') == assignee_id), None)
                        assignee_name = assignee_user.get('name', 'Неизвестно') if assignee_user else 'Не назначено'
                        
                        message = f"🆕 <b>Вы создали задачу</b>\n\n"
                        message += f"📝 <b>Задача:</b> {task.get('title', 'Без названия')}\n"
                        message += f"👤 <b>Ответственный:</b> {assignee_name}\n"
                        if task.get('endDate'):
                            try:
                                from datetime import datetime
                                end_date = task.get('endDate')
                                if 'T' in end_date:
                                    end_date = end_date.split('T')[0]
                                elif ' ' in end_date:
                                    end_date = end_date.split(' ')[0]
                                date_obj = datetime.strptime(end_date, '%Y-%m-%d')
                                message += f"📅 <b>Срок:</b> {date_obj.strftime('%d.%m.%Y')}\n"
                            except:
                                message += f"📅 <b>Срок:</b> {task.get('endDate')}\n"
                        
                        keyboard = get_task_menu(task.get('id'))
                        try:
                            await context.bot.send_message(
                                chat_id=telegram_user_id,
                                text=message,
                                reply_markup=keyboard,
                                parse_mode='HTML'
                            )
                            logger.info(f"[PERIODIC] Sent task created notification to {telegram_user_id} for task {task.get('id')}")
                        except Exception as e:
                            logger.error(f"Error sending task created notification: {e}", exc_info=True)
            else:
                logger.debug(f"[PERIODIC] New task notifications disabled for user {user_id}")
            
            # Обновляем время последней проверки
            session['last_check'] = now
        
        # Проверяем успешные сделки для групповых уведомлений
        notification_prefs = firebase.get_by_id('notificationPrefs', 'default')
        if notification_prefs:
            # Проверяем, включены ли уведомления об успешных сделках
            group_successful_deals = notification_prefs.get('groupSuccessfulDeals', {'telegramGroup': True})
            if group_successful_deals.get('telegramGroup', True):
                won_deals = get_won_deals_today()
                if won_deals:
                    telegram_chat_id = notification_prefs.get('telegramGroupChatId')
                    
                    if telegram_chat_id:
                        clients = firebase.get_all('clients')
                        users = firebase.get_all('users')
                        for deal in won_deals:
                            message = get_successful_deal_message(deal, clients, users)
                            if message:
                                try:
                                    await context.bot.send_message(
                                        chat_id=telegram_chat_id,
                                        text=message,
                                        parse_mode='HTML'
                                    )
                                    logger.info(f"Successfully sent deal notification to group {telegram_chat_id}")
                                except Exception as e:
                                    logger.error(f"Error sending successful deal message: {e}")
                    else:
                        logger.warning("No telegramGroupChatId configured for deal notifications")
            else:
                logger.debug("Group successful deals notifications are disabled")
    
    except Exception as e:
        logger.error(f"[PERIODIC] Error in periodic_check: {e}", exc_info=True)

def main():
    """Главная функция запуска бота"""
    try:
        # Версия кода для проверки обновлений
        CODE_VERSION = "2026-01-24-refactored"
        
        logger.info("=" * 60)
        logger.info(f"[BOT] ===== STARTING BOT =====")
        logger.info(f"[BOT] Code version: {CODE_VERSION}")
        logger.info(f"[BOT] This version includes detailed update logging")
        print(f"[BOT] ===== STARTING BOT ===== Code version: {CODE_VERSION} =====")
        # ВАЖНО: Не логируем токен из соображений безопасности
        logger.info("[BOT] Initializing bot with token (hidden for security)...")
        
        # Создаем приложение
        application = Application.builder().token(config.TELEGRAM_BOT_TOKEN).build()
        logger.info("[BOT] Application created successfully")
    except Exception as e:
        logger.error(f"[BOT] FATAL ERROR in main() initialization: {e}", exc_info=True)
        raise
    
    # Обработчик ошибок
    async def error_handler(update: object, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Обработчик ошибок с улучшенным логированием"""
        error = context.error
        logger.error(f"[ERROR] Exception while handling an update: {error}", exc_info=error)
        
        # Логируем дополнительную информацию
        if isinstance(update, Update):
            logger.error(f"[ERROR] Update details: update_id={update.update_id}")
            if update.effective_user:
                logger.error(f"[ERROR] User: {update.effective_user.id} (@{update.effective_user.username})")
            if update.effective_message:
                logger.error(f"[ERROR] Message: {update.effective_message.text[:100] if update.effective_message.text else 'N/A'}")
            if update.callback_query:
                logger.error(f"[ERROR] Callback query: {update.callback_query.data}")
        
        # Пытаемся отправить сообщение пользователю
        if isinstance(update, Update) and update.effective_message:
            try:
                await update.effective_message.reply_text(
                    "❌ Произошла ошибка при обработке вашего запроса. Попробуйте еще раз или используйте /start для перезапуска."
                )
            except Exception as e:
                logger.error(f"[ERROR] Could not send error message to user: {e}")
    
    # Обработчик всех обновлений для логирования (добавляем ПЕРВЫМ, чтобы видеть все обновления)
    async def log_update(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Логируем все обновления для отладки"""
        try:
            logger.info(f"[UPDATE] ===== RECEIVED UPDATE (ID: {update.update_id}) =====")
            print(f"[UPDATE] ===== RECEIVED UPDATE (ID: {update.update_id}) =====", flush=True)
            
            if update.message:
                chat_type = "PRIVATE" if update.message.chat.type == "private" else f"GROUP ({update.message.chat.type})"
                user_id = update.effective_user.id if update.effective_user else "N/A"
                username = update.effective_user.username if update.effective_user and update.effective_user.username else "N/A"
                text = update.message.text or "N/A"
                logger.info(f"[UPDATE] Message from user {user_id} (@{username}) in {chat_type}: {text}")
                print(f"[UPDATE] Message from user {user_id} (@{username}) in {chat_type}: {text}", flush=True)
                if text and text.startswith('/'):
                    logger.info(f"[UPDATE] ⚠️ COMMAND DETECTED: {text}")
                    print(f"[UPDATE] ⚠️ COMMAND DETECTED: {text}", flush=True)
            elif update.callback_query:
                user_id = update.effective_user.id if update.effective_user else "N/A"
                logger.info(f"[UPDATE] Callback query from {user_id}: {update.callback_query.data}")
                print(f"[UPDATE] Callback query from {user_id}: {update.callback_query.data}", flush=True)
            elif update.edited_message:
                user_id = update.effective_user.id if update.effective_user else "N/A"
                logger.info(f"[UPDATE] Edited message from {user_id}")
                print(f"[UPDATE] Edited message from {user_id}", flush=True)
            else:
                logger.info(f"[UPDATE] Other update type: {type(update)}")
                print(f"[UPDATE] Other update type: {type(update)}", flush=True)
            logger.info(f"[UPDATE] ===== END UPDATE =====")
            print(f"[UPDATE] ===== END UPDATE =====", flush=True)
        except Exception as e:
            logger.error(f"[UPDATE] Error logging update: {e}", exc_info=True)
            print(f"[UPDATE] ERROR: {e}", flush=True)
    
    # Добавляем обработчик для логирования всех обновлений ПЕРВЫМ (группа -1)
    # Это гарантирует, что мы увидим все обновления ДО их обработки другими обработчиками
    # MessageHandler с filters.ALL ловит все сообщения
    application.add_handler(MessageHandler(filters.ALL, log_update), group=-1)
    
    # Также добавляем обработчик для callback_query
    application.add_handler(CallbackQueryHandler(log_update), group=-1)
    logger.info("[BOT] Logging handlers registered in group -1 (will see ALL updates)")
    
    # Обработчик текстовых сообщений для создания задач и сделок
    # Регистрируем ПОСЛЕ ConversationHandler'ов, чтобы они имели приоритет
    # application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_text_message))
    
    # ConversationHandler для создания задачи из сообщения в группе
    # Фильтр для групповых чатов - проверка выполняется внутри handle_bot_mention
    task_from_message_handler = ConversationHandler(
        entry_points=[MessageHandler(filters.TEXT, handle_bot_mention)],
        states={
            TASK_FROM_MESSAGE_TITLE: [MessageHandler(filters.TEXT & ~filters.COMMAND, task_from_message_title)],
            TASK_FROM_MESSAGE_DATE: [MessageHandler(filters.TEXT & ~filters.COMMAND, task_from_message_date)],
            TASK_FROM_MESSAGE_ASSIGNEE: [CallbackQueryHandler(task_from_message_assignee_callback)],
        },
        fallbacks=[CommandHandler('cancel', lambda u, c: ConversationHandler.END)],
        name="task_from_message",
        persistent=False,
        per_message=True,  # Включаем отслеживание callback query для каждого сообщения
    )
    
    # ConversationHandler для авторизации
    # Работает в приватных чатах (по умолчанию команды работают только в приватных чатах)
    auth_handler = ConversationHandler(
        entry_points=[CommandHandler('start', start)],
        states={
            LOGIN: [MessageHandler(filters.TEXT & ~filters.COMMAND, login)],
            PASSWORD: [MessageHandler(filters.TEXT & ~filters.COMMAND, password)],
        },
        fallbacks=[CommandHandler('start', start)],
    )
    
    # Регистрируем обработчики
    # ВАЖНО: Сначала регистрируем CommandHandler'ы, чтобы команды обрабатывались первыми
    # ConversationHandler должен быть зарегистрирован после, чтобы не перехватывать команды
    application.add_handler(auth_handler)  # ConversationHandler для /start
    application.add_handler(CommandHandler('logout', logout))
    application.add_handler(CommandHandler('help', help_command))
    application.add_handler(CommandHandler('group_id', group_id_command))
    
    # Команды для работы в группах (показывают сущности)
    application.add_handler(CommandHandler('task', show_task_in_group))
    application.add_handler(CommandHandler('deal', show_deal_in_group))
    application.add_handler(CommandHandler('meeting', show_meeting_in_group))
    application.add_handler(CommandHandler('document', show_document_in_group))
    
    # ConversationHandler для создания задачи из сообщения (регистрируем последним)
    application.add_handler(task_from_message_handler)
    
    logger.info("[BOT] Registering callback query handlers...")
    
    # Обработчики callback_query (регистрируем ПОСЛЕ CommandHandler'ов и ConversationHandler'ов, НО ДО MessageHandler'ов)
    # Это критически важно для правильной обработки callback_query
    application.add_handler(CallbackQueryHandler(menu_main, pattern='^menu_main$'))
    application.add_handler(CallbackQueryHandler(menu_tasks, pattern='^menu_tasks$'))
    application.add_handler(CallbackQueryHandler(tasks_all, pattern='^tasks_all$'))
    application.add_handler(CallbackQueryHandler(tasks_filter, pattern='^tasks_filter_'))
    application.add_handler(CallbackQueryHandler(tasks_page, pattern='^tasks_page_'))
    application.add_handler(CallbackQueryHandler(task_create, pattern='^task_create$'))
    application.add_handler(CallbackQueryHandler(task_detail, pattern='^task_[^_]+$'))
    application.add_handler(CallbackQueryHandler(task_set_status, pattern='^task_set_status_'))
    application.add_handler(CallbackQueryHandler(menu_deals, pattern='^menu_deals$'))
    application.add_handler(CallbackQueryHandler(deals_all, pattern='^deals_all$'))
    application.add_handler(CallbackQueryHandler(deals_all_show, pattern='^deals_all_show$'))
    application.add_handler(CallbackQueryHandler(deals_funnel, pattern='^deals_funnel_[^_]+$'))
    application.add_handler(CallbackQueryHandler(deals_funnel_stage, pattern='^deals_funnel_stage_'))
    application.add_handler(CallbackQueryHandler(deals_new, pattern='^deals_new$'))
    application.add_handler(CallbackQueryHandler(deals_mine, pattern='^deals_mine$'))
    application.add_handler(CallbackQueryHandler(deal_create, pattern='^deal_create$'))
    application.add_handler(CallbackQueryHandler(deal_create_funnel, pattern='^deal_create_funnel_'))
    application.add_handler(CallbackQueryHandler(deal_create_stage, pattern='^deal_create_stage_'))
    application.add_handler(CallbackQueryHandler(deal_detail, pattern='^deal_[^_]+$'))
    application.add_handler(CallbackQueryHandler(deal_set_stage, pattern='^deal_set_stage_'))
    application.add_handler(CallbackQueryHandler(deal_delete, pattern='^deal_delete_'))
    application.add_handler(CallbackQueryHandler(menu_profile, pattern='^menu_profile$'))
    application.add_handler(CallbackQueryHandler(menu_settings, pattern='^menu_settings$'))
    application.add_handler(CallbackQueryHandler(settings_notifications, pattern='^settings_notifications$'))
    application.add_handler(CallbackQueryHandler(settings_notif_tasks, pattern='^settings_notif_tasks$'))
    application.add_handler(CallbackQueryHandler(settings_notif_docs, pattern='^settings_notif_docs$'))
    application.add_handler(CallbackQueryHandler(settings_notif_meetings, pattern='^settings_notif_meetings$'))
    application.add_handler(CallbackQueryHandler(settings_notif_crm, pattern='^settings_notif_crm$'))
    application.add_handler(CallbackQueryHandler(settings_notif_finance, pattern='^settings_notif_finance$'))
    application.add_handler(CallbackQueryHandler(settings_notif_group, pattern='^settings_notif_group$'))
    application.add_handler(CallbackQueryHandler(settings_toggle_notification, pattern='^settings_toggle_'))
    
    # ConversationHandler для ввода ID группового чата
    group_chat_id_handler = ConversationHandler(
        entry_points=[CallbackQueryHandler(settings_group_set_chat_id_start, pattern='^settings_group_set_chat_id$')],
        states={
            SETTING_GROUP_CHAT_ID: [MessageHandler(filters.TEXT & ~filters.COMMAND, settings_group_set_chat_id_input)],
        },
        fallbacks=[CommandHandler('cancel', lambda u, c: ConversationHandler.END)],
        name="group_chat_id",
        persistent=False,
    )
    application.add_handler(group_chat_id_handler)
    application.add_handler(CallbackQueryHandler(menu_help, pattern='^menu_help$'))
    
    logger.info("[BOT] Registering message handlers...")
    
    # Обработчик текстовых сообщений для создания задач и сделок (регистрируем ПОСЛЕ всех остальных)
    # Это позволяет ConversationHandler'ам и CallbackQueryHandler'ам обрабатывать сообщения первыми
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_text_message))
    
    # Регистрируем обработчик ошибок
    application.add_error_handler(error_handler)
    
    logger.info("[BOT] All handlers registered successfully")
    
    # Периодическая проверка (каждые 10 секунд для быстрой доставки уведомлений)
    job_queue = application.job_queue
    job_queue.run_repeating(periodic_check, interval=10, first=5)
    
    # Запускаем планировщик задач
    scheduler = TaskScheduler(application.bot)
    scheduler.start()
    
    # Запускаем бота
    logger.info("=" * 60)
    logger.info("Bot started")
    logger.info(f"[BOT] Code version: {CODE_VERSION} (with detailed logging)")
    # ВАЖНО: Не логируем токен из соображений безопасности
    logger.info("[BOT] Starting polling (token hidden for security)...")
    logger.info(f"[BOT] Polling mode: allowed_updates={Update.ALL_TYPES}, drop_pending_updates=False")
    logger.info(f"[BOT] All handlers registered, starting polling...")
    logger.info("=" * 60)
    
    # Добавляем кастомный обработчик для логирования ответов от getUpdates
    async def post_init(application: Application) -> None:
        """Вызывается после инициализации приложения"""
        logger.info("[BOT] Application initialized, polling will start")
    
    async def post_shutdown(application: Application) -> None:
        """Вызывается при остановке приложения"""
        logger.info("[BOT] Application shutting down")
    
    application.post_init = post_init
    application.post_shutdown = post_shutdown
    
    # Проверяем, нет ли других запущенных экземпляров бота (перед запуском polling)
    try:
        running_processes = subprocess.run(
            ['pgrep', '-f', 'python.*bot.py'],
            capture_output=True,
            text=True,
            timeout=2
        )
        if running_processes.returncode == 0:
            pids = [p for p in running_processes.stdout.strip().split('\n') if p]
            current_pid = str(os.getpid())
            other_pids = [pid for pid in pids if pid != current_pid]
            if other_pids:
                logger.warning(f"[BOT] ⚠️ WARNING: Other bot processes detected: {other_pids}")
                logger.warning(f"[BOT] This may cause 409 Conflict errors!")
                logger.warning(f"[BOT] Current PID: {current_pid}")
            else:
                logger.info(f"[BOT] ✅ No other bot processes detected (current PID: {current_pid})")
    except Exception as e:
        logger.warning(f"[BOT] Could not check for other processes: {e}")
    
    try:
        logger.info("[BOT] Starting polling...")
        logger.info("[BOT] If you send /start to the bot, you should see [UPDATE] messages in logs")
        logger.info(f"[BOT] Polling config: allowed_updates=ALL_TYPES, drop_pending=False, interval=1.0s, timeout=10s")
        
        application.run_polling(
            allowed_updates=Update.ALL_TYPES,
            drop_pending_updates=False,  # Обрабатываем все обновления
            poll_interval=1.0,  # Проверяем обновления каждую секунду
            timeout=10  # Таймаут для запросов
        )
    except KeyboardInterrupt:
        logger.info("Bot stopped by user")
    except Exception as e:
        logger.error(f"Fatal error in polling: {e}", exc_info=True)
        raise

if __name__ == '__main__':
    print(f"[BOT] ===== SCRIPT STARTED ===== Code version: {CODE_VERSION_AT_START} =====")
    logger.info(f"[BOT] ===== SCRIPT STARTED =====")
    logger.info(f"[BOT] Code version at start: {CODE_VERSION_AT_START}")
    try:
        main()
    except Exception as e:
        logger.error(f"[BOT] FATAL ERROR in main(): {e}", exc_info=True)
        raise

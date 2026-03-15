"""
Клавиатуры (меню и кнопки) для Telegram бота
"""
from telegram import InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo

def get_main_menu() -> InlineKeyboardMarkup:
    """Главное меню бота"""
    keyboard = [
        [InlineKeyboardButton("📋 Мои задачи", callback_data="menu_tasks")],
        [InlineKeyboardButton("🎯 Все сделки", callback_data="menu_deals")],
        [InlineKeyboardButton("⚙️ Настройки", callback_data="menu_settings")],
        [InlineKeyboardButton("👤 Профиль", callback_data="menu_profile")],
        [InlineKeyboardButton("🌐 Открыть веб-приложение", web_app=WebAppInfo(url="https://tipa.taska.uz/"))],
        [InlineKeyboardButton("❓ Помощь", callback_data="menu_help")]
    ]
    return InlineKeyboardMarkup(keyboard)

def get_tasks_menu() -> InlineKeyboardMarkup:
    """Меню задач"""
    keyboard = [
        [InlineKeyboardButton("📊 Все задачи", callback_data="tasks_all")],
        [InlineKeyboardButton("➕ Создать задачу", callback_data="task_create")],
        [InlineKeyboardButton("🔙 Назад", callback_data="menu_main")]
    ]
    return InlineKeyboardMarkup(keyboard)

def get_tasks_list_keyboard(tasks: list, filter_type: str = 'all', page: int = 0, page_size: int = 10) -> InlineKeyboardMarkup:
    """Клавиатура для списка задач с фильтрами и навигацией"""
    keyboard = []
    
    # Фильтры
    filter_row = []
    if filter_type == 'all':
        filter_row.append(InlineKeyboardButton("✅ Все", callback_data="tasks_filter_all_0"))
    else:
        filter_row.append(InlineKeyboardButton("Все", callback_data="tasks_filter_all_0"))
    
    if filter_type == 'today':
        filter_row.append(InlineKeyboardButton("✅ Сегодня", callback_data="tasks_filter_today_0"))
    else:
        filter_row.append(InlineKeyboardButton("Сегодня", callback_data="tasks_filter_today_0"))
    
    if filter_type == 'overdue':
        filter_row.append(InlineKeyboardButton("✅ Просроченные", callback_data="tasks_filter_overdue_0"))
    else:
        filter_row.append(InlineKeyboardButton("Просроченные", callback_data="tasks_filter_overdue_0"))
    
    keyboard.append(filter_row)
    
    # Список задач (пагинация)
    start_idx = page * page_size
    end_idx = start_idx + page_size
    page_tasks = tasks[start_idx:end_idx]
    
    for task in page_tasks:
        task_id = task.get('id', '')
        task_title = task.get('title', 'Без названия')[:40]
        # Добавляем иконку в зависимости от типа
        icon = "📋"
        if filter_type == 'overdue':
            icon = "⚠️"
        elif filter_type == 'today':
            icon = "📅"
        keyboard.append([
            InlineKeyboardButton(
                f"{icon} {task_title}",
                callback_data=f"task_{task_id}"
            )
        ])
    
    # Навигация
    nav_row = []
    if page > 0:
        nav_row.append(InlineKeyboardButton("◀️ Назад", callback_data=f"tasks_page_{filter_type}_{page-1}"))
    if end_idx < len(tasks):
        nav_row.append(InlineKeyboardButton("Вперед ▶️", callback_data=f"tasks_page_{filter_type}_{page+1}"))
    
    if nav_row:
        keyboard.append(nav_row)
    
    # Кнопки действий
    keyboard.append([InlineKeyboardButton("➕ Создать задачу", callback_data="task_create")])
    keyboard.append([InlineKeyboardButton("🔙 Назад", callback_data="menu_tasks")])
    
    return InlineKeyboardMarkup(keyboard)

def get_deals_menu() -> InlineKeyboardMarkup:
    """Меню сделок"""
    keyboard = [
        [InlineKeyboardButton("🎯 Все сделки", callback_data="deals_all")],
        [InlineKeyboardButton("🆕 Новые заявки", callback_data="deals_new")],
        [InlineKeyboardButton("👤 Мои заявки", callback_data="deals_mine")],
        [InlineKeyboardButton("➕ Создать заявку", callback_data="deal_create")],
        [InlineKeyboardButton("🔍 Поиск", callback_data="deal_search")],
        [InlineKeyboardButton("🔙 Назад", callback_data="menu_main")]
    ]
    return InlineKeyboardMarkup(keyboard)

def get_deal_menu(deal_id: str) -> InlineKeyboardMarkup:
    """Меню одной сделки"""
    keyboard = [
        [InlineKeyboardButton("✏️ Редактировать", callback_data=f"deal_edit_{deal_id}")],
        [InlineKeyboardButton("📊 Изменить стадию", callback_data=f"deal_stage_{deal_id}")],
        [InlineKeyboardButton("📋 Создать задачу", callback_data=f"deal_task_{deal_id}")],
        [InlineKeyboardButton("🗑️ В архив", callback_data=f"deal_delete_{deal_id}")],
        [InlineKeyboardButton("🔙 Назад", callback_data="menu_deals")]
    ]
    return InlineKeyboardMarkup(keyboard)

def get_task_menu(task_id: str) -> InlineKeyboardMarkup:
    """Меню одной задачи"""
    keyboard = [
        [InlineKeyboardButton("📊 Изменить статус", callback_data=f"task_status_{task_id}")],
        [InlineKeyboardButton("💬 Добавить комментарий", callback_data=f"task_comment_{task_id}")],
        [InlineKeyboardButton("🔙 Назад", callback_data="menu_tasks")]
    ]
    return InlineKeyboardMarkup(keyboard)

def get_settings_menu() -> InlineKeyboardMarkup:
    """Меню настроек"""
    keyboard = [
        [InlineKeyboardButton("🔔 Уведомления", callback_data="settings_notifications")],
        [InlineKeyboardButton("🔙 Назад", callback_data="menu_main")]
    ]
    return InlineKeyboardMarkup(keyboard)

def get_profile_menu() -> InlineKeyboardMarkup:
    """Меню профиля"""
    keyboard = [
        [InlineKeyboardButton("🔑 Изменить пароль", callback_data="profile_password")],
        [InlineKeyboardButton("🖼️ Изменить аватарку", callback_data="profile_avatar")],
        [InlineKeyboardButton("📞 Изменить контакты", callback_data="profile_contacts")],
        [InlineKeyboardButton("🔙 Назад", callback_data="menu_main")]
    ]
    return InlineKeyboardMarkup(keyboard)

def get_statuses_keyboard(statuses: list, task_id: str) -> InlineKeyboardMarkup:
    """Клавиатура для выбора статуса задачи"""
    keyboard = []
    for status in statuses:
        keyboard.append([
            InlineKeyboardButton(
                status.get('name', status.get('id', '')),
                callback_data=f"task_set_status_{task_id}_{status.get('id', status.get('name', ''))}"
            )
        ])
    keyboard.append([InlineKeyboardButton("🔙 Отмена", callback_data=f"task_{task_id}")])
    return InlineKeyboardMarkup(keyboard)

def get_stages_keyboard(stages: list, deal_id: str) -> InlineKeyboardMarkup:
    """Клавиатура для выбора стадии сделки"""
    keyboard = []
    for stage in stages:
        keyboard.append([
            InlineKeyboardButton(
                stage.get('name', stage.get('id', '')),
                callback_data=f"deal_set_stage_{deal_id}_{stage.get('id', stage.get('name', ''))}"
            )
        ])
    keyboard.append([InlineKeyboardButton("🔙 Отмена", callback_data=f"deal_{deal_id}")])
    return InlineKeyboardMarkup(keyboard)

def get_funnels_keyboard(funnels: list, callback_prefix: str) -> InlineKeyboardMarkup:
    """Клавиатура для выбора воронки продаж"""
    keyboard = []
    for funnel in funnels:
        keyboard.append([
            InlineKeyboardButton(
                funnel.get('name', funnel.get('id', '')),
                callback_data=f"{callback_prefix}_{funnel.get('id', '')}"
            )
        ])
    keyboard.append([InlineKeyboardButton("🔙 Отмена", callback_data="menu_deals")])
    return InlineKeyboardMarkup(keyboard)

def get_clients_keyboard(clients: list, callback_prefix: str) -> InlineKeyboardMarkup:
    """Клавиатура для выбора клиента"""
    keyboard = []
    for client in clients[:20]:  # Ограничиваем 20 клиентами
        keyboard.append([
            InlineKeyboardButton(
                client.get('name', client.get('companyName', client.get('id', ''))),
                callback_data=f"{callback_prefix}_{client.get('id', '')}"
            )
        ])
    keyboard.append([InlineKeyboardButton("➕ Создать нового", callback_data=f"{callback_prefix}_new")])
    keyboard.append([InlineKeyboardButton("🔙 Отмена", callback_data="menu_deals")])
    return InlineKeyboardMarkup(keyboard)

def get_users_keyboard(users: list, callback_prefix: str) -> InlineKeyboardMarkup:
    """Клавиатура для выбора пользователя"""
    keyboard = []
    for user in users:
        if user.get('isArchived'):
            continue
        keyboard.append([
            InlineKeyboardButton(
                user.get('name', user.get('id', '')),
                callback_data=f"{callback_prefix}_{user.get('id', '')}"
            )
        ])
    keyboard.append([InlineKeyboardButton("🔙 Отмена", callback_data="menu_main")])
    return InlineKeyboardMarkup(keyboard)

def get_confirm_keyboard(action: str, item_id: str, confirm_callback: str) -> InlineKeyboardMarkup:
    """Клавиатура подтверждения действия"""
    keyboard = [
        [InlineKeyboardButton("✅ Да", callback_data=confirm_callback)],
        [InlineKeyboardButton("❌ Нет", callback_data=f"{action}_{item_id}")]
    ]
    return InlineKeyboardMarkup(keyboard)

def get_back_button(callback_data: str) -> InlineKeyboardMarkup:
    """Кнопка "Назад" """
    keyboard = [[InlineKeyboardButton("🔙 Назад", callback_data=callback_data)]]
    return InlineKeyboardMarkup(keyboard)

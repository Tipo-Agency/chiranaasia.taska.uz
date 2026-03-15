/**
 * @deprecated Этот файл содержит устаревшие методы для работы с localStorage
 * 
 * ВАЖНО: Данные приложения теперь хранятся ТОЛЬКО в Firebase
 * localStorage используется ТОЛЬКО для настроек сессии:
 * - activeUserId
 * - telegramChatId
 * - telegramEmployeeToken
 * - telegramClientToken
 * - lastTelegramUpdateId
 * - enableTelegramImport
 * - darkMode (опционально)
 * 
 * Все методы get/set для данных приложения (tasks, deals, clients и т.д.)
 * помечены как @deprecated и будут удалены в будущем.
 * 
 * Используйте api.*.getAll() для загрузки данных из Firebase
 * Используйте api.*.create(), api.*.update(), api.*.delete() для сохранения в Firebase
 */

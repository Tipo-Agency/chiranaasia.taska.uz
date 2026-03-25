/**
 * Локальные настройки сессии и клиентские заглушки для Telegram (dev/legacy UI).
 * Данные приложения — через api.* и бэкенд, не через этот модуль.
 */

import { NotificationPreferences } from '../types';
import { DEFAULT_NOTIFICATION_PREFS } from '../constants';

const STORAGE_KEYS = {
  ACTIVE_USER_ID: 'cfo_active_user_session',
  TELEGRAM_CHAT_ID: 'cfo_telegram_chat_id',
  TELEGRAM_EMPLOYEE_TOKEN: 'cfo_telegram_employee_token',
  TELEGRAM_CLIENT_TOKEN: 'cfo_telegram_client_token',
  LAST_TELEGRAM_UPDATE_ID: 'cfo_last_telegram_update_id',
  ENABLE_TELEGRAM_IMPORT: 'cfo_enable_telegram_import',
  NOTIFICATION_PREFS: 'cfo_notification_prefs',
} as const;

const getLocal = <T>(key: string, seed: T): T => {
  const stored = localStorage.getItem(key);
  if (stored) {
    try {
      return JSON.parse(stored) as T;
    } catch {
      return seed;
    }
  }
  return seed;
};

const setLocal = (key: string, data: unknown) => {
  localStorage.setItem(key, JSON.stringify(data));
};

export const storageService = {
  getDbUrl: () => '',

  getActiveUserId: (): string | null => localStorage.getItem(STORAGE_KEYS.ACTIVE_USER_ID),
  setActiveUserId: (id: string) => localStorage.setItem(STORAGE_KEYS.ACTIVE_USER_ID, id),
  clearActiveUserId: () => localStorage.removeItem(STORAGE_KEYS.ACTIVE_USER_ID),

  getTelegramChatId: (): string => localStorage.getItem(STORAGE_KEYS.TELEGRAM_CHAT_ID) || '',
  setTelegramChatId: (id: string) => localStorage.setItem(STORAGE_KEYS.TELEGRAM_CHAT_ID, id),

  getEmployeeBotToken: (): string => localStorage.getItem(STORAGE_KEYS.TELEGRAM_EMPLOYEE_TOKEN) || '',
  setEmployeeBotToken: (t: string) => localStorage.setItem(STORAGE_KEYS.TELEGRAM_EMPLOYEE_TOKEN, t),

  getClientBotToken: (): string => localStorage.getItem(STORAGE_KEYS.TELEGRAM_CLIENT_TOKEN) || '',
  setClientBotToken: (t: string) => localStorage.setItem(STORAGE_KEYS.TELEGRAM_CLIENT_TOKEN, t),

  getLastTelegramUpdateId: (): number => {
    const raw = localStorage.getItem(STORAGE_KEYS.LAST_TELEGRAM_UPDATE_ID);
    if (raw == null || raw === '') return 0;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? n : 0;
  },
  setLastTelegramUpdateId: (id: number) =>
    localStorage.setItem(STORAGE_KEYS.LAST_TELEGRAM_UPDATE_ID, String(id)),

  getEnableTelegramImport: (): boolean => getLocal(STORAGE_KEYS.ENABLE_TELEGRAM_IMPORT, false),
  setEnableTelegramImport: (enabled: boolean) => setLocal(STORAGE_KEYS.ENABLE_TELEGRAM_IMPORT, enabled),

  getNotificationPrefs: (): NotificationPreferences =>
    getLocal(STORAGE_KEYS.NOTIFICATION_PREFS, DEFAULT_NOTIFICATION_PREFS),
  setNotificationPrefs: (prefs: NotificationPreferences) => setLocal(STORAGE_KEYS.NOTIFICATION_PREFS, prefs),

  /** Зарезервировано: данные с облака приходят через API. */
  loadFromCloud: async (_force = false) => false,

  /** Зарезервировано: сохранение через API. */
  saveToCloud: async () => {},
};

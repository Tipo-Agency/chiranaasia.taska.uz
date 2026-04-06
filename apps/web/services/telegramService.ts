
import { TelegramButtonConfig, Deal } from "../types";
import { storageService } from "./storageService";
import { devLog, devWarn } from "../utils/devLog";

// --- EMPLOYEE BOT (Notifications, Automation) ---

/**
 * Отправляет уведомление в Telegram
 * @param message - Текст сообщения
 * @param buttons - Кнопки (опционально)
 * @param targetChatId - ID чата для отправки (личный чат пользователя или группа)
 */
const sendTelegramMessage = async (message: string, targetChatId: string, buttons?: TelegramButtonConfig[]): Promise<boolean> => {
  const botToken = storageService.getEmployeeBotToken();

  devLog('[TELEGRAM] sendTelegramMessage', {
    hasToken: !!botToken,
    tokenLength: botToken?.length || 0,
    hasChatId: !!targetChatId,
    chatId: targetChatId,
  });

  if (!targetChatId || !botToken) {
    devWarn('[TELEGRAM] Не настроен bot token или chat ID', {
      hasToken: !!botToken,
      hasChatId: !!targetChatId,
    });
    return false;
  }

  const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;

  const body: Record<string, unknown> = {
    chat_id: targetChatId,
    text: message,
    parse_mode: 'HTML',
  };

  if (buttons && buttons.length > 0) {
    body.reply_markup = {
      inline_keyboard: [
        buttons.map((btn) => ({
          text: btn.text,
          callback_data: btn.callbackData || `${btn.action}:${btn.url || ''}`,
        })),
      ],
    };
  }

  try {
    const response = await fetch(telegramUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const result = await response.json();

    if (!result.ok) {
      devWarn('[TELEGRAM EMPLOYEE] Send failed:', result.description || result);
      return false;
    }

    devLog('[TELEGRAM EMPLOYEE] Notification sent to chat:', targetChatId);
    return true;
  } catch (error) {
    devWarn('[TELEGRAM EMPLOYEE] Send failed', error);
    return false;
  }
};

/**
 * Отправляет уведомление в Telegram с учетом настроек (личный чат, группа)
 */
export const sendTelegramNotification = async (
  message: string,
  buttons?: TelegramButtonConfig[],
  notificationSetting?: { telegramPersonal?: boolean; telegramGroup?: boolean },
  userTelegramChatId?: string,
  groupChatId?: string
) => {
  if (!notificationSetting) {
    const chatId = storageService.getTelegramChatId();
    return sendTelegramMessage(message, chatId, buttons);
  }

  devLog('[TELEGRAM] sendTelegramNotification', {
    hasSetting: !!notificationSetting,
    telegramPersonal: notificationSetting.telegramPersonal,
    telegramGroup: notificationSetting.telegramGroup,
    hasUserChatId: !!userTelegramChatId,
    hasGroupChatId: !!groupChatId,
  });

  let sent = false;

  if (notificationSetting.telegramPersonal !== false && userTelegramChatId) {
    devLog('[TELEGRAM] Personal notification →', userTelegramChatId);
    sent = (await sendTelegramMessage(message, userTelegramChatId, buttons)) || sent;
  } else {
    if (notificationSetting.telegramPersonal === false) {
      devLog('[TELEGRAM] Personal notifications disabled');
    }
    if (!userTelegramChatId) {
      devWarn('[TELEGRAM] No userTelegramChatId — user may need /start in bot');
    }
  }

  if (notificationSetting.telegramGroup) {
    const groupId = groupChatId || storageService.getTelegramChatId();
    if (groupId) {
      devLog('[TELEGRAM] Group notification →', groupId);
      sent = (await sendTelegramMessage(message, groupId, buttons)) || sent;
    } else {
      devWarn('[TELEGRAM] Group notifications on but no groupChatId');
    }
  }

  return sent;
};

export const getUserTelegramChatId = (user: { telegramUserId?: string } | null | undefined): string | undefined => {
  return user?.telegramUserId;
};

// --- CLIENT BOT (Leads, Chat) ---

export const sendClientMessage = async (chatId: string, text: string) => {
  // Deprecated: sending to clients should be done server-side (bot token must not be in browser).
  // Keep as stub for legacy UI paths.
  void chatId;
  void text;
  return false;
};

export const pollTelegramUpdates = async (): Promise<{
  newDeals: Deal[];
  newMessages: { dealId: string; text: string; username: string }[];
}> => {
  // Deprecated: Telegram intake moved to backend (server-side polling).
  // Frontend should not use Telegram bot tokens in browser.
  return { newDeals: [], newMessages: [] };
};

// --- Форматирование сообщений для Telegram ---

export const formatStatusChangeMessage = (taskTitle: string, oldStatus: string, newStatus: string, user: string): string => {
  return `🔔 <b>Обновление статуса</b>\n\n👤 <b>Сотрудник:</b> ${user}\n📝 <b>Задача:</b> ${taskTitle}\n🔄 <b>Статус:</b> ${oldStatus} ➡️ ${newStatus}`;
};

export const formatNewTaskMessage = (taskTitle: string, priority: string, endDate: string, assignee: string, project: string | null): string => {
  return `🆕 <b>Новая задача</b>\n\n👤 <b>Ответственный:</b> ${assignee}\n📝 <b>Задача:</b> ${taskTitle}\n📂 <b>Модуль:</b> ${project || 'Без модуля'}\n⚡ <b>Приоритет:</b> ${priority}\n📅 <b>Срок:</b> ${endDate}`;
};

export const formatDealMessage = (dealTitle: string, stage: string, amount: number, assignee: string): string => {
  return `💼 <b>Новая сделка</b>\n\n<b>Название:</b> ${dealTitle}\n<b>Стадия:</b> ${stage}\n<b>Сумма:</b> ${amount.toLocaleString()} UZS\n<b>Ответственный:</b> ${assignee}`;
};

export const formatDealStatusChangeMessage = (dealTitle: string, oldStage: string, newStage: string, user: string): string => {
  return `🔄 <b>Изменена стадия сделки</b>\n\n<b>Сделка:</b> ${dealTitle}\n<b>Было:</b> ${oldStage}\n<b>Стало:</b> ${newStage}\n<b>Изменил:</b> ${user}`;
};

export const formatClientMessage = (clientName: string, user: string): string => {
  return `👤 <b>Новый клиент</b>\n\n<b>Клиент:</b> ${clientName}\n<b>Добавил:</b> ${user}`;
};

export const formatContractMessage = (contractNumber: string, clientName: string, amount: number, user: string): string => {
  return `📄 <b>Новый договор</b>\n\n<b>Номер:</b> ${contractNumber}\n<b>Клиент:</b> ${clientName}\n<b>Сумма:</b> ${amount.toLocaleString()} UZS\n<b>Добавил:</b> ${user}`;
};

export const formatPurchaseRequestMessage = (requestTitle: string, amount: number, department: string, user: string): string => {
  return `💰 <b>Новая заявка на покупку</b>\n\n<b>Название:</b> ${requestTitle}\n<b>Сумма:</b> ${amount.toLocaleString()} UZS\n<b>Отдел:</b> ${department}\n<b>Создал:</b> ${user}`;
};

export const formatDocumentMessage = (docTitle: string, user: string): string => {
  return `📑 <b>Новый документ</b>\n\n<b>Название:</b> ${docTitle}\n<b>Добавил:</b> ${user}`;
};

export const formatMeetingMessage = (meetingTitle: string, date: string, time: string, user: string): string => {
  return `📅 <b>Новая встреча</b>\n\n<b>Название:</b> ${meetingTitle}\n<b>Дата:</b> ${new Date(date).toLocaleDateString('ru-RU')}\n<b>Время:</b> ${time}\n<b>Создал:</b> ${user}`;
};

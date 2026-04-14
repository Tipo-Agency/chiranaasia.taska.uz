/**
 * Клиентские уведомления: activity log (лента активности в UI).
 *
 * In-app центр и Telegram/Email доставляются бэкендом:
 * - доменные события → `notification_hub` → `notifications` + `notification_deliveries`
 * - см. код в `apps/api` (notification hub, модели доставок)
 *
 * Не дублируем очередь Telegram с фронта — иначе двойные сообщения и обход prefs.
 */

import { User, NotificationPreferences, Task, Deal, Client, Contract, Doc, Meeting } from '../types';
import {
  createTaskCreatedLog,
  createTaskStatusChangedLog,
  createDealCreatedLog,
  createDealStatusChangedLog,
  createClientCreatedLog,
  createContractCreatedLog,
  createDocCreatedLog,
  createMeetingCreatedLog,
  createPurchaseRequestCreatedLog,
} from '../utils/activityLogUtils';

export interface NotificationContext {
  currentUser: User;
  allUsers: User[];
  notificationPrefs?: NotificationPreferences;
}

interface BaseNotificationOptions {
  context: NotificationContext;
  /** Не писать в ленту активности */
  skipActivityLog?: boolean;
  /** Зарезервировано; внешние каналы — только через API/хаб */
  skipTelegram?: boolean;
}

export const notifyTaskCreated = async (
  task: Task,
  assigneeUser: User | null,
  options: BaseNotificationOptions
): Promise<void> => {
  const { context, skipActivityLog } = options;
  const { currentUser, allUsers } = context;
  try {
    if (!skipActivityLog) {
      await createTaskCreatedLog(task, currentUser, assigneeUser, allUsers);
    }
  } catch (error) {
    console.error('[NOTIFICATION] Error notifying task created:', error);
  }
};

export const notifyTaskStatusChanged = async (
  task: Task,
  oldStatus: string,
  newStatus: string,
  assigneeUser: User | null,
  options: BaseNotificationOptions
): Promise<void> => {
  const { context, skipActivityLog } = options;
  const { currentUser, allUsers } = context;
  try {
    if (!skipActivityLog) {
      await createTaskStatusChangedLog(task, oldStatus, newStatus, currentUser, assigneeUser, allUsers);
    }
  } catch (error) {
    console.error('[NOTIFICATION] Error notifying task status changed:', error);
  }
};

export const notifyDealCreated = async (
  deal: Deal,
  assigneeUser: User | null,
  options: BaseNotificationOptions
): Promise<void> => {
  const { context, skipActivityLog } = options;
  const { currentUser, allUsers } = context;
  try {
    if (!skipActivityLog) {
      await createDealCreatedLog(deal, currentUser, assigneeUser, allUsers);
    }
  } catch (error) {
    console.error('[NOTIFICATION] Error notifying deal created:', error);
  }
};

export const notifyDealStatusChanged = async (
  deal: Deal,
  oldStage: string,
  newStage: string,
  options: BaseNotificationOptions
): Promise<void> => {
  const { context, skipActivityLog } = options;
  const { currentUser, allUsers } = context;
  try {
    if (!skipActivityLog) {
      await createDealStatusChangedLog(deal, oldStage, newStage, currentUser, allUsers);
    }
  } catch (error) {
    console.error('[NOTIFICATION] Error notifying deal status changed:', error);
  }
};

export const notifyClientCreated = async (client: Client, options: BaseNotificationOptions): Promise<void> => {
  const { context, skipActivityLog } = options;
  const { currentUser, allUsers } = context;
  try {
    if (!skipActivityLog) {
      await createClientCreatedLog(client, currentUser, allUsers);
    }
  } catch (error) {
    console.error('[NOTIFICATION] Error notifying client created:', error);
  }
};

export const notifyContractCreated = async (
  contract: Contract,
  _clientName: string,
  options: BaseNotificationOptions
): Promise<void> => {
  const { context, skipActivityLog } = options;
  const { currentUser, allUsers } = context;
  try {
    if (!skipActivityLog) {
      await createContractCreatedLog(contract, currentUser, allUsers);
    }
  } catch (error) {
    console.error('[NOTIFICATION] Error notifying contract created:', error);
  }
};

export const notifyDocCreated = async (doc: Doc, options: BaseNotificationOptions): Promise<void> => {
  const { context, skipActivityLog } = options;
  const { currentUser, allUsers } = context;
  try {
    if (!skipActivityLog) {
      await createDocCreatedLog(doc, currentUser, allUsers);
    }
  } catch (error) {
    console.error('[NOTIFICATION] Error notifying doc created:', error);
  }
};

export const notifyMeetingCreated = async (
  meeting: Meeting,
  participantIds: string[],
  options: BaseNotificationOptions
): Promise<void> => {
  const { context, skipActivityLog } = options;
  const { currentUser, allUsers } = context;
  try {
    if (!skipActivityLog) {
      await createMeetingCreatedLog(meeting, currentUser, participantIds, allUsers);
    }
  } catch (error) {
    console.error('[NOTIFICATION] Error notifying meeting created:', error);
  }
};

export const notifyPurchaseRequestCreated = async (
  request: { id: string; title?: string; description?: string; amount?: string | number },
  departmentName: string,
  options: BaseNotificationOptions
): Promise<void> => {
  const { context, skipActivityLog } = options;
  const { currentUser, allUsers } = context;
  try {
    if (!skipActivityLog) {
      await createPurchaseRequestCreatedLog(request, currentUser, allUsers);
    }
  } catch (error) {
    console.error('[NOTIFICATION] Error notifying purchase request created:', error);
  }
};

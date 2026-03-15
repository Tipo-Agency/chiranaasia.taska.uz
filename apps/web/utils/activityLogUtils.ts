import { ActivityLog, User, Task, Deal, Client, Contract, Doc, Meeting, Role } from '../types';
import { api } from '../backend/api';

/**
 * Создает activity log для события
 * @param currentUser - Текущий пользователь, который выполнил действие
 * @param action - Действие (например, "создал задачу", "изменил статус")
 * @param details - Детали действия (например, название задачи, название сделки)
 * @param targetUserId - ID пользователя, для которого создается уведомление (если отличается от currentUser)
 * @param allUsers - Все пользователи (для получения информации о получателе)
 */
export const createActivityLog = async (
  currentUser: User,
  action: string,
  details: string,
  targetUserId?: string,
  allUsers?: User[]
): Promise<ActivityLog | null> => {
  if (!currentUser) return null;

  const log: ActivityLog = {
    id: `activity-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    userId: targetUserId || currentUser.id,
    userName: currentUser.name,
    userAvatar: currentUser.avatar || '',
    action,
    details,
    timestamp: new Date().toISOString(),
    read: false
  };

  try {
    await api.activity.add(log);
    return log;
  } catch (error) {
    console.error('Error creating activity log:', error);
    return null;
  }
};

/**
 * Создает activity logs для всех пользователей (для системных событий)
 * @param currentUser - Текущий пользователь, который выполнил действие
 * @param action - Действие
 * @param details - Детали действия
 * @param allUsers - Все пользователи
 * @param includeAdminOnly - Если true, создает уведомление только для администраторов
 */
export const createActivityLogsForAll = async (
  currentUser: User,
  action: string,
  details: string,
  allUsers: User[],
  includeAdminOnly: boolean = false
): Promise<void> => {
  if (!currentUser) return;

  const targetUsers = includeAdminOnly 
    ? allUsers.filter(u => u.role === Role.ADMIN && !u.isArchived)
    : allUsers.filter(u => !u.isArchived);

  const logs: ActivityLog[] = targetUsers.map(user => ({
    id: `activity-${Date.now()}-${Math.random().toString(36).substr(2, 9)}-${user.id}`,
    userId: user.id,
    userName: currentUser.name,
    userAvatar: currentUser.avatar || '',
    action,
    details,
    timestamp: new Date().toISOString(),
    read: false
  }));

  try {
    await Promise.all(logs.map(log => api.activity.add(log)));
  } catch (error) {
    console.error('Error creating activity logs for all users:', error);
  }
};

/**
 * Создает activity log при создании задачи
 */
export const createTaskCreatedLog = async (
  task: Task,
  currentUser: User,
  assigneeUser: User | null,
  allUsers: User[]
): Promise<void> => {
  // Уведомление для исполнителя (если он есть и не является создателем)
  if (assigneeUser && assigneeUser.id !== currentUser.id) {
    await createActivityLog(
      currentUser,
      'назначил вам задачу',
      task.title,
      assigneeUser.id,
      allUsers
    );
  }

  // Уведомление для всех администраторов
  await createActivityLogsForAll(
    currentUser,
    'создал задачу',
    task.title,
    allUsers,
    true // Только для администраторов
  );
};

/**
 * Создает activity log при изменении статуса задачи
 */
export const createTaskStatusChangedLog = async (
  task: Task,
  oldStatus: string,
  newStatus: string,
  currentUser: User,
  assigneeUser: User | null,
  allUsers: User[]
): Promise<void> => {
  const details = `${task.title}: ${oldStatus} → ${newStatus}`;

  // Уведомление для исполнителя (если он есть и не является текущим пользователем)
  if (assigneeUser && assigneeUser.id !== currentUser.id) {
    await createActivityLog(
      currentUser,
      'изменил статус вашей задачи',
      details,
      assigneeUser.id,
      allUsers
    );
  }

  // Уведомление для всех пользователей (чтобы все видели изменения)
  await createActivityLogsForAll(
    currentUser,
    'изменил статус задачи',
    details,
    allUsers,
    false // Для всех пользователей
  );
};

/**
 * Создает activity log при создании сделки
 */
export const createDealCreatedLog = async (
  deal: Deal,
  currentUser: User,
  assigneeUser: User | null,
  allUsers: User[]
): Promise<void> => {
  // Уведомление для ответственного (если он есть и не является создателем)
  if (assigneeUser && assigneeUser.id !== currentUser.id) {
    await createActivityLog(
      currentUser,
      'назначил вам сделку',
      deal.title,
      assigneeUser.id,
      allUsers
    );
  }

  // Уведомление для всех администраторов
  await createActivityLogsForAll(
    currentUser,
    'создал сделку',
    deal.title,
    allUsers,
    true // Только для администраторов
  );
};

/**
 * Создает activity log при изменении статуса сделки
 */
export const createDealStatusChangedLog = async (
  deal: Deal,
  oldStage: string,
  newStage: string,
  currentUser: User,
  allUsers: User[]
): Promise<void> => {
  const details = `${deal.title}: ${oldStage} → ${newStage}`;

  // Уведомление для всех пользователей
  await createActivityLogsForAll(
    currentUser,
    'изменил статус сделки',
    details,
    allUsers,
    false // Для всех пользователей
  );
};

/**
 * Создает activity log при создании клиента
 */
export const createClientCreatedLog = async (
  client: Client,
  currentUser: User,
  allUsers: User[]
): Promise<void> => {
  // Уведомление для всех администраторов
  await createActivityLogsForAll(
    currentUser,
    'создал клиента',
    client.name,
    allUsers,
    true // Только для администраторов
  );
};

/**
 * Создает activity log при создании договора
 */
export const createContractCreatedLog = async (
  contract: Contract,
  currentUser: User,
  allUsers: User[]
): Promise<void> => {
  // Уведомление для всех администраторов
  await createActivityLogsForAll(
    currentUser,
    'создал договор',
    contract.number || 'Без номера',
    allUsers,
    true // Только для администраторов
  );
};

/**
 * Создает activity log при создании документа
 */
export const createDocCreatedLog = async (
  doc: Doc,
  currentUser: User,
  allUsers: User[]
): Promise<void> => {
  // Уведомление для всех пользователей
  await createActivityLogsForAll(
    currentUser,
    'создал документ',
    doc.title,
    allUsers,
    false // Для всех пользователей
  );
};

/**
 * Создает activity log при создании встречи
 */
export const createMeetingCreatedLog = async (
  meeting: Meeting,
  currentUser: User,
  participantIds: string[],
  allUsers: User[]
): Promise<void> => {
  // Уведомления для участников (кроме создателя)
  const participants = allUsers.filter(u => 
    participantIds.includes(u.id) && u.id !== currentUser.id && !u.isArchived
  );

  for (const participant of participants) {
    await createActivityLog(
      currentUser,
      'пригласил вас на встречу',
      meeting.title,
      participant.id,
      allUsers
    );
  }

  // Уведомление для всех администраторов
  await createActivityLogsForAll(
    currentUser,
    'создал встречу',
    meeting.title,
    allUsers,
    true // Только для администраторов
  );
};

/**
 * Создает activity log при создании заявки на покупку
 */
export const createPurchaseRequestCreatedLog = async (
  request: PurchaseRequest,
  currentUser: User,
  allUsers: User[]
): Promise<void> => {
  // Уведомление для всех администраторов
  await createActivityLogsForAll(
    currentUser,
    'создал заявку на покупку',
    request.title || 'Без названия',
    allUsers,
    true // Только для администраторов
  );
};

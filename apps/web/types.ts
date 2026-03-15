
export enum Role {
  ADMIN = 'ADMIN',
  EMPLOYEE = 'EMPLOYEE',
}

export enum ViewMode {
  TABLE = 'table',
  KANBAN = 'kanban',
  GANTT = 'gantt',
}

export interface StatusOption {
    id: string;
    name: string;
    color: string; // Tailwind class
}

export interface PriorityOption {
    id: string;
    name: string;
    color: string; // Tailwind class
}

export interface User {
  id: string;
  name: string;
  role: Role;
  avatar?: string;
  login?: string; 
  email?: string;
  phone?: string;
  telegram?: string;
  telegramUserId?: string; // ID пользователя в Telegram (сохраняется ботом при авторизации)
  password?: string;
  mustChangePassword?: boolean;
  isArchived?: boolean; // Архив (мягкое удаление)
}

export interface Client {
  id: string;
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  telegram?: string;
  instagram?: string;
  companyName?: string; // Название компании
  companyInfo?: string; // Информация о том, чем занимается компания
  notes?: string;
  funnelId?: string; // ID воронки продаж
  isArchived?: boolean; // Архив (мягкое удаление)
}

// Объединенная сущность для договоров и продаж
export interface Deal {
  id: string;
  clientId: string;
  recurring: boolean; // true = договор с ежемесячными платежами, false = разовая услуга
  number: string; // Номер договора/сделки
  amount: number; // Сумма
  currency: string; // Валюта
  status: 'pending' | 'paid' | 'overdue' | 'active' | 'completed'; // Статус
  description: string; // Описание услуги/товара
  notes?: string; // Примечания
  funnelId?: string; // ID воронки продаж
  isArchived?: boolean; // Архив (мягкое удаление)
  createdAt?: string; // ISO дата создания
  updatedAt?: string; // ISO дата последнего обновления
  // Общие поля
  date?: string; // Дата сделки/договора
  dueDate?: string; // Срок оплаты
  paidAmount?: number; // Оплаченная сумма
  paidDate?: string; // Дата оплаты
  // Поля для договоров (recurring = true)
  startDate?: string; // Дата начала договора
  endDate?: string; // Дата окончания договора
  paymentDay?: number; // День месяца для оплаты
}

// Алиасы для обратной совместимости (deprecated)
export type Contract = Deal;
export type OneTimeDeal = Deal;

export interface AccountsReceivable {
  id: string;
  clientId: string;
  dealId: string; // ID сделки (договора или продажи)
  amount: number; // Сумма задолженности
  currency: string; // Валюта
  dueDate: string; // Срок погашения
  status: 'current' | 'overdue' | 'paid'; // Статус
  description: string; // Описание
  paidAmount?: number; // Оплаченная сумма
  paidDate?: string; // Дата оплаты
  createdAt: string; // Дата создания записи
  updatedAt?: string; // Дата обновления
  isArchived?: boolean; // Архив (мягкое удаление)
}

export interface Comment {
  id: string;
  text: string;
  authorId: string;
  createdAt: string;
  type?: 'internal' | 'telegram_in' | 'telegram_out'; // New field for chat context
}

export interface FunnelStage {
  id: string;
  label: string;
  color: string; // CSS color class (например, 'bg-gray-200 dark:bg-gray-700')
}

export interface InstagramSourceConfig {
  enabled: boolean;
  instagramAccountId?: string; // ID Instagram аккаунта из Meta
  accessToken?: string; // Access Token для Meta Graph API
  pageId?: string; // ID Facebook страницы, к которой привязан Instagram
  lastSyncAt?: string; // Время последней синхронизации
}

export interface TelegramSourceConfig {
  enabled: boolean;
  botToken?: string; // Токен Telegram бота для этой воронки
  webhookUrl?: string; // URL вебхука для получения сообщений
  lastSyncAt?: string; // Время последней синхронизации
}

export interface FunnelSourceConfig {
  instagram?: InstagramSourceConfig;
  telegram?: TelegramSourceConfig;
}

export interface SalesFunnel {
  id: string;
  name: string; // Название воронки (направление бизнеса)
  stages: FunnelStage[]; // Этапы воронки
  sources?: FunnelSourceConfig; // Настройки источников для воронки
  createdAt?: string;
  updatedAt?: string;
  isArchived?: boolean; // Архив
}

export interface Deal {
  id: string;
  title: string;
  clientId?: string; 
  contactName?: string; 
  amount: number;
  currency: string; 
  stage: string; // ID этапа из воронки (больше не фиксированный тип)
  funnelId?: string; // ID воронки, к которой относится сделка
  source?: 'instagram' | 'telegram' | 'site' | 'manual' | 'recommendation' | 'vk'; // Lead Source
  telegramChatId?: string; // For chatting with lead
  telegramUsername?: string;
  assigneeId: string;
  createdAt: string;
  notes?: string; // Комментарии к сделке
  projectId?: string; // Вид услуг (модуль/проект)
  comments?: Comment[];
  isArchived?: boolean; // Архив
}

export interface Department {
    id: string;
    name: string;
    headId?: string; 
    description?: string;
}

export interface EmployeeInfo {
  id: string;
  userId: string; 
  departmentId?: string; 
  position: string;
  hireDate: string;
  birthDate?: string;
  // Поля salary и conditions удалены согласно ТЗ
  isArchived?: boolean; // Архив (мягкое удаление)
}

// --- BPM TYPES ---

export interface OrgPosition {
    id: string;
    title: string;
    departmentId?: string;
    managerPositionId?: string; 
    holderUserId?: string;
    order?: number; // Порядок для определения позиции слева/справа (меньше = левее)
}

/** Вариант перехода для шага типа variant (ветвление) */
export interface ProcessStepBranch {
    id: string;
    label: string;       // Название варианта (например "Одобрено" / "Отклонено")
    nextStepId: string;  // ID следующего шага
}

export interface ProcessStep {
    id: string;
    title: string;
    description?: string;
    assigneeType: 'user' | 'position';
    assigneeId: string;
    order: number;
    /** Тип шага: normal — линейный переход, variant — ветвление (выбор варианта) */
    stepType?: 'normal' | 'variant';
    /** Для normal: ID следующего шага (если нет — берётся steps[order+1]) */
    nextStepId?: string;
    /** Для variant: варианты перехода после завершения шага */
    branches?: ProcessStepBranch[];
}

export interface ProcessInstance {
    id: string;
    processId: string;
    processVersion: number; // Версия процесса на момент запуска (для защиты от конфликтов)
    currentStepId: string | null; // Текущий активный шаг
    status: 'active' | 'completed' | 'paused';
    startedAt: string;
    completedAt?: string;
    taskIds: string[]; // ID задач, созданных для этого экземпляра
    /** Шаг с вариантами завершён — ожидание выбора ветки пользователем */
    pendingBranchSelection?: { stepId: string };
    /** История выполненных шагов (по мере прохождения процесса) */
    completedStepIds?: string[];
    /** История выбранных веток для шагов типа variant */
    branchHistory?: { stepId: string; branchId?: string; nextStepId: string }[];
}

export interface BusinessProcess {
    id: string;
    version: number; // Версия процесса (для избежания конфликтов)
    title: string;
    description?: string;
    steps: ProcessStep[];
    instances?: ProcessInstance[]; // Экземпляры запущенных процессов
    isArchived?: boolean; // Архив
    createdAt: string; // ISO дата создания
    updatedAt: string; // ISO дата последнего обновления
}

// --- AUTOMATION TYPES ---

export type TriggerType = 
    | 'task_created' | 'task_status_changed' | 'task_assigned' | 'task_comment' | 'task_deadline'
    | 'doc_created' | 'doc_updated' | 'doc_shared'
    | 'meeting_created' | 'meeting_reminder' | 'meeting_updated'
    | 'post_created' | 'post_status_changed'
    | 'purchase_request_created' | 'purchase_request_status_changed' | 'finance_plan_updated'
    | 'deal_created' | 'deal_status_changed' | 'client_created' | 'contract_created'
    | 'employee_created' | 'employee_updated'
    | 'process_started' | 'process_step_completed' | 'process_step_requires_approval';

export type ActionType = 
    | 'telegram_message' 
    | 'approval_request' // Запрос на согласование
    | 'assign_task'
    | 'change_status';

export interface TelegramButtonConfig {
    text: string;
    action: 'approve' | 'reject' | 'defer' | 'view' | 'custom';
    url?: string;
    callbackData?: string;
}

export interface AutomationRule {
    id: string;
    name: string;
    isActive: boolean;
    module: 'tasks' | 'docs' | 'meetings' | 'content' | 'finance' | 'crm' | 'employees' | 'bpm';
    trigger: TriggerType;
    conditions: {
        moduleId?: string; 
        statusTo?: string;
        statusFrom?: string;
        priority?: string;
        departmentId?: string;
        categoryId?: string;
    };
    action: {
        type: ActionType;
        template?: string; 
        buttons?: TelegramButtonConfig[];
        targetUser: 'assignee' | 'creator' | 'admin' | 'specific' | 'manager';
        specificUserId?: string;
        // Для согласования
        approvalType?: 'purchase_request' | 'process_step' | 'document' | 'deal';
        approvalEntityId?: string;
    };
}

// ----------------

export interface Project {
  id: string;
  name: string;
  icon?: string;
  color?: string;
  isArchived?: boolean; // Архив (мягкое удаление)
}

export interface TaskComment {
    id: string;
    taskId: string;
    userId: string;
    text: string;
    createdAt: string;
    isSystem?: boolean;
    attachmentId?: string; // ID вложения, если комментарий связан с загрузкой файла
}

export interface TaskAttachment {
    id: string;
    taskId: string;
    name: string;
    url: string; 
    type: string; 
    uploadedAt: string;
    docId?: string; // Если вложение - это документ из модуля документов
    attachmentType?: 'file' | 'doc'; // Тип вложения: файл или документ
    storagePath?: string; // Путь к файлу (локально или URL)
}

export type EntityType = 'task' | 'idea' | 'feature' | 'purchase_request';

export interface Task {
  id: string;
  entityType: EntityType; // Тип сущности: task, idea, feature, purchase_request
  tableId: string; // ID страницы проекта (для идей/функций) или пустое (для обычных задач)
  title: string;
  status: string; 
  priority: string; 
  assigneeId: string | null;
  assigneeIds?: string[]; 
  projectId: string | null;
  startDate: string;
  endDate: string;
  description?: string;
  isArchived?: boolean;
  comments?: TaskComment[];
  attachments?: TaskAttachment[];
  contentPostId?: string; // LINK TO CONTENT PLAN POST
  processId?: string; // Связь с бизнес-процессом
  processInstanceId?: string; // ID экземпляра процесса
  stepId?: string; // ID шага процесса
  dealId?: string; // Связь со сделкой
  source?: string; // 'Задача', 'Беклог', 'Функционал', или название контент-плана
  category?: string; // Категория функции (ID из functionalityCategories)
  taskId?: string; // ID связанной задачи (для функций)
  createdByUserId?: string; // ID автора (для идей)
  createdAt?: string; // ISO дата создания
  // Поля для purchase_request:
  requesterId?: string; // ID пользователя (для заявок)
  departmentId?: string; // ID отдела (для заявок)
  categoryId?: string; // ID категории финансов (для заявок)
  amount?: number; // Сумма (для заявок)
  decisionDate?: string; // ISO дата решения (для заявок)
}

export interface Meeting {
  id: string;
  tableId: string; // Не используется (модуль фиксированный)
  title: string;
  date: string; // ISO дата
  time: string; // 'HH:mm'
  participantIds: string[];
  summary: string;
  type: 'client' | 'work'; // Тип встречи: с клиентом или рабочая (планерка)
  dealId?: string; // ID сделки (обязательно для встреч с клиентами)
  clientId?: string; // ID клиента (необязательно, берется из сделки)
  recurrence?: 'none' | 'daily' | 'weekly' | 'monthly'; // Повторение (только для рабочих встреч)
  isArchived?: boolean; // Архив
}

export interface ContentPost {
  id: string;
  tableId: string; // ID страницы контент плана для проекта (contentPlanPages.id)
  topic: string; 
  description?: string; // Описание поста (идея, концепция)
  date: string; // ISO дата
  platform: string[]; 
  format: 'post' | 'reel' | 'story' | 'article' | 'video';
  status: 'idea' | 'copywriting' | 'design' | 'approval' | 'scheduled' | 'published';
  copy?: string; // Текст поста (готовый текст для публикации)
  mediaUrl?: string;
  isArchived?: boolean; // Архив
}

export interface TableCollection {
  id: string;
  name: string;
  type: 'tasks' | 'docs' | 'meetings' | 'content-plan' | 'backlog' | 'functionality';
  icon: string;
  color?: string;
  isSystem?: boolean;
  isArchived?: boolean; // Архив (мягкое удаление)
}

export interface Folder {
  id: string;
  tableId: string;
  name: string;
  parentFolderId?: string; // Поддержка вложенных папок
  isArchived?: boolean; // Архив (мягкое удаление)
}

export interface Doc {
  id: string;
  tableId: string; // Не используется (модуль фиксированный)
  folderId?: string; 
  title: string;
  type: 'link' | 'internal';
  url?: string; // Для типа 'link'
  content?: string; // Для типа 'internal' (HTML)
  tags: string[];
  isArchived?: boolean; // Архив
}

export interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  action: string;
  details: string;
  timestamp: string;
  read: boolean;
}

/** Вложение к сообщению — ссылка на сущность системы */
export interface MessageAttachment {
  entityType: 'task' | 'deal' | 'client' | 'doc' | 'meeting' | 'content' | 'project' | 'table';
  entityId: string;
  label?: string;
}

/** Сообщение в ленте входящих/исходящих */
export interface InboxMessage {
  id: string;
  senderId: string;
  recipientId: string | null;
  text: string;
  attachments: MessageAttachment[];
  createdAt: string;
  read: boolean;
}

export interface NotificationSetting {
    // Уведомления в системе всегда включены для всех пользователей
    // Настройки только для Telegram
    telegramPersonal: boolean; // Уведомления в личный Telegram чат
    telegramGroup: boolean;    // Уведомления в групповой Telegram чат
}

export interface NotificationPreferences {
    // Задачи
    newTask: NotificationSetting;
    statusChange: NotificationSetting;
    taskAssigned: NotificationSetting;
    taskComment: NotificationSetting;
    taskDeadline: NotificationSetting;
    // Документы
    docCreated: NotificationSetting;
    docUpdated: NotificationSetting;
    docShared: NotificationSetting;
    // Встречи
    meetingCreated: NotificationSetting;
    meetingReminder: NotificationSetting;
    meetingUpdated: NotificationSetting;
    // Контент-план
    postCreated: NotificationSetting;
    postStatusChanged: NotificationSetting;
    // Финансы
    purchaseRequestCreated: NotificationSetting;
    purchaseRequestStatusChanged: NotificationSetting;
    financePlanUpdated: NotificationSetting;
    // CRM
    dealCreated: NotificationSetting;
    dealStatusChanged: NotificationSetting;
    clientCreated: NotificationSetting;
    contractCreated: NotificationSetting;
    // Сотрудники
    employeeCreated: NotificationSetting;
    employeeUpdated: NotificationSetting;
    // Бизнес-процессы
    processStarted: NotificationSetting;
    processStepCompleted: NotificationSetting;
    processStepRequiresApproval: NotificationSetting;
    // Настройки воронок продаж
    defaultFunnelId?: string; // ID основной воронки для лидов по умолчанию
    // Настройки Telegram
    telegramGroupChatId?: string; // ID группового чата для уведомлений
}

// --- FINANCE TYPES ---

export interface FinanceCategory {
    id: string;
    name: string;
    type: 'fixed' | 'percent'; 
    color?: string;
}

export interface FinancePlan {
    id: string; 
    period: 'week' | 'month';
    salesPlan: number; 
    currentIncome: number; 
}

// PurchaseRequest теперь является частью универсальной сущности Task с entityType: 'purchase_request'
// Поля хранятся в Task: requesterId, departmentId, categoryId, amount, description, status, decisionDate
// Этот интерфейс оставлен для обратной совместимости, но рекомендуется использовать Task с entityType
export interface PurchaseRequest {
    id: string;
    requesterId: string;
    departmentId: string;
    categoryId: string; 
    amount: number;
    description: string;
    status: 'pending' | 'approved' | 'rejected' | 'deferred';
    date: string;
    decisionDate?: string;
    isArchived?: boolean; // Архив
}

// Финансовый план (на месяц) - создается в настройках для каждого подразделения
// Финансовый план - план по доходу и расходу по статьям затрат
export interface FinancialPlanDocument {
    id: string;
    departmentId: string;
    period: string; // YYYY-MM формат месяца
    income: number; // Доход
    expenses: Record<string, number>; // Расходы по статьям: { categoryId: amount }
    status: 'created' | 'conducted' | 'approved'; // создан, проведен, утвержден
    createdAt: string;
    updatedAt?: string;
    approvedBy?: string; // userId
    approvedAt?: string;
    isArchived?: boolean;
}

/** Фонд — целевое распределение дохода (настраиваются в настройках) */
export interface Fund {
    id: string;
    name: string;
    order?: number;
    isArchived?: boolean;
}

// Финансовое планирование: доход (кассовый метод) → распределение по фондам → заявки по фондам
export interface FinancialPlanning {
    id: string;
    departmentId: string;
    period: string; // YYYY-MM формат месяца
    planDocumentId?: string; // Ссылка на FinancialPlanDocument (опционально)
    /** Доход за период (по кассовому методу) — вносится при создании/редактировании */
    income?: number;
    /** Распределение дохода по фондам: fundId -> сумма */
    fundAllocations?: Record<string, number>;
    /** Привязка заявки к фонду: requestId -> fundId (из какого фонда оплачивается заявка) */
    requestFundIds?: Record<string, string>;
    requestIds: string[]; // ID заявок в планировании
    status: 'created' | 'conducted' | 'approved'; // создан, проведен, одобрен
    createdAt: string;
    updatedAt?: string;
    approvedBy?: string; // userId
    approvedAt?: string;
    notes?: string;
    isArchived?: boolean;
}

// --- INVENTORY TYPES ---

export interface Warehouse {
  id: string;
  name: string;
  departmentId?: string;
  location?: string;
  isDefault?: boolean;
  isArchived?: boolean;
}

export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  unit: string;
  category?: string;
  notes?: string;
  isArchived?: boolean;
}

/** Строка ревизии: номенклатура, учётный и фактический остаток */
export interface InventoryRevisionLine {
  itemId: string;
  quantitySystem: number;
  quantityFact: number;
}

/** Ревизия (инвентаризация) на складе */
export interface InventoryRevision {
  id: string;
  number: string;
  warehouseId: string;
  date: string;
  status: 'draft' | 'posted';
  lines: InventoryRevisionLine[];
  reason?: string;
  createdByUserId: string;
  postedAt?: string;
}

export type StockMovementType = 'receipt' | 'transfer' | 'writeoff' | 'adjustment';

export interface StockMovementItem {
  itemId: string;
  quantity: number;
  price?: number;
}

export interface StockMovement {
  id: string;
  type: StockMovementType;
  date: string;
  fromWarehouseId?: string;
  toWarehouseId?: string;
  items: StockMovementItem[];
  reason?: string;
  createdByUserId: string;
}

export interface StockBalance {
  warehouseId: string;
  itemId: string;
  quantity: number;
}

// --- NEW INTERFACES FROM DATA ARCHITECTURE ---

export interface BacklogPage {
  id: string;
  projectId: string; // ID проекта
  name: string; // Название страницы (обычно название проекта)
  createdAt: string; // ISO дата создания
}

export interface FunctionalityPage {
  id: string;
  projectId: string; // ID проекта
  name: string; // Название страницы (обычно название проекта)
  createdAt: string; // ISO дата создания
}

export interface FunctionalityCategory {
  id: string;
  name: string; // 'counters', 'seo', 'features', 'backend', 'infrastructure'
  description?: string;
  defaultFeatures?: string[]; // ID базовых функций для этой категории
}

export interface DefaultFeature {
  id: string;
  categoryId: string; // ID категории
  title: string;
  description?: string;
  order: number; // Порядок создания
}

export interface ContentPlanPage {
  id: string;
  projectId: string; // ID проекта
  name: string; // Название страницы (обычно название проекта)
  createdAt: string; // ISO дата создания
  publicLink?: string; // Публичная ссылка для клиента
}

// Типы для управления контентом сайтов
export interface Tag {
  id: string;
  name: string; // Название тега
  color?: string; // Цвет тега (hex)
  createdAt: string;
  updatedAt?: string;
  isArchived?: boolean;
}

export interface PartnerLogo {
  id: string;
  name: string; // Название партнера
  logoUrl: string; // URL логотипа
  websiteUrl?: string; // Ссылка на сайт партнера
  order: number; // Порядок отображения
  createdAt: string;
  updatedAt?: string;
  isArchived?: boolean;
}

export interface News {
  id: string;
  title: string; // Заголовок новости
  content: string; // HTML контент (из редактора)
  imageUrl?: string; // URL главного изображения
  excerpt?: string; // Краткое описание для превью
  tags: string[]; // Массив ID тегов
  published: boolean; // Опубликована ли новость
  publishedAt?: string; // Дата публикации
  createdAt: string;
  updatedAt?: string;
  isArchived?: boolean;
}

export interface Case {
  id: string;
  title: string; // Название кейса
  description: string; // HTML описание кейса
  imageUrl?: string; // URL главного изображения
  excerpt?: string; // Аннотация для превью
  clientName?: string; // Название клиента (необязательно)
  websiteUrl?: string; // Ссылка на сайт проекта/клиента
  instagramUrl?: string; // Ссылка на Instagram проекта/клиента
  tags: string[]; // Массив ID тегов
  order: number; // Порядок отображения
  published: boolean; // Опубликован ли кейс
  createdAt: string;
  updatedAt?: string;
  isArchived?: boolean;
}

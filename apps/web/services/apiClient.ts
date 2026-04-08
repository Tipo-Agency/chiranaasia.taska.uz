/**
 * HTTP API client for Python FastAPI backend.
 * Replaces localStorage-backed backend with REST calls.
 */
// VITE_API_URL: full base (e.g. http://localhost:8000/api) or empty for same-origin /api (proxied)
const env = typeof import.meta !== 'undefined' && (import.meta as { env?: Record<string, string> }).env;
const API_BASE = (env?.VITE_API_URL ?? '/api').replace(/\/$/, '');

function getAuthHeaders(): Record<string, string> {
  try {
    const token = typeof window !== 'undefined' ? sessionStorage.getItem('access_token') : null;
    if (token) return { Authorization: `Bearer ${token}` };
  } catch {
    // ignore
  }
  return {};
}

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
      ...(options?.headers || {}),
    },
    credentials: 'include',
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `HTTP ${res.status}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : ({} as T);
}

async function get<T>(path: string): Promise<T> {
  return fetchJson<T>(path, { method: 'GET' });
}

async function put<T>(path: string, body: unknown): Promise<T> {
  return fetchJson<T>(path, { method: 'PUT', body: JSON.stringify(body) });
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  return fetchJson<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined });
}

async function patch<T>(path: string, body: unknown): Promise<T> {
  return fetchJson<T>(path, { method: 'PATCH', body: JSON.stringify(body) });
}

async function del<T>(path: string): Promise<T> {
  return fetchJson<T>(path, { method: 'DELETE' });
}

// System (health, logs for admin)
export const systemEndpoint = {
  getLogs: (params?: { limit?: number; level?: string }) => {
    const sp = new URLSearchParams();
    if (params?.limit != null) sp.set('limit', String(params.limit));
    if (params?.level) sp.set('level', params.level);
    const q = sp.toString();
    return get<Array<{ id: number; created_at: string; level: string; message: string; logger_name?: string; path?: string; request_id?: string; payload?: string }>>(`/system/logs${q ? `?${q}` : ''}`);
  },
};

// Admin (requires ADMIN role + JWT)
export const adminEndpoint = {
  getTables: () => get<Array<{ name: string; row_count?: number }>>('/admin/tables'),
  getTableData: (tableName: string, offset = 0, limit = 100) =>
    get<{ table: string; columns: string[]; rows: Record<string, unknown>[]; total: number; offset: number; limit: number }>(
      `/admin/tables/${encodeURIComponent(tableName)}?offset=${offset}&limit=${limit}`
    ),
  getHealth: () => get<{ status: string; version: string; db: string; db_error?: string }>('/admin/health'),
  getStats: () =>
    get<{ tables: Array<{ table_name: string; row_count: number }>; db_size_mb?: number }>('/admin/stats'),
  runTests: () => post<{ ok: boolean; output: string; exit_code: number }>('/admin/tests/run'),
  getBotStatus: () =>
    get<{ telegram_configured: boolean; group_chat_id?: string; group_chat_id_set: boolean }>('/admin/bot/status'),
  testBotDailySummary: () => post<{ ok: boolean; error?: string }>('/admin/bot/test-daily-summary'),
  testBotNewDeal: () => post<{ ok: boolean; error?: string }>('/admin/bot/test-new-deal'),
  testBotCongrats: () => post<{ ok: boolean; error?: string }>('/admin/bot/test-congrats'),
  getRedisMonitor: () =>
    get<{
      redis_ok: boolean;
      redis_error?: string;
      redis_url: string;
      stream_name: string;
      stream_length?: number;
      stream_last_generated_id?: string;
      stream_groups?: number;
      events_total: number;
      events_published: number;
      deliveries_pending: number;
      deliveries_failed: number;
      deliveries_sent: number;
      stream_group_details?: Array<{
        name?: string;
        consumers?: number;
        pending?: number;
        lag?: number | null;
        last_delivered_id?: string;
      }>;
    }>('/admin/redis/monitor'),
  runNotificationDeliveries: (limit = 500) =>
    post<{ ok: boolean; processed: number; sent: number; failed: number; skipped: number }>(
      `/admin/notifications/run-deliveries?limit=${encodeURIComponent(String(limit))}`
    ),
  runNotificationRetention: (days?: number) =>
    post<{ ok: boolean; days: number; archived_notifications: number; deleted_events: number; deleted_deliveries: number }>(
      `/admin/notifications/run-retention${typeof days === 'number' ? `?days=${encodeURIComponent(String(days))}` : ''}`
    ),
  getFailedDeliveries: (limit = 20, channel?: string, query?: string) =>
    get<Array<{
      id: string;
      notification_id: string;
      channel: string;
      attempts: string;
      last_error?: string;
      updated_at?: string;
      notification_title?: string;
      recipient_id?: string;
    }>>(`/admin/notifications/failed-deliveries?limit=${encodeURIComponent(String(limit))}${channel ? `&channel=${encodeURIComponent(channel)}` : ''}${query ? `&q=${encodeURIComponent(query)}` : ''}`),
  requeueFailedDeliveries: (limit = 200) =>
    post<{ ok: boolean; requeued: number }>(`/admin/notifications/requeue-failed?limit=${encodeURIComponent(String(limit))}`),
  requeueFailedDeliveryById: (deliveryId: string) =>
    post<{ ok: boolean; requeued: number }>(`/admin/notifications/requeue-failed/${encodeURIComponent(deliveryId)}`),
};

// Auth / Users
export const authEndpoint = {
  getAll: () => get<unknown[]>('/auth/users'),
  updateAll: (users: unknown[]) => put<{ ok: boolean }>('/auth/users', users),
  login: (login: string, password: string) =>
    post<{ access_token: string; token_type: string; user: unknown }>('/auth/login', { login, password }),
  getMe: () => get<unknown>('/auth/me'),
  getPermissionsCatalog: () =>
    get<{ groups: Array<{ id: string; label: string; items: Array<{ key: string; label: string }> }>; allKeys: string[] }>(
      '/auth/permissions/catalog'
    ),
  getRoles: () => get<unknown[]>('/auth/roles'),
  createRole: (body: { name: string; slug?: string; description?: string; permissions: string[] }) =>
    post<{ id: string; ok: boolean }>('/auth/roles', body),
  patchRole: (id: string, body: { name?: string; description?: string; permissions?: string[]; sort_order?: number }) =>
    patch<{ ok: boolean }>(`/auth/roles/${encodeURIComponent(id)}`, body),
  deleteRole: (id: string) => del<{ ok: boolean }>(`/auth/roles/${encodeURIComponent(id)}`),
};

// Tasks
export const tasksEndpoint = {
  getAll: () => get<unknown[]>('/tasks'),
  updateAll: (tasks: unknown[]) => put<{ ok: boolean }>('/tasks', tasks),
};

// Projects
export const projectsEndpoint = {
  getAll: () => get<unknown[]>('/projects'),
  updateAll: (projects: unknown[]) => put<{ ok: boolean }>('/projects', projects),
};

// Tables
export const tablesEndpoint = {
  getAll: () => get<unknown[]>('/tables'),
  updateAll: (tables: unknown[]) => put<{ ok: boolean }>('/tables', tables),
};

// Activity
export const activityEndpoint = {
  getAll: () => get<unknown[]>('/activity'),
  updateAll: (logs: unknown[]) => put<{ ok: boolean }>('/activity', logs),
  add: (log: unknown) => post<{ ok: boolean }>('/activity', log),
};

// Messages (inbox/outbox)
export const messagesEndpoint = {
  getInbox: (userId: string) => get<unknown[]>(`/messages?folder=inbox&user_id=${encodeURIComponent(userId)}`),
  getOutbox: (userId: string) => get<unknown[]>(`/messages?folder=outbox&user_id=${encodeURIComponent(userId)}`),
  add: (body: { id?: string; createdAt?: string; senderId: string; recipientId?: string | null; text: string; attachments?: unknown[] }) =>
    post<{ ok: boolean; id: string }>('/messages', body),
  markRead: (messageId: string, read: boolean) => patch<{ ok: boolean }>(`/messages/${messageId}`, { read }),
};

// Statuses
export const statusesEndpoint = {
  getAll: () => get<unknown[]>('/statuses'),
  updateAll: (statuses: unknown[]) => put<{ ok: boolean }>('/statuses', statuses),
};

// Priorities
export const prioritiesEndpoint = {
  getAll: () => get<unknown[]>('/priorities'),
  updateAll: (priorities: unknown[]) => put<{ ok: boolean }>('/priorities', priorities),
};

// Notification prefs
export const notificationPrefsEndpoint = {
  get: (userId?: string) =>
    get<unknown>(`/notification-prefs${userId ? `?user_id=${encodeURIComponent(userId)}` : ''}`),
  update: (prefs: unknown, userId?: string) =>
    put<{ ok: boolean }>(`/notification-prefs${userId ? `?user_id=${encodeURIComponent(userId)}` : ''}`, prefs),
};

// Automation
export const automationEndpoint = {
  getRules: () => get<unknown[]>('/automation/rules'),
  updateRules: (rules: unknown[]) => put<{ ok: boolean }>('/automation/rules', rules),
};

/**
 * Заглушка: очередь уведомлений обрабатывается на бэкенде (notification hub).
 * С фронта не используйте — доставка идёт через события API.
 */
export const notificationQueueEndpoint = {
  add: async (_task: { type: string; userId: string; message: string; chatId: string; metadata?: Record<string, unknown> }) =>
    Promise.resolve(),
};

// Centralized notification events / center
export const notificationEventsEndpoint = {
  publish: (event: unknown) => post<{ id: string; published: boolean; streamId?: string }>('/notification-events/publish', event),
  recent: (limit = 50) => get<unknown[]>(`/notification-events/recent?limit=${limit}`),
};

export const notificationsEndpoint = {
  list: (userId: string, unreadOnly = false, limit = 50) =>
    get<unknown[]>(
      `/notifications?user_id=${encodeURIComponent(userId)}&unread_only=${String(unreadOnly)}&limit=${String(limit)}`
    ),
  markRead: (notificationId: string, isRead = true) =>
    post<{ ok: boolean }>(`/notifications/${encodeURIComponent(notificationId)}/read`, { isRead }),
  runDeliveries: (limit = 100) =>
    post<{ ok: boolean; processed: number; sent: number; failed: number; skipped: number }>(
      `/notifications/deliveries/run?limit=${String(limit)}`
    ),
  unreadCount: (userId: string) =>
    get<{ userId: string; unreadCount: number }>(
      `/notifications/unread-count?user_id=${encodeURIComponent(userId)}`
    ),
  runRetention: (days?: number) =>
    post<{ ok: boolean; days: number; archived_notifications: number; deleted_events: number; deleted_deliveries: number }>(
      `/notifications/retention/run${typeof days === "number" ? `?days=${String(days)}` : ""}`
    ),
  wsUrl: (userId: string) => {
    const base = API_BASE.startsWith("http")
      ? API_BASE.replace(/^http/, "ws")
      : `${typeof window !== "undefined" ? window.location.origin.replace(/^http/, "ws") : ""}${API_BASE}`;
    return `${base}/notifications/ws/${encodeURIComponent(userId)}`;
  },
};

// Clients
export const clientsEndpoint = {
  getAll: () => get<unknown[]>('/clients'),
  updateAll: (clients: unknown[]) => put<{ ok: boolean }>('/clients', clients),
};

const isContractLikeDeal = (item: unknown): boolean => {
  if (!item || typeof item !== 'object') return false;
  const deal = item as Record<string, unknown>;
  if (deal.dealKind === 'contract') return true;
  // Для CRM-сделок backend тоже часто возвращает recurring=false по умолчанию,
  // поэтому опираемся на наличие номера/договорных полей, а не на сам флаг recurring.
  const hasNumber = typeof deal.number === 'string' && deal.number.trim().length > 0;
  const hasContractDates = typeof deal.startDate === 'string' || typeof deal.endDate === 'string';
  const hasPaymentMeta = deal.paymentDay != null || typeof deal.paidAmount === 'number' || typeof deal.paidDate === 'string';
  return hasNumber || hasContractDates || hasPaymentMeta;
};

const isFunnelLikeDeal = (item: unknown): boolean => {
  if (!item || typeof item !== 'object') return false;
  const deal = item as Record<string, unknown>;
  if (deal.dealKind === 'funnel') return true;
  if (deal.dealKind === 'contract') return false;
  const hasStage = typeof deal.stage === 'string' && deal.stage.trim().length > 0;
  const hasTitle = typeof deal.title === 'string' && deal.title.trim().length > 0;
  return hasStage && hasTitle;
};

const isRecurringContract = (item: unknown): boolean => {
  if (!item || typeof item !== 'object') return false;
  const deal = item as Record<string, unknown>;
  return deal.recurring === true;
};

const isOneTimeSale = (item: unknown): boolean => {
  if (!item || typeof item !== 'object') return false;
  const deal = item as Record<string, unknown>;
  return deal.recurring === false;
};

const mergeById = (left: unknown[], right: unknown[]): unknown[] => {
  const map = new Map<string, unknown>();
  for (const item of left) {
    const id = item && typeof item === 'object' ? (item as Record<string, unknown>).id : undefined;
    if (typeof id === 'string' && id) map.set(id, item);
  }
  for (const item of right) {
    const id = item && typeof item === 'object' ? (item as Record<string, unknown>).id : undefined;
    if (typeof id === 'string' && id) map.set(id, item);
  }
  return [...map.values()];
};

// CRM deals only
export const dealsEndpoint = {
  getAll: async () => {
    const all = await get<unknown[]>('/deals');
    // CRM поток: берём всё, что не похоже на договор/продажу.
    // Не требуем строгую funnel-валидацию, чтобы не терять старые лиды.
    return (all || []).filter((d) => !isContractLikeDeal(d));
  },
  updateAll: async (deals: unknown[]) => {
    const all = await get<unknown[]>('/deals');
    const preserved = (all || []).filter((d) => isContractLikeDeal(d));
    return put<{ ok: boolean }>('/deals', mergeById(preserved, deals));
  },
  create: (deal: unknown) => post<unknown>('/deals', deal),
  update: (id: string, updates: unknown) => patch<unknown>(`/deals/${id}`, updates),
  getById: (id: string) => get<unknown>(`/deals/${id}`),
  delete: (id: string) => del<{ ok: boolean }>(`/deals/${id}`),
};

export const integrationsMetaEndpoint = {
  sendInstagram: (body: { dealId: string; text: string }) =>
    post<unknown>('/integrations/meta/instagram/send', body),
};

export const integrationsSiteEndpoint = {
  rotateKey: (body: { funnelId: string }) => post<{ ok: boolean; funnelId: string; apiKey: string; keyLast4: string }>('/integrations/site/keys/rotate', body),
  keyStatus: (funnelId: string) => get<{ ok: boolean; funnelId: string; active: boolean; keyLast4?: string | null }>(`/integrations/site/keys/status?funnel_id=${encodeURIComponent(funnelId)}`),
};

export const integrationsTelegramPersonalEndpoint = {
  status: () =>
    get<{
      connected: boolean;
      apiConfigured: boolean;
      phoneMasked?: string | null;
      status?: string;
    }>('/integrations/telegram-personal/status'),
  sendCode: (body: { phone: string }) =>
    post<{ ok: boolean; phoneMasked?: string }>('/integrations/telegram-personal/auth/send-code', body),
  signIn: (body: { phone: string; code: string }) =>
    post<{ ok: boolean; needPassword?: boolean }>('/integrations/telegram-personal/auth/sign-in', body),
  password: (body: { password: string }) => post<{ ok: boolean }>('/integrations/telegram-personal/auth/password', body),
  disconnect: () => del<{ ok: boolean }>('/integrations/telegram-personal/session'),
  syncMessages: (dealId: string, body?: { limit?: number }) =>
    post<unknown>(`/integrations/telegram-personal/deals/${encodeURIComponent(dealId)}/sync-messages`, body ?? {}),
  sendDeal: (dealId: string, body: { text: string }) =>
    post<unknown>(`/integrations/telegram-personal/deals/${encodeURIComponent(dealId)}/send`, body),
};

export const integrationsTelegramEndpoint = {
  sendToLead: (body: { dealId: string; text: string }) =>
    post<unknown>('/integrations/telegram/send', body),
  registerWebhook: (body: { funnelId: string }) =>
    post<{ ok: boolean; webhookUrl: string; webhookRegistered: boolean }>('/integrations/telegram/webhook/register', body),
  unregisterWebhook: (body: { funnelId: string }) => post<{ ok: boolean; webhookRegistered: boolean }>('/integrations/telegram/webhook/unregister', body),
  webhookStatus: (funnelId: string) =>
    get<{
      ok: boolean;
      funnelId: string;
      webhookUrl: string;
      webhookRegistered: boolean;
      useWebhook: boolean;
      webhookSecretSet: boolean;
    }>(`/integrations/telegram/webhook/status?funnelId=${encodeURIComponent(funnelId)}`),
};

export const contractsEndpoint = {
  getAll: async () => {
    const all = await get<unknown[]>('/deals');
    return (all || []).filter((d) => isContractLikeDeal(d) && isRecurringContract(d));
  },
  updateAll: async (contracts: unknown[]) => {
    const all = await get<unknown[]>('/deals');
    const preserved = (all || []).filter((d) => !isRecurringContract(d));
    return put<{ ok: boolean }>('/deals', mergeById(preserved, contracts));
  },
};

export const oneTimeDealsEndpoint = {
  getAll: async () => {
    const all = await get<unknown[]>('/deals');
    return (all || []).filter((d) => isContractLikeDeal(d) && isOneTimeSale(d));
  },
  updateAll: async (sales: unknown[]) => {
    const all = await get<unknown[]>('/deals');
    const preserved = (all || []).filter((d) => !isOneTimeSale(d));
    return put<{ ok: boolean }>('/deals', mergeById(preserved, sales));
  },
};

// Employees
export const employeesEndpoint = {
  getAll: () => get<unknown[]>('/employees'),
  updateAll: (employees: unknown[]) => put<{ ok: boolean }>('/employees', employees),
};

// Accounts receivable
export const accountsReceivableEndpoint = {
  getAll: () => get<unknown[]>('/accounts-receivable'),
  updateAll: (items: unknown[]) => put<{ ok: boolean }>('/accounts-receivable', items),
};

// Docs
export const docsEndpoint = {
  getAll: () => get<unknown[]>('/docs'),
  updateAll: (docs: unknown[]) => put<{ ok: boolean }>('/docs', docs),
};

// Folders
export const foldersEndpoint = {
  getAll: () => get<unknown[]>('/folders'),
  updateAll: (folders: unknown[]) => put<{ ok: boolean }>('/folders', folders),
};

// Weekly plans and protocols
export interface WeeklyPlanApi {
  id: string;
  userId: string;
  weekStart: string;
  weekEnd?: string;
  taskIds: string[];
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ProtocolApi {
  id: string;
  title: string;
  weekStart: string;
  weekEnd?: string;
  departmentId?: string;
  participantIds: string[];
  plannedIncome?: number;
  actualIncome?: number;
  createdAt: string;
  updatedAt?: string;
}

export const weeklyPlansEndpoint = {
  getPlans: (params?: { userId?: string; weekStart?: string }) => {
    const sp = new URLSearchParams();
    if (params?.userId) sp.set('user_id', params.userId);
    if (params?.weekStart) sp.set('week_start', params.weekStart);
    const q = sp.toString();
    return get<WeeklyPlanApi[]>(`/weekly-plans${q ? `?${q}` : ''}`);
  },
  updatePlans: (plans: WeeklyPlanApi[]) => put<{ ok: boolean }>('/weekly-plans', plans),
  getMyLatest: (userId: string) => get<WeeklyPlanApi | null>(`/weekly-plans/mine/latest?user_id=${encodeURIComponent(userId)}`),
  deletePlan: (id: string) => del<{ ok: boolean }>(`/weekly-plans/${id}`),
  getProtocols: () => get<ProtocolApi[]>('/weekly-plans/protocols'),
  updateProtocols: (protocols: ProtocolApi[]) => put<{ ok: boolean }>('/weekly-plans/protocols', protocols),
  getProtocolAggregated: (protocolId: string) =>
    get<{ protocol: ProtocolApi; plans: WeeklyPlanApi[]; taskIdsByUser: Record<string, string[]> }>(
      `/weekly-plans/protocols/${protocolId}/aggregated`
    ),
  deleteProtocol: (id: string) => del<{ ok: boolean }>(`/weekly-plans/protocols/${id}`),
};

// Calendar (iCal export for Google Calendar etc.)
export const calendarEndpoint = {
  ensureExportToken: (body?: { rotate?: boolean }) =>
    post<{ ok: boolean; token: string }>('/calendar/export-token', body ?? {}),
};

// Meetings
export const meetingsEndpoint = {
  getAll: () => get<unknown[]>('/meetings'),
  updateAll: (meetings: unknown[]) => put<{ ok: boolean }>('/meetings', meetings),
};

// Content posts
export const contentPostsEndpoint = {
  getAll: () => get<unknown[]>('/content-posts'),
  updateAll: (posts: unknown[]) => put<{ ok: boolean }>('/content-posts', posts),
};

// Shoot plans (content plan → calendar)
export const shootPlansEndpoint = {
  getAll: () => get<unknown[]>('/shoot-plans'),
  updateAll: (plans: unknown[]) => put<{ ok: boolean }>('/shoot-plans', plans),
};

// Departments
export const departmentsEndpoint = {
  getAll: () => get<unknown[]>('/departments'),
  updateAll: (departments: unknown[]) => put<{ ok: boolean }>('/departments', departments),
};

// Finance (types for bank statements and income reports)
export interface BankStatementLineApi {
  id?: string;
  statementId?: string;
  lineDate: string;
  description?: string;
  amount: number;
  lineType: 'in' | 'out';
}

export interface BankStatementApi {
  id: string;
  name?: string;
  period?: string;
  createdAt: string;
  lines: BankStatementLineApi[];
}

export interface IncomeReportApi {
  id: string;
  period: string;
  data: Record<string, number>;
  createdAt?: string;
  updatedAt?: string;
}

export const financeEndpoint = {
  getCategories: () => get<unknown[]>('/finance/categories'),
  updateCategories: (categories: unknown[]) => put<{ ok: boolean }>('/finance/categories', categories),
  getFunds: () => get<unknown[]>('/finance/funds'),
  updateFunds: (funds: unknown[]) => put<{ ok: boolean }>('/finance/funds', funds),
  getPlan: () => get<unknown | null>('/finance/plan'),
  updatePlan: (plan: unknown) => put<{ ok: boolean }>('/finance/plan', plan),
  getRequests: () => get<unknown[]>('/finance/requests'),
  updateRequests: (requests: unknown[]) => put<{ ok: boolean }>('/finance/requests', requests),
  getFinancialPlanDocuments: () => get<unknown[]>('/finance/financial-plan-documents'),
  updateFinancialPlanDocuments: (docs: unknown[]) => put<{ ok: boolean }>('/finance/financial-plan-documents', docs),
  getFinancialPlannings: () => get<unknown[]>('/finance/financial-plannings'),
  updateFinancialPlannings: (plannings: unknown[]) => put<{ ok: boolean }>('/finance/financial-plannings', plannings),
  getBankStatements: () => get<BankStatementApi[]>('/finance/bank-statements'),
  updateBankStatements: (statements: BankStatementApi[]) => put<{ ok: boolean }>('/finance/bank-statements', statements),
  deleteBankStatement: (id: string) => del<{ ok: boolean }>(`/finance/bank-statements/${id}`),
  getIncomeReports: () => get<IncomeReportApi[]>('/finance/income-reports'),
  updateIncomeReports: (reports: IncomeReportApi[]) => put<{ ok: boolean }>('/finance/income-reports', reports),
  getBdr: (year?: string) => get<{ year: string; rows: unknown[] }>(`/finance/bdr${year ? `?year=${encodeURIComponent(year)}` : ''}`),
  updateBdr: (payload: { year: string; rows: unknown[] }) => put<{ ok: boolean }>('/finance/bdr', payload),
};

// BPM
export const bpmEndpoint = {
  getPositions: () => get<unknown[]>('/bpm/positions'),
  updatePositions: (positions: unknown[]) => put<{ ok: boolean }>('/bpm/positions', positions),
  getProcesses: () => get<unknown[]>('/bpm/processes'),
  updateProcesses: (processes: unknown[]) => put<{ ok: boolean }>('/bpm/processes', processes),
};

// Inventory
export const inventoryEndpoint = {
  getWarehouses: () => get<unknown[]>('/inventory/warehouses'),
  updateWarehouses: (warehouses: unknown[]) => put<{ ok: boolean }>('/inventory/warehouses', warehouses),
  getItems: () => get<unknown[]>('/inventory/items'),
  updateItems: (items: unknown[]) => put<{ ok: boolean }>('/inventory/items', items),
  getMovements: () => get<unknown[]>('/inventory/movements'),
  updateMovements: (movements: unknown[]) => put<{ ok: boolean }>('/inventory/movements', movements),
  getRevisions: () => get<unknown[]>('/inventory/revisions'),
  updateRevisions: (revisions: unknown[]) => put<{ ok: boolean }>('/inventory/revisions', revisions),
};

// Funnels
export const funnelsEndpoint = {
  getAll: () => get<unknown[]>('/funnels'),
  updateAll: (funnels: unknown[]) => put<{ ok: boolean }>('/funnels', funnels),
  create: (funnel: unknown) => post<unknown>('/funnels', funnel),
  update: (id: string, updates: unknown) => patch<unknown>(`/funnels/${id}`, updates),
  delete: (id: string) => del<{ ok: boolean }>(`/funnels/${id}`),
};

// Public content plan (no auth required)
export const publicContentPlanEndpoint = {
  getByTableId: (tableId: string) =>
    get<{ table: unknown | null; posts: unknown[]; shootPlans?: unknown[] }>(
      `/tables/public/content-plan/${encodeURIComponent(tableId)}`
    ),
};

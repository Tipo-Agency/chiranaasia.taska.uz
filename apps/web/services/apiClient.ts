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
};

// Auth / Users
export const authEndpoint = {
  getAll: () => get<unknown[]>('/auth/users'),
  updateAll: (users: unknown[]) => put<{ ok: boolean }>('/auth/users', users),
  login: (login: string, password: string) =>
    post<{ access_token: string; token_type: string; user: unknown }>('/auth/login', { login, password }),
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
  add: (body: { senderId: string; recipientId?: string | null; text: string; attachments?: unknown[] }) =>
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
  get: () => get<unknown>('/notification-prefs'),
  update: (prefs: unknown) => put<{ ok: boolean }>('/notification-prefs', prefs),
};

// Automation
export const automationEndpoint = {
  getRules: () => get<unknown[]>('/automation/rules'),
  updateRules: (rules: unknown[]) => put<{ ok: boolean }>('/automation/rules', rules),
};

// Notification queue (for telegram bot)
export const notificationQueueEndpoint = {
  add: async (_task: { type: string; userId: string; message: string; chatId: string; metadata?: Record<string, unknown> }) => {
    // TODO: implement on backend if needed
    return Promise.resolve();
  },
};

// Clients
export const clientsEndpoint = {
  getAll: () => get<unknown[]>('/clients'),
  updateAll: (clients: unknown[]) => put<{ ok: boolean }>('/clients', clients),
};

// Deals (also contracts, oneTimeDeals)
export const dealsEndpoint = {
  getAll: () => get<unknown[]>('/deals'),
  updateAll: (deals: unknown[]) => put<{ ok: boolean }>('/deals', deals),
  create: (deal: unknown) => post<unknown>('/deals', deal),
  update: (id: string, updates: unknown) => patch<unknown>(`/deals/${id}`, updates),
  getById: (id: string) => get<unknown>(`/deals/${id}`),
  delete: (id: string) => del<{ ok: boolean }>(`/deals/${id}`),
};

export const contractsEndpoint = dealsEndpoint;
export const oneTimeDealsEndpoint = dealsEndpoint;

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
  taskIds: string[];
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ProtocolApi {
  id: string;
  title: string;
  weekStart: string;
  participantIds: string[];
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

// Sites
export const partnerLogosEndpoint = {
  getAll: () => get<unknown[]>('/sites/partner-logos'),
  updateAll: (logos: unknown[]) => put<{ ok: boolean }>('/sites/partner-logos', logos),
};

export const newsEndpoint = {
  getAll: () => get<unknown[]>('/sites/news'),
  updateAll: (news: unknown[]) => put<{ ok: boolean }>('/sites/news', news),
  getPublished: () => get<unknown[]>('/sites/news/published'),
};

export const casesEndpoint = {
  getAll: () => get<unknown[]>('/sites/cases'),
  updateAll: (cases: unknown[]) => put<{ ok: boolean }>('/sites/cases', cases),
  getPublished: () => get<unknown[]>('/sites/cases/published'),
};

export const tagsEndpoint = {
  getAll: () => get<unknown[]>('/sites/tags'),
  updateAll: (tags: unknown[]) => put<{ ok: boolean }>('/sites/tags', tags),
};

export const publicSitesEndpoint = {
  getSiteData: () => get<{ partnerLogos: unknown[]; news: unknown[]; cases: unknown[]; tags: unknown[] }>('/sites/public/site-data'),
};

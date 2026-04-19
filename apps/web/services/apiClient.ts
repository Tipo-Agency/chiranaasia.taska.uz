/**
 * HTTP API client for Python FastAPI backend.
 * Replaces localStorage-backed backend with REST calls.
 */
import type {
  Bdr,
  Client,
  CrmContact,
  Deal,
  DealAttachment,
  EntityType,
  IntegrationsRoadmapResponse,
  PurchaseRequest,
  Task,
  TaskAttachment,
  TaskComment,
} from '../types';

// VITE_API_URL: full base (e.g. http://localhost:8000/api) or empty for same-origin /api (proxied)
const env = typeof import.meta !== 'undefined' && (import.meta as { env?: Record<string, string> }).env;
const API_BASE = (env?.VITE_API_URL ?? '/api').replace(/\/$/, '');

const CSRF_COOKIE = 'csrf_token';

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const safe = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = document.cookie.match(new RegExp(`(?:^|; )${safe}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

function getCsrfHeaders(method: string): Record<string, string> {
  const m = (method || 'GET').toUpperCase();
  if (m === 'GET' || m === 'HEAD' || m === 'OPTIONS') return {};
  const t = readCookie(CSRF_COOKIE);
  if (!t) return {};
  return { 'X-CSRF-Token': t };
}

/** JWT в HttpOnly cookie; Bearer не используем (кроме внешних интеграций на бэкенде). */
function getAuthHeaders(): Record<string, string> {
  return {};
}

/** Если csrf cookie нет, но есть сессия (access cookie), бэкенд выставит csrf через GET /auth/csrf. */
export async function ensureAuthCsrfCookie(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (readCookie(CSRF_COOKIE)) return;
  try {
    await fetch(`${API_BASE}/auth/csrf`, {
      method: 'GET',
      credentials: 'include',
    });
  } catch {
    // ignore
  }
}

type FetchJsonOpts = RequestInit & { skipAuthRefresh?: boolean };

let unauthorizedHandler: (() => void) | null = null;
let apiErrorNotifier: ((message: string) => void) | null = null;

/** Сброс сессии в UI после окончательного 401 (после неудачного refresh). */
export function setApiUnauthorizedHandler(fn: (() => void) | null): void {
  unauthorizedHandler = fn;
}

/** Тосты для 403 / 422 / 5xx (регистрирует useAuthLogic через showNotification). */
export function setApiErrorNotifier(fn: ((message: string) => void) | null): void {
  apiErrorNotifier = fn;
}

function formatFastApiValidationDetail(detail: unknown): string | null {
  if (!Array.isArray(detail)) return null;
  const parts: string[] = [];
  for (const item of detail) {
    if (item && typeof item === 'object' && 'msg' in item) {
      const m = (item as { msg?: unknown }).msg;
      if (typeof m === 'string' && m.trim()) parts.push(m);
    }
  }
  return parts.length ? parts.join('; ') : null;
}

let refreshInFlight: Promise<boolean> | null = null;

async function tryRefreshAccessToken(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  const p = (async (): Promise<boolean> => {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
        credentials: 'include',
      });
      return res.ok;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();
  refreshInFlight = p;
  return p;
}

async function fetchJson<T>(url: string, options?: FetchJsonOpts): Promise<T> {
  const method = (options?.method || 'GET').toUpperCase();
  const mutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
  if (
    mutating &&
    typeof window !== 'undefined' &&
    !readCookie(CSRF_COOKIE) &&
    !url.startsWith('/auth/login') &&
    !url.startsWith('/auth/refresh')
  ) {
    await ensureAuthCsrfCookie();
  }
  const buildHeaders = (): HeadersInit => {
    const h: Record<string, string> = {
      ...getAuthHeaders(),
      ...getCsrfHeaders(method),
      ...(options?.headers as Record<string, string> | undefined),
    };
    if (options?.body != null && typeof options.body === 'string' && !h['Content-Type']) {
      h['Content-Type'] = 'application/json';
    }
    return h;
  };

  const doFetch = () =>
    fetch(`${API_BASE}${url}`, {
      ...options,
      headers: buildHeaders(),
      credentials: 'include',
    });

  let res = await doFetch();
  const canRefresh =
    !options?.skipAuthRefresh &&
    res.status === 401 &&
    !url.startsWith('/auth/refresh') &&
    !url.startsWith('/auth/login') &&
    !url.startsWith('/org/branding');
  if (canRefresh) {
    const ok = await tryRefreshAccessToken();
    if (ok) res = await doFetch();
  }
  if (!res.ok) {
    const reqId = res.headers.get('X-Request-ID') || res.headers.get('x-request-id') || '';
    const bodyText = await res.text();
    let err = bodyText;
    try {
      const j = JSON.parse(bodyText) as { message?: unknown; detail?: unknown };
      if (j.message !== undefined && typeof j.message === 'string') {
        err = j.message;
      } else if (j.detail !== undefined) {
        if (typeof j.detail === 'string') {
          err = j.detail;
        } else if (res.status === 422) {
          const v = formatFastApiValidationDetail(j.detail);
          err = v || JSON.stringify(j.detail);
        } else {
          err = JSON.stringify(j.detail);
        }
      }
    } catch {
      /* keep body as err */
    }

    if (
      res.status === 401 &&
      typeof window !== 'undefined' &&
      unauthorizedHandler &&
      !url.startsWith('/auth/login') &&
      !url.startsWith('/auth/refresh') &&
      !url.startsWith('/auth/csrf') &&
      !url.startsWith('/auth/logout') &&
      !url.startsWith('/org/branding')
    ) {
      try {
        unauthorizedHandler();
      } catch {
        /* noop */
      }
    }

    if (typeof window !== 'undefined' && apiErrorNotifier) {
      if (res.status === 403) {
        apiErrorNotifier(err && err.length < 240 ? err : 'Нет доступа');
      } else if (res.status === 422) {
        apiErrorNotifier(err || 'Ошибка валидации');
      } else if (res.status === 409) {
        let msg409 =
          'Данные уже изменены (другая вкладка или пользователь). Обновите страницу и повторите.';
        try {
          const j409 = JSON.parse(bodyText) as { detail?: unknown };
          const d = j409.detail;
          if (d && typeof d === 'object' && d !== null && 'message' in d) {
            const m = (d as { message?: unknown }).message;
            if (typeof m === 'string' && m.trim()) msg409 = m;
          }
        } catch {
          /* оставляем msg409 по умолчанию */
        }
        apiErrorNotifier(msg409);
      } else if (res.status >= 500) {
        apiErrorNotifier(
          reqId ? `Сервер временно недоступен (requestId: ${reqId})` : 'Сервер временно недоступен',
        );
      }
    }

    if (res.status >= 500 && reqId) {
      err = `${err || 'HTTP error'} [requestId: ${reqId}]`;
    }
    throw new Error(err || `HTTP ${res.status}`);
  }
  const text = await res.text();
  let parsed: T;
  try {
    parsed = text ? (JSON.parse(text) as T) : ({} as T);
  } catch {
    throw new Error('Invalid JSON response');
  }
  return parsed;
}

/** GET с cookie-сессией (бинарные ответы, например медиа из личного Telegram). */
export async function fetchAuthenticatedBlob(path: string): Promise<Blob> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'GET',
    headers: { ...getAuthHeaders() },
    credentials: 'include',
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || `HTTP ${res.status}`);
  }
  return res.blob();
}

async function get<T>(path: string): Promise<T> {
  return fetchJson<T>(path, { method: 'GET' });
}

async function put<T>(path: string, body: unknown, init?: Omit<FetchJsonOpts, 'method' | 'body'>): Promise<T> {
  return fetchJson<T>(path, { method: 'PUT', body: JSON.stringify(body), ...init });
}

async function post<T>(path: string, body?: unknown, init?: Omit<FetchJsonOpts, 'method' | 'body'>): Promise<T> {
  const serialized = body === undefined || body === null ? undefined : JSON.stringify(body);
  return fetchJson<T>(path, { method: 'POST', body: serialized, ...init });
}

async function patch<T>(path: string, body: unknown, init?: Omit<FetchJsonOpts, 'method' | 'body'>): Promise<T> {
  return fetchJson<T>(path, { method: 'PATCH', body: JSON.stringify(body), ...init });
}

async function del<T>(path: string, init?: Omit<FetchJsonOpts, 'method' | 'body'>): Promise<T> {
  return fetchJson<T>(path, { method: 'DELETE', ...init });
}

/** Публичный GET + PATCH с admin.system (CSRF на PATCH). */
export type OrgBrandingApiDto = {
  primaryColor: string;
  logoSvgLight: string | null;
  logoSvgDark: string | null;
};

export const orgEndpoint = {
  getBranding: () => get<OrgBrandingApiDto>('/org/branding'),
  patchBranding: (body: {
    primaryColor?: string | null;
    logoSvgLight?: string | null;
    logoSvgDark?: string | null;
    /** @deprecated используйте logoSvgLight */
    logoSvg?: string | null;
  }) => patch<OrgBrandingApiDto>('/org/branding', body),
};

// Системные логи: GET /admin/logs — JWT (cookie) + RBAC admin.system (не путать с публичным /health)
export const systemEndpoint = {
  getLogs: (params?: { limit?: number; level?: string }) => {
    const sp = new URLSearchParams();
    if (params?.limit != null) sp.set('limit', String(params.limit));
    if (params?.level) sp.set('level', params.level);
    const q = sp.toString();
    return get<Array<{ id: number; created_at: string; level: string; message: string; logger_name?: string; path?: string; request_id?: string; payload?: string }>>(`/admin/logs${q ? `?${q}` : ''}`);
  },
};

// Admin: JWT + RBAC (в т.ч. admin.system для логов/БД/тестов)
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
    post<{ ok: boolean; queued: number }>(
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
      recipient?: string | null;
      attempts: number;
      last_error?: string;
      notification_title?: string;
      user_id?: string;
    }>>(`/admin/notifications/failed-deliveries?limit=${encodeURIComponent(String(limit))}${channel ? `&channel=${encodeURIComponent(channel)}` : ''}${query ? `&q=${encodeURIComponent(query)}` : ''}`),
  requeueFailedDeliveries: (limit = 200) =>
    post<{ ok: boolean; requeued: number }>(`/admin/notifications/requeue-failed?limit=${encodeURIComponent(String(limit))}`),
  requeueFailedDeliveryById: (deliveryId: string) =>
    post<{ ok: boolean; requeued: number }>(`/admin/notifications/requeue-failed/${encodeURIComponent(deliveryId)}`),
  getDlqRows: (params?: { limit?: number; unresolvedOnly?: boolean }) => {
    const sp = new URLSearchParams();
    if (params?.limit != null) sp.set('limit', String(params.limit));
    if (params?.unresolvedOnly === false) sp.set('unresolved_only', 'false');
    const q = sp.toString();
    return get<
      Array<{
        id: string;
        queue_name: string;
        payload: Record<string, unknown>;
        error?: string | null;
        created_at: string;
        resolved: boolean;
      }>
    >(`/admin/dlq/rows${q ? `?${q}` : ''}`);
  },
  resolveDlqRow: (id: string) =>
    post<{ ok: boolean; message?: string | null }>(`/admin/dlq/${encodeURIComponent(id)}/resolve`),
  requeueDlqRow: (id: string) =>
    post<{ ok: boolean; message?: string | null }>(`/admin/dlq/${encodeURIComponent(id)}/requeue`),
};

// Auth / Users
export const authEndpoint = {
  getAll: () => get<unknown[]>('/auth/users'),
  updateAll: (users: unknown[]) => put<{ ok: boolean }>('/auth/users', users),
  /** Токены только в HttpOnly cookies; в JSON приходит только `user`. */
  login: (login: string, password: string) =>
    post<{ user: unknown }>('/auth/login', { login, password }, { skipAuthRefresh: true }),
  logout: () => post<{ ok: boolean }>('/auth/logout', {}, { skipAuthRefresh: true }),
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

type TaskListPage = {
  items: Record<string, unknown>[];
  total: number;
  limit: number;
  next_cursor?: string | null;
};

const TASK_PAGE_LIMIT = 500;
const TASK_BATCH_MAX = 100;

/** API TaskBatchItem: start_date/end_date — max 10 (YYYY-MM-DD). Иначе Pydantic → 422. */
function toBatchDate10(v: string | undefined | null): string | undefined {
  if (v == null) return undefined;
  const s = String(v).trim();
  if (!s) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s.slice(0, 10);
  const ms = Date.parse(s);
  if (!Number.isNaN(ms)) return new Date(ms).toISOString().slice(0, 10);
  return s.length >= 10 ? s.slice(0, 10) : undefined;
}

/** Колонка entity_type в БД — VARCHAR(30). */
function toEntityType30(v: string | undefined | null): string | undefined {
  if (v == null) return undefined;
  const s = String(v).trim();
  if (!s) return undefined;
  return s.length > 30 ? s.slice(0, 30) : s;
}

function mapTaskCommentFromApi(c: Record<string, unknown>): TaskComment {
  return {
    id: String(c.id ?? ''),
    taskId: String(c.task_id ?? c.taskId ?? ''),
    userId: String(c.user_id ?? c.userId ?? ''),
    text: String(c.text ?? ''),
    createdAt: String(c.created_at ?? c.createdAt ?? ''),
    isSystem: Boolean(c.is_system ?? c.isSystem),
    attachmentId: (c.attachment_id ?? c.attachmentId) as string | undefined,
  };
}

function mapTaskAttachmentFromApi(a: Record<string, unknown>): TaskAttachment {
  return {
    id: String(a.id ?? ''),
    taskId: String(a.task_id ?? a.taskId ?? ''),
    name: String(a.name ?? ''),
    url: String(a.url ?? ''),
    type: String(a.mime_type ?? a.type ?? ''),
    uploadedAt: String(a.uploaded_at ?? a.uploadedAt ?? ''),
    docId: (a.doc_id ?? a.docId) as string | undefined,
    attachmentType: (a.attachment_type ?? a.attachmentType) as 'file' | 'doc' | undefined,
    storagePath: (a.storage_path ?? a.storagePath) as string | undefined,
  };
}

function taskFromApi(r: Record<string, unknown>): Task {
  const assigneeObj = r.assignee as { id?: string } | null | undefined;
  const end = (r.end_date as string | undefined) || (r.due_date as string | undefined) || '';
  const start = (r.start_date as string | undefined) || '';
  const amt = r.amount;
  return {
    id: String(r.id ?? ''),
    entityType: (r.entity_type as EntityType) || 'task',
    tableId: String(r.table_id ?? ''),
    title: String(r.title ?? ''),
    status: String(r.status ?? ''),
    priority: String(r.priority ?? ''),
    assigneeId: (r.assignee_id as string | null | undefined) ?? assigneeObj?.id ?? null,
    assigneeIds: Array.isArray(r.assignee_ids) ? (r.assignee_ids as string[]) : undefined,
    projectId: (r.project_id as string | null | undefined) ?? null,
    startDate: start || end,
    endDate: end || start,
    description: r.description as string | undefined,
    isArchived: Boolean(r.is_archived),
    comments: Array.isArray(r.comments)
      ? (r.comments as Record<string, unknown>[]).map(mapTaskCommentFromApi)
      : [],
    attachments: Array.isArray(r.attachments)
      ? (r.attachments as Record<string, unknown>[]).map(mapTaskAttachmentFromApi)
      : [],
    contentPostId: r.content_post_id as string | undefined,
    processId: r.process_id as string | undefined,
    processInstanceId: r.process_instance_id as string | undefined,
    stepId: r.step_id as string | undefined,
    dealId: r.deal_id as string | undefined,
    source: r.source as string | undefined,
    category: r.category as string | undefined,
    taskId: r.task_id as string | undefined,
    parentTaskId: undefined,
    createdByUserId: r.created_by_user_id as string | undefined,
    createdAt: r.created_at as string | undefined,
    requesterId: r.requester_id as string | undefined,
    departmentId: r.department_id as string | undefined,
    categoryId: r.category_id as string | undefined,
    amount: amt != null && amt !== '' ? Number(amt) : undefined,
    decisionDate: r.decision_date as string | undefined,
    updatedAt: (r.updated_at as string | undefined) ?? undefined,
    version:
      typeof r.version === 'number'
        ? r.version
        : r.version != null && r.version !== ''
          ? Number(r.version) || undefined
          : undefined,
    linkedFeatureId: undefined,
    linkedIdeaId: undefined,
  };
}

function taskToBatchItem(t: Task): Record<string, unknown> {
  const decision =
    t.decisionDate != null && String(t.decisionDate).trim() !== ''
      ? String(t.decisionDate).trim().slice(0, 50)
      : undefined;
  const createdAt =
    t.createdAt != null && String(t.createdAt).trim() !== ''
      ? String(t.createdAt).trim().slice(0, 50)
      : undefined;
  return {
    id: t.id,
    table_id: t.tableId,
    entity_type: toEntityType30(t.entityType),
    title: t.title,
    status: t.status,
    priority: t.priority,
    assignee_id: t.assigneeId,
    assignee_ids: t.assigneeIds,
    project_id: t.projectId,
    start_date: toBatchDate10(t.startDate),
    end_date: toBatchDate10(t.endDate),
    description: t.description,
    is_archived: t.isArchived,
    comments: t.comments,
    attachments: t.attachments,
    content_post_id: t.contentPostId,
    process_id: t.processId,
    process_instance_id: t.processInstanceId,
    step_id: t.stepId,
    deal_id: t.dealId,
    source: t.source,
    category: t.category,
    task_id: t.taskId,
    created_by_user_id: t.createdByUserId,
    created_at: createdAt,
    requester_id: t.requesterId,
    department_id: t.departmentId,
    category_id: t.categoryId,
    amount: t.amount != null && !Number.isNaN(t.amount) ? String(t.amount) : undefined,
    decision_date: decision,
  };
}

// Tasks (REST: GET пагинация, PUT /tasks/batch — snake_case)
export const tasksEndpoint = {
  getAll: async (): Promise<Task[]> => {
    const all: Task[] = [];
    let cursor: string | undefined;
    while (true) {
      const sp = new URLSearchParams();
      sp.set('limit', String(TASK_PAGE_LIMIT));
      if (cursor) sp.set('cursor', cursor);
      const page = await get<TaskListPage>(`/tasks?${sp.toString()}`);
      for (const row of page.items) {
        all.push(taskFromApi(row));
      }
      const next = page.next_cursor;
      if (!next || page.items.length < TASK_PAGE_LIMIT) break;
      cursor = next;
    }
    return all;
  },
  updateAll: async (tasks: Task[]) => {
    for (let i = 0; i < tasks.length; i += TASK_BATCH_MAX) {
      const chunk = tasks.slice(i, i + TASK_BATCH_MAX).map(taskToBatchItem);
      await put<{ ok: boolean; updated: number }>('/tasks/batch', chunk);
    }
    return { ok: true as const };
  },
  patch: (id: string, body: Record<string, unknown>) =>
    patch<Record<string, unknown>>(`/tasks/${encodeURIComponent(id)}`, body),
  remove: (id: string) => del<{ ok: boolean }>(`/tasks/${encodeURIComponent(id)}`),
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

/** Ответ GET /messages (пагинация) */
export type MessagesListResponse = {
  items: unknown[];
  total: number;
  limit: number;
  next_cursor?: string | null;
};

function _messagesListParams(
  folder: 'inbox' | 'outbox',
  userId: string,
  opts?: {
    dealId?: string;
    limit?: number;
    cursor?: string;
    order?: 'asc' | 'desc';
  }
): string {
  const sp = new URLSearchParams({
    folder,
    user_id: userId,
    limit: String(opts?.limit ?? 500),
    order: opts?.order ?? 'desc',
  });
  if (opts?.dealId) sp.set('deal_id', opts.dealId);
  if (opts?.cursor) sp.set('cursor', opts.cursor);
  return sp.toString();
}

function _unwrapMessagesList(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object' && Array.isArray((data as MessagesListResponse).items)) {
    return (data as MessagesListResponse).items;
  }
  return [];
}

// Messages (inbox/outbox)
export const messagesEndpoint = {
  /** Полный ответ с total/limit/next_cursor */
  list: (opts: {
    folder: 'inbox' | 'outbox';
    userId: string;
    dealId?: string;
    limit?: number;
    cursor?: string;
    order?: 'asc' | 'desc';
  }) =>
    get<MessagesListResponse>(`/messages?${_messagesListParams(opts.folder, opts.userId, opts)}`),

  getInbox: (userId: string, opts?: { dealId?: string; limit?: number; cursor?: string; order?: 'asc' | 'desc' }) =>
    get<MessagesListResponse | unknown[]>(`/messages?${_messagesListParams('inbox', userId, opts)}`).then(_unwrapMessagesList),

  getOutbox: (userId: string, opts?: { dealId?: string; limit?: number; cursor?: string; order?: 'asc' | 'desc' }) =>
    get<MessagesListResponse | unknown[]>(`/messages?${_messagesListParams('outbox', userId, opts)}`).then(_unwrapMessagesList),

  add: (body: {
    id?: string;
    createdAt?: string;
    senderId: string;
    recipientId?: string | null;
    text: string;
    attachments?: unknown[];
    dealId?: string;
    funnelId?: string;
    channel?: string;
    direction?: string;
    body?: string;
    externalMsgId?: string;
    mediaUrl?: string;
  }) => post<{ ok: boolean; id: string; deduplicated?: boolean }>('/messages', body),
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
    post<{ ok: boolean; queued: number }>(
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
  list: (params?: {
    search?: string;
    limit?: number;
    cursor?: string;
    is_archived?: boolean;
    sort?: string;
    order?: string;
  }) => {
    const sp = new URLSearchParams();
    const limit = params?.limit ?? 50;
    sp.set('limit', String(limit));
    if (params?.cursor) sp.set('cursor', params.cursor);
    if (params?.search != null && params.search !== '') sp.set('search', params.search);
    if (params?.is_archived === true) sp.set('is_archived', 'true');
    if (params?.is_archived === false) sp.set('is_archived', 'false');
    if (params?.sort) sp.set('sort', params.sort);
    if (params?.order) sp.set('order', params.order);
    return get<ClientListPage>(`/clients?${sp.toString()}`);
  },
  getAll: async (): Promise<Client[]> => {
    const out: Client[] = [];
    let cursor: string | undefined;
    while (true) {
      const sp = new URLSearchParams();
      sp.set('limit', String(CLIENT_PAGE_LIMIT));
      if (cursor) sp.set('cursor', cursor);
      const page = await get<ClientListPage>(`/clients?${sp.toString()}`);
      const items = page.items ?? [];
      for (const row of items) {
        out.push(clientFromApi(row as Record<string, unknown>));
      }
      const next = page.next_cursor;
      if (!next || items.length < CLIENT_PAGE_LIMIT) break;
      cursor = next;
    }
    return out;
  },
  getById: (id: string) =>
    get<Record<string, unknown>>(`/clients/${encodeURIComponent(id)}`).then((r) => clientFromApi(r)),
  create: (c: Client) =>
    post<Record<string, unknown>>('/clients', clientToApiWrite(c)).then((r) => clientFromApi(r)),
  patch: (id: string, partial: Partial<Client>) => {
    const body: Record<string, unknown> = {};
    if (partial.name !== undefined) body.name = partial.name;
    if (partial.phone !== undefined) body.phone = partial.phone?.trim() ? partial.phone : null;
    if (partial.email !== undefined) body.email = partial.email?.trim() ? partial.email : null;
    if (partial.telegram !== undefined) body.telegram = partial.telegram?.trim() ? partial.telegram : null;
    if (partial.instagram !== undefined) body.instagram = partial.instagram?.trim() ? partial.instagram : null;
    if (partial.companyName !== undefined)
      body.companyName = partial.companyName?.trim() ? partial.companyName : null;
    if (partial.notes !== undefined) body.notes = partial.notes ?? null;
    if (partial.tags !== undefined) body.tags = partial.tags ?? [];
    if (partial.isArchived !== undefined) body.isArchived = partial.isArchived;
    return patch<Record<string, unknown>>(`/clients/${encodeURIComponent(id)}`, body).then((r) =>
      clientFromApi(r)
    );
  },
  updateAll: (clients: unknown[]) => put<{ ok: boolean }>('/clients', clients),
};

function crmContactFromApi(r: Record<string, unknown>): CrmContact {
  const tagsRaw = r.tags;
  return {
    id: String(r.id ?? ''),
    version:
      typeof r.version === 'number'
        ? r.version
        : r.version != null && r.version !== ''
          ? Number(r.version) || undefined
          : undefined,
    clientId: (r.client_id as string | null | undefined) ?? undefined,
    name: String(r.name ?? ''),
    phone: (r.phone as string | null | undefined) ?? undefined,
    email: (r.email as string | null | undefined) ?? undefined,
    telegram: (r.telegram as string | null | undefined) ?? undefined,
    instagram: (r.instagram as string | null | undefined) ?? undefined,
    jobTitle: (r.job_title as string | null | undefined) ?? undefined,
    notes: (r.notes as string | null | undefined) ?? undefined,
    tags: Array.isArray(tagsRaw) ? (tagsRaw as unknown[]).map((x) => String(x)) : undefined,
    isArchived: Boolean(r.is_archived),
  };
}

/** CRM-контакты компаний (лица); список с фильтром по client_id. */
export const crmContactsEndpoint = {
  list: async (opts?: { clientId?: string; limit?: number }): Promise<CrmContact[]> => {
    const sp = new URLSearchParams();
    sp.set('limit', String(Math.min(opts?.limit ?? 200, 500)));
    if (opts?.clientId) sp.set('client_id', opts.clientId);
    const res = await get<{ items: Record<string, unknown>[] }>(`/contacts?${sp.toString()}`);
    return (res.items ?? []).map((row) => crmContactFromApi(row));
  },
  create: (body: {
    name: string;
    clientId?: string;
    phone?: string;
    email?: string;
    telegram?: string;
    instagram?: string;
    jobTitle?: string;
    notes?: string;
    tags?: string[];
  }) =>
    post<Record<string, unknown>>('/contacts', {
      name: body.name,
      clientId: body.clientId,
      phone: body.phone,
      email: body.email,
      telegram: body.telegram,
      instagram: body.instagram,
      jobTitle: body.jobTitle,
      notes: body.notes,
      tags: body.tags,
    }).then((r) => crmContactFromApi(r as Record<string, unknown>)),
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

type DealListPage = {
  items: Record<string, unknown>[];
  total: number;
  limit: number;
  next_cursor?: string | null;
};

export type ClientListPage = {
  items: Record<string, unknown>[];
  total: number;
  limit: number;
  next_cursor?: string | null;
};

const CLIENT_PAGE_LIMIT = 500;

/** Ответ GET /clients (snake_case) → Client для UI. */
export function clientFromApi(r: Record<string, unknown>): Client {
  const tagsRaw = r.tags;
  return {
    id: String(r.id ?? ''),
    name: String(r.name ?? ''),
    phone: (r.phone as string | undefined) ?? undefined,
    email: (r.email as string | undefined) ?? undefined,
    telegram: (r.telegram as string | undefined) ?? undefined,
    instagram: (r.instagram as string | undefined) ?? undefined,
    companyName: (r.company_name as string | undefined) ?? undefined,
    notes: (r.notes as string | undefined) ?? undefined,
    tags: Array.isArray(tagsRaw) ? (tagsRaw as unknown[]).map(String) : [],
    isArchived: Boolean(r.is_archived),
    updatedAt: (r.updated_at as string | undefined) ?? undefined,
    version:
      typeof r.version === 'number'
        ? r.version
        : r.version != null && r.version !== ''
          ? Number(r.version) || undefined
          : undefined,
  };
}

function clientToApiWrite(c: Client): Record<string, unknown> {
  return {
    id: c.id || undefined,
    name: c.name,
    phone: c.phone ?? null,
    email: c.email ?? null,
    telegram: c.telegram ?? null,
    instagram: c.instagram ?? null,
    companyName: c.companyName ?? null,
    notes: c.notes ?? null,
    tags: c.tags ?? [],
    isArchived: c.isArchived ?? false,
  };
}

const DEAL_PAGE_LIMIT = 500;

const DEAL_ATTACHMENTS_KEY = '_deal_attachments';

function parseDealAttachment(raw: unknown, dealId: string): DealAttachment | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const id = String(o.id ?? '');
  if (!id) return null;
  return {
    id,
    dealId: String(o.dealId ?? o.deal_id ?? dealId),
    name: String(o.name ?? 'file'),
    url: String(o.url ?? ''),
    type: String(o.type ?? 'file'),
    uploadedAt: String(o.uploadedAt ?? o.uploaded_at ?? new Date().toISOString()),
    attachmentType: (o.attachmentType ?? o.attachment_type) as DealAttachment['attachmentType'],
    storagePath: (o.storagePath ?? o.storage_path) as string | undefined,
    docId: (o.docId ?? o.doc_id) as string | undefined,
  };
}

/**
 * Тело элемента для PUT /deals (DealBulkItem): без вложенного `client` и лишних полей,
 * вложения сделки — в customFields._deal_attachments.
 */
export function dealToBulkPutItem(d: Deal): Record<string, unknown> {
  const dealId = String(d.id ?? '');
  const rawCf = d.customFields && typeof d.customFields === 'object' ? { ...d.customFields } : {};
  delete rawCf[DEAL_ATTACHMENTS_KEY];
  const cf: Record<string, unknown> = { ...rawCf };
  cf[DEAL_ATTACHMENTS_KEY] = Array.isArray(d.attachments) ? d.attachments : [];

  return {
    id: dealId,
    title: d.title ?? '',
    clientId: d.clientId ?? null,
    contactId: d.contactId ?? null,
    contactName: d.contactName ?? null,
    amount: d.amount ?? 0,
    currency: d.currency ?? 'UZS',
    stage: d.stage ?? 'new',
    funnelId: d.funnelId ?? null,
    source: d.source ?? null,
    sourceChatId: d.telegramChatId ?? null,
    telegramChatId: d.telegramChatId ?? null,
    tags: d.tags ?? null,
    customFields: cf,
    telegramUsername: d.telegramUsername ?? null,
    lostReason: d.lostReason ?? null,
    assigneeId: d.assigneeId ?? null,
    notes: d.notes ?? null,
    projectId: d.projectId ?? null,
    comments: d.comments ?? [],
    isArchived: d.isArchived ?? false,
    recurring: d.recurring ?? false,
    number: d.number ?? null,
    status: d.status ?? null,
    description: d.description ?? null,
    date: d.date ?? null,
    dueDate: d.dueDate ?? null,
    paidAmount: d.paidAmount ?? null,
    paidDate: d.paidDate ?? null,
    startDate: d.startDate ?? null,
    endDate: d.endDate ?? null,
    paymentDay: d.paymentDay ?? null,
    createdAt: d.createdAt ?? null,
    updatedAt: d.updatedAt ?? null,
  };
}

/** Тело POST /deals (DealCreate, camelCase нормализуется на бэкенде). */
export function dealToApiCreate(d: Deal, createdByUserId?: string | null): Record<string, unknown> {
  const b = dealToBulkPutItem(d);
  const out: Record<string, unknown> = {
    id: b.id || undefined,
    title: (b.title as string) || 'Новая сделка',
    clientId: b.clientId,
    contactId: b.contactId,
    contactName: b.contactName,
    amount: b.amount,
    currency: b.currency,
    stage: b.stage,
    funnelId: b.funnelId,
    source: b.source,
    sourceChatId: b.sourceChatId,
    tags: b.tags,
    customFields: b.customFields,
    lostReason: b.lostReason,
    assigneeId: b.assigneeId,
    notes: b.notes,
    projectId: b.projectId,
    comments: b.comments,
    createdAt: b.createdAt,
    telegramUsername: b.telegramUsername,
  };
  if (createdByUserId) out.createdByUserId = createdByUserId;
  return out;
}

/** Тело PATCH /deals/{id} (DealUpdate). */
export function dealToApiPatch(d: Deal, updatedByUserId?: string | null): Record<string, unknown> {
  const b = dealToBulkPutItem(d);
  const out: Record<string, unknown> = {
    title: b.title,
    clientId: b.clientId,
    contactId: b.contactId,
    contactName: b.contactName,
    amount: b.amount,
    currency: b.currency,
    stage: b.stage,
    funnelId: b.funnelId,
    source: b.source,
    sourceChatId: b.sourceChatId,
    tags: b.tags,
    customFields: b.customFields,
    lostReason: b.lostReason,
    assigneeId: b.assigneeId,
    notes: b.notes,
    projectId: b.projectId,
    comments: b.comments,
    isArchived: b.isArchived,
    recurring: b.recurring,
    number: b.number,
    status: b.status,
    description: b.description,
    date: b.date,
    dueDate: b.dueDate,
    paidAmount: b.paidAmount,
    paidDate: b.paidDate,
    startDate: b.startDate,
    endDate: b.endDate,
    paymentDay: b.paymentDay,
    telegramUsername: b.telegramUsername,
  };
  if (d.version != null && Number.isFinite(Number(d.version))) {
    out.version = Number(d.version);
  }
  if (updatedByUserId) out.updatedByUserId = updatedByUserId;
  return out;
}

/** Ответ GET /deals (snake_case) → тип Deal (camelCase) для UI. */
export function dealFromApi(r: Record<string, unknown>): Deal {
  const amt = r.amount;
  const dealId = String(r.id ?? '');
  const cfRaw = r.custom_fields;
  const cfFull =
    cfRaw && typeof cfRaw === 'object' && !Array.isArray(cfRaw) ? { ...(cfRaw as Record<string, unknown>) } : {};
  const rawAtt = cfFull[DEAL_ATTACHMENTS_KEY];
  const attachments: DealAttachment[] = Array.isArray(rawAtt)
    ? (rawAtt.map((x) => parseDealAttachment(x, dealId)).filter(Boolean) as DealAttachment[])
    : [];
  delete cfFull[DEAL_ATTACHMENTS_KEY];
  const tagsRaw = r.tags;
  return {
    id: dealId,
    title: (r.title as string | undefined) ?? '',
    stage: r.stage as string | undefined,
    assigneeId: (r.assignee_id as string | null | undefined) ?? undefined,
    contactName: (r.contact_name as string | undefined) ?? undefined,
    source: r.source as Deal['source'],
    telegramChatId:
      (r.telegram_chat_id as string | undefined) ?? (r.source_chat_id as string | undefined) ?? undefined,
    telegramUsername: (r.telegram_username as string | undefined) ?? undefined,
    projectId: (r.project_id as string | undefined) ?? undefined,
    comments: (r.comments as Deal['comments']) ?? [],
    clientId: (r.client_id as string | undefined) ?? undefined,
    contactId: (r.contact_id as string | undefined) ?? undefined,
    client:
      r.client && typeof r.client === 'object'
        ? clientFromApi(r.client as Record<string, unknown>)
        : undefined,
    recurring: Boolean(r.recurring),
    number: r.number as string | undefined,
    status: r.status as Deal['status'],
    description: r.description as string | undefined,
    amount: amt != null && amt !== '' ? Number(amt) : 0,
    currency: String(r.currency ?? 'UZS'),
    funnelId: (r.funnel_id as string | undefined) ?? undefined,
    notes: r.notes as string | undefined,
    isArchived: Boolean(r.is_archived),
    createdAt: r.created_at as string | undefined,
    updatedAt: r.updated_at as string | undefined,
    date: r.date as string | undefined,
    dueDate: r.due_date as string | undefined,
    paidAmount:
      r.paid_amount != null && r.paid_amount !== ''
        ? typeof r.paid_amount === 'number'
          ? r.paid_amount
          : Number(r.paid_amount)
        : undefined,
    paidDate: r.paid_date as string | undefined,
    startDate: r.start_date as string | undefined,
    endDate: r.end_date as string | undefined,
    paymentDay:
      r.payment_day != null && r.payment_day !== ''
        ? typeof r.payment_day === 'number'
          ? r.payment_day
          : Number(r.payment_day)
        : undefined,
    version:
      typeof r.version === 'number'
        ? r.version
        : r.version != null && r.version !== ''
          ? Number(r.version) || undefined
          : undefined,
    tags: Array.isArray(tagsRaw) ? (tagsRaw as unknown[]).map((x) => String(x)) : undefined,
    lostReason: (r.lost_reason as string | undefined) ?? undefined,
    customFields: Object.keys(cfFull).length > 0 ? cfFull : undefined,
    attachments: attachments.length > 0 ? attachments : undefined,
  };
}

async function fetchAllDealsPages(): Promise<Deal[]> {
  const all: Deal[] = [];
  let cursor: string | undefined;
  while (true) {
    const sp = new URLSearchParams();
    sp.set('limit', String(DEAL_PAGE_LIMIT));
    if (cursor) sp.set('cursor', cursor);
    const page = await get<DealListPage>(`/deals?${sp.toString()}`);
    for (const row of page.items) {
      all.push(dealFromApi(row));
    }
    const next = page.next_cursor;
    if (!next || page.items.length < DEAL_PAGE_LIMIT) break;
    cursor = next;
  }
  return all;
}

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

// CRM deals only (GET — пагинация + snake_case, см. dealFromApi)
export const dealsEndpoint = {
  getAll: async () => {
    const all = await fetchAllDealsPages();
    return all.filter((d) => !isContractLikeDeal(d));
  },
  updateAll: async (deals: unknown[]) => {
    const all = await fetchAllDealsPages();
    const preserved = all.filter((d) => isContractLikeDeal(d));
    const payload = (deals as Deal[]).map((d) => dealToBulkPutItem(d));
    const preservedPayload = preserved.map((d) => dealToBulkPutItem(d));
    return put<{ ok: boolean }>('/deals', mergeById(preservedPayload, payload));
  },
  create: (deal: unknown) => post<unknown>('/deals', deal),
  update: (id: string, updates: unknown) => patch<unknown>(`/deals/${id}`, updates),
  getById: async (id: string): Promise<Deal> =>
    dealFromApi(await get<Record<string, unknown>>(`/deals/${encodeURIComponent(id)}`)),
  delete: (id: string) => del<{ ok: boolean }>(`/deals/${id}`),
  /** Presigned GET S3 для вложения сделки (ключ из comment.attachments[].storageKey). */
  getMediaSignedUrl: (dealId: string, storageKey: string) =>
    get<{ url: string; expiresIn: number }>(
      `/deals/${encodeURIComponent(dealId)}/media/signed?${new URLSearchParams({ key: storageKey }).toString()}`
    ),
};

export const integrationsMetaEndpoint = {
  sendInstagram: (body: { dealId: string; text: string }) =>
    post<unknown>('/integrations/meta/instagram/send', body),
};

export const integrationsRoadmapEndpoint = {
  get: () => get<IntegrationsRoadmapResponse>('/integrations/roadmap'),
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
  /** POST 202 → очередь queue.integrations; ждём обновления сделки по GET /deals/:id (без Telethon в HTTP). */
  syncMessages: async (dealId: string, body?: { limit?: number }): Promise<Deal> => {
    const path = `/integrations/telegram-personal/deals/${encodeURIComponent(dealId)}/sync-messages`;
    const res = await post<{ ok?: boolean; queued?: boolean; dealId?: string }>(path, body ?? {});
    if (!res.queued || res.dealId !== dealId) {
      return res as unknown as Deal;
    }
    const snapshot = (d: Deal) =>
      `${(d.comments || []).length}\0${d.updatedAt ?? ''}\0${
        d.comments && d.comments.length > 0 ? (d.comments[d.comments.length - 1]?.id ?? '') : ''
      }`;
    const baseline = await dealsEndpoint.getById(dealId);
    const s0 = snapshot(baseline);
    for (let i = 0; i < 30; i += 1) {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 800);
      });
      const d = await dealsEndpoint.getById(dealId);
      if (snapshot(d) !== s0) {
        return d;
      }
    }
    return dealsEndpoint.getById(dealId);
  },
  sendDeal: (dealId: string, body: { text: string }) =>
    post<unknown>(`/integrations/telegram-personal/deals/${encodeURIComponent(dealId)}/send`, body),
  fetchDealMediaBlob: (dealId: string, messageId: number) =>
    fetchAuthenticatedBlob(
      `/integrations/telegram-personal/deals/${encodeURIComponent(dealId)}/media/${messageId}`
    ),
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
    const all = await fetchAllDealsPages();
    return all.filter((d) => isContractLikeDeal(d) && isRecurringContract(d));
  },
  updateAll: async (contracts: unknown[]) => {
    const all = await fetchAllDealsPages();
    const preserved = all.filter((d) => !isRecurringContract(d));
    const payload = (contracts as Deal[]).map((d) => dealToBulkPutItem(d));
    const preservedPayload = preserved.map((d) => dealToBulkPutItem(d));
    return put<{ ok: boolean }>('/deals', mergeById(preservedPayload, payload));
  },
};

export const oneTimeDealsEndpoint = {
  getAll: async () => {
    const all = await fetchAllDealsPages();
    return all.filter((d) => isContractLikeDeal(d) && isOneTimeSale(d));
  },
  updateAll: async (sales: unknown[]) => {
    const all = await fetchAllDealsPages();
    const preserved = all.filter((d) => !isOneTimeSale(d));
    const payload = (sales as Deal[]).map((d) => dealToBulkPutItem(d));
    const preservedPayload = preserved.map((d) => dealToBulkPutItem(d));
    return put<{ ok: boolean }>('/deals', mergeById(preservedPayload, payload));
  },
};

// Employees (GET — пагинация items/total; по умолчанию без архива)
export type EmployeeListParams = {
  limit?: number;
  cursor?: string;
  search?: string;
  departmentId?: string;
  status?: string;
  positionId?: string;
  userId?: string;
  /** true — включить архивные карточки (настройки / архив) */
  includeArchived?: boolean;
  sort?: 'fullName' | 'status' | 'id' | 'hireDate';
  order?: 'asc' | 'desc';
};

export type EmployeeListResult = {
  items: unknown[];
  total: number;
  limit: number;
  next_cursor?: string | null;
};

function employeesQueryString(params?: EmployeeListParams): string {
  if (!params) return '';
  const sp = new URLSearchParams();
  const add = (k: string, v: string | number | boolean | undefined | null) => {
    if (v === undefined || v === null || v === '') return;
    sp.set(k, typeof v === 'boolean' ? (v ? 'true' : 'false') : String(v));
  };
  add('limit', params.limit);
  add('cursor', params.cursor);
  add('search', params.search);
  add('departmentId', params.departmentId);
  add('status', params.status);
  add('positionId', params.positionId);
  add('userId', params.userId);
  add('includeArchived', params.includeArchived);
  add('sort', params.sort);
  add('order', params.order);
  const q = sp.toString();
  return q ? `?${q}` : '';
}

export const employeesEndpoint = {
  list: (params?: EmployeeListParams) =>
    get<EmployeeListResult>(`/employees${employeesQueryString(params)}`),
  /** Все записи порциями (по умолчанию только неархивные). */
  getAll: async (opts?: { includeArchived?: boolean; pageSize?: number }) => {
    const pageSize = opts?.pageSize ?? 500;
    const all: unknown[] = [];
    let cursor: string | undefined;
    for (;;) {
      const r = await get<EmployeeListResult>(
        `/employees${employeesQueryString({
          limit: pageSize,
          cursor,
          includeArchived: opts?.includeArchived,
        })}`
      );
      all.push(...r.items);
      const next = r.next_cursor;
      if (!next || r.items.length === 0 || r.items.length < pageSize) break;
      cursor = next;
    }
    return all;
  },
  getOne: (id: string) => get<unknown>(`/employees/${encodeURIComponent(id)}`),
  create: (body: unknown) => post<unknown>('/employees', body),
  update: (id: string, body: unknown) => patch<unknown>(`/employees/${encodeURIComponent(id)}`, body),
  remove: (id: string) => del<Record<string, never>>(`/employees/${encodeURIComponent(id)}`),
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
  ensureExportToken: (body?: { rotate?: boolean; revoke?: boolean }) =>
    post<{ ok: boolean; token: string | null }>('/calendar/export-token', body ?? {}),
};

// Meetings
export const meetingsEndpoint = {
  getAll: () => get<unknown[]>('/meetings'),
  getOne: (id: string) => get<unknown>(`/meetings/${encodeURIComponent(id)}`),
  create: (body: unknown) => post<unknown>('/meetings', body),
  patch: (id: string, body: unknown) => patch<unknown>(`/meetings/${encodeURIComponent(id)}`, body),
  remove: (id: string) => del<{ ok: boolean; id: string }>(`/meetings/${encodeURIComponent(id)}`),
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
  /** Заполняется сервером: справка привязана к проведённому/утверждённому бюджету. */
  lockedByPlanningId?: string | null;
}

/** Ответ GET /finance/requests (пагинация). */
export interface FinanceRequestListResponseApi {
  items: unknown[];
  total: number;
  limit: number;
  next_cursor?: string | null;
}

export type FinanceRequestsListQuery = {
  status?: string;
  category?: string;
  /** YYYY-MM-DD — один календарный день по created_at (UTC). */
  date?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  cursor?: string;
};

function financeRequestsQueryString(q?: FinanceRequestsListQuery): string {
  if (!q) return '';
  const sp = new URLSearchParams();
  if (q.status) sp.set('status', q.status);
  if (q.category) sp.set('category', q.category);
  if (q.date) sp.set('date', q.date);
  if (q.dateFrom) sp.set('dateFrom', q.dateFrom);
  if (q.dateTo) sp.set('dateTo', q.dateTo);
  if (q.limit != null) sp.set('limit', String(q.limit));
  if (q.cursor) sp.set('cursor', q.cursor);
  const s = sp.toString();
  return s ? `?${s}` : '';
}

/** Ответ GET /finance/requests (camelCase / snake_case) → PurchaseRequest. */
export function purchaseRequestFromApi(r: Record<string, unknown>): PurchaseRequest {
  const v = r.version;
  return {
    id: String(r.id ?? ''),
    title: (r.title as string | undefined) ?? undefined,
    amount: r.amount != null ? String(r.amount) : '0',
    currency: (r.currency as string | undefined) ?? 'UZS',
    category: r.category as string | undefined,
    categoryId: (r.category_id ?? r.categoryId) as string | undefined,
    counterparty: (r.counterparty as string | null | undefined) ?? null,
    requestedBy: (r.requested_by ?? r.requestedBy) as string | undefined,
    requesterId: (r.requester_id ?? r.requesterId) as string | undefined,
    approvedBy: (r.approved_by ?? r.approvedBy) as string | null | undefined,
    status: (r.status as PurchaseRequest['status']) ?? 'draft',
    comment: r.comment as string | undefined,
    description: r.description as string | undefined,
    date: r.date as string | undefined,
    paymentDate: (r.payment_date ?? r.paymentDate) as string | undefined,
    paidAt: (r.paid_at ?? r.paidAt) as string | null | undefined,
    decisionDate: (r.decision_date ?? r.decisionDate) as string | undefined,
    departmentId: (r.department_id ?? r.departmentId) as string | undefined,
    budgetApprovedAmount: (r.budget_approved_amount ?? r.budgetApprovedAmount) as string | number | undefined,
    isArchived: Boolean(r.is_archived ?? r.isArchived),
    version:
      typeof v === 'number' ? v : v != null && v !== '' ? Number(v) || undefined : undefined,
    attachments: Array.isArray(r.attachments)
      ? (r.attachments as Record<string, unknown>[]).map((a) => ({
          id: String(a.id ?? ''),
          name: String(a.name ?? ''),
          url: String(a.url ?? ''),
          type: String(a.type ?? ''),
          uploadedAt: (a.uploadedAt ?? a.uploaded_at) as string | undefined,
          storagePath: (a.storagePath ?? a.storage_path) as string | undefined,
        }))
      : [],
    counterpartyInn: (r.counterparty_inn ?? r.counterpartyInn) as string | undefined,
    invoiceNumber: (r.invoice_number ?? r.invoiceNumber) as string | undefined,
    invoiceDate: (r.invoice_date ?? r.invoiceDate) as string | undefined,
  };
}

export const financeEndpoint = {
  getCategories: () => get<unknown[]>('/finance/categories'),
  updateCategories: (categories: unknown[]) => put<{ ok: boolean }>('/finance/categories', categories),
  getPlan: () => get<unknown | null>('/finance/plan'),
  updatePlan: (plan: unknown) => put<{ ok: boolean }>('/finance/plan', plan),
  getRequests: (query?: FinanceRequestsListQuery) =>
    get<FinanceRequestListResponseApi>(`/finance/requests${financeRequestsQueryString(query)}`),
  /** Все заявки: обход страниц (limit 500). */
  getRequestsAll: async (): Promise<PurchaseRequest[]> => {
    const out: PurchaseRequest[] = [];
    const limit = 500;
    let cursor: string | undefined;
    while (true) {
      const sp = new URLSearchParams();
      sp.set('limit', String(limit));
      if (cursor) sp.set('cursor', cursor);
      const page = await get<FinanceRequestListResponseApi>(`/finance/requests?${sp.toString()}`);
      const items = page.items ?? [];
      for (const row of items) {
        if (row && typeof row === 'object') {
          out.push(purchaseRequestFromApi(row as Record<string, unknown>));
        }
      }
      const next = page.next_cursor;
      if (!next || items.length < limit) break;
      cursor = next;
    }
    return out;
  },
  postRequest: (body: Record<string, unknown>) => post<unknown>('/finance/requests', body),
  patchRequest: (id: string, body: Record<string, unknown>) =>
    patch<unknown>(`/finance/requests/${encodeURIComponent(id)}`, body),
  getFinancialPlanDocuments: () => get<unknown[]>('/finance/financial-plan-documents'),
  updateFinancialPlanDocuments: (docs: unknown[]) => put<{ ok: boolean }>('/finance/financial-plan-documents', docs),
  getFinancialPlannings: () => get<unknown[]>('/finance/financial-plannings'),
  updateFinancialPlannings: (plannings: unknown[]) => put<{ ok: boolean }>('/finance/financial-plannings', plannings),
  getBankStatements: () => get<BankStatementApi[]>('/finance/bank-statements'),
  updateBankStatements: (statements: BankStatementApi[]) => put<{ ok: boolean }>('/finance/bank-statements', statements),
  deleteBankStatement: (id: string) => del<{ ok: boolean }>(`/finance/bank-statements/${id}`),
  getExpenseReconciliationGroups: () =>
    get<Array<{ id: string; lineIds: string[]; requestId?: string | null; manualResolved?: boolean; updatedAt?: string }>>(
      '/finance/expense-reconciliation-groups'
    ),
  updateExpenseReconciliationGroups: (groups: unknown[]) =>
    put<{ ok: boolean }>('/finance/expense-reconciliation-groups', groups),
  getIncomeReports: () => get<IncomeReportApi[]>('/finance/income-reports'),
  updateIncomeReports: (reports: IncomeReportApi[]) => put<{ ok: boolean }>('/finance/income-reports', reports),
  getBdr: (year?: string) => get<Bdr>(`/finance/bdr${year ? `?year=${encodeURIComponent(year)}` : ''}`),
  updateBdr: (payload: { year: string; rows: unknown[] }) => put<Bdr>('/finance/bdr', payload),
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

/** Производственные маршруты и заказы по этапам */
export const productionEndpoint = {
  getPipelines: () => get<unknown[]>('/production/pipelines'),
  putPipelines: (items: unknown[]) => put<{ ok: boolean }>('/production/pipelines', items),
  getOrders: (pipelineId?: string) => {
    const q = pipelineId ? `?pipelineId=${encodeURIComponent(pipelineId)}` : '';
    return get<unknown[]>(`/production/orders${q}`);
  },
  createOrder: (body: { pipelineId: string; title: string; notes?: string | null }) =>
    post<unknown>('/production/orders', body),
  patchOrder: (id: string, body: unknown, init?: { headers?: Record<string, string> }) =>
    patch<unknown>(`/production/orders/${encodeURIComponent(id)}`, body, init),
  handOver: (orderId: string, body: { notes?: string | null } = {}) =>
    post<unknown>(`/production/orders/${encodeURIComponent(orderId)}/hand-over`, body),
  completeOrder: (orderId: string) =>
    post<unknown>(`/production/orders/${encodeURIComponent(orderId)}/complete`, {}),
  resolveHandoff: (
    handoffId: string,
    body: { action: 'accept' | 'reject'; hasDefects?: boolean; defectNotes?: string | null }
  ) => post<unknown>(`/production/handoffs/${encodeURIComponent(handoffId)}/resolve`, body),
};

// Public content plan (no auth required)
export const publicContentPlanEndpoint = {
  getByTableId: (tableId: string) =>
    get<{ table: unknown | null; posts: unknown[]; shootPlans?: unknown[] }>(
      `/tables/public/content-plan/${encodeURIComponent(tableId)}`
    ),
};

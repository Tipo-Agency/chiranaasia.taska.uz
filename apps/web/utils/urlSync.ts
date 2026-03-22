/**
 * Синхронизация текущего раздела SPA с адресной строкой (History API).
 * Пути без кириллицы — меньше проблем с кодированием и прокси.
 */

export const VIEW_PATHS: Record<string, string> = {
  home: '/',
  tasks: '/tasks',
  inbox: '/inbox',
  search: '/search',
  clients: '/clients',
  'sales-funnel': '/sales-funnel',
  inventory: '/inventory',
  finance: '/finance',
  'business-processes': '/business-processes',
  meetings: '/meetings',
  docs: '/docs',
  chat: '/chat',
  employees: '/employees',
  analytics: '/analytics',
  spaces: '/spaces',
  settings: '/settings',
  sites: '/sites',
  admin: '/admin',
  table: '/table',
  'doc-editor': '/doc',
};

const PATH_TO_VIEW: Record<string, string> = {
  '/': 'home',
  '/tasks': 'tasks',
  '/inbox': 'inbox',
  '/search': 'search',
  '/clients': 'clients',
  '/sales-funnel': 'sales-funnel',
  '/inventory': 'inventory',
  '/finance': 'finance',
  '/business-processes': 'business-processes',
  '/meetings': 'meetings',
  '/docs': 'docs',
  '/chat': 'chat',
  '/employees': 'employees',
  '/analytics': 'analytics',
  '/spaces': 'spaces',
  '/settings': 'settings',
  '/sites': 'sites',
  '/admin': 'admin',
};

export interface UrlStateSlice {
  view: string;
  activeTableId?: string;
  activeSpaceTab?: 'content-plan' | 'backlog' | 'functionality';
  settingsTab?: string;
}

/** Построить path + search из состояния навигации */
export function buildLocation(opts: {
  currentView: string;
  activeTableId?: string;
  activeSpaceTab?: 'content-plan' | 'backlog' | 'functionality' | undefined;
  settingsActiveTab?: string;
}): string {
  const { currentView, activeTableId, activeSpaceTab, settingsActiveTab } = opts;

  if (currentView === 'table' && activeTableId) {
    return `/table/${encodeURIComponent(activeTableId)}`;
  }

  if (currentView === 'doc-editor') {
    return '/doc';
  }

  if (currentView === 'spaces') {
    const base = VIEW_PATHS.spaces;
    if (activeSpaceTab === 'content-plan' || activeSpaceTab === 'backlog' || activeSpaceTab === 'functionality') {
      return `${base}?space=${encodeURIComponent(activeSpaceTab)}`;
    }
    return base;
  }

  if (currentView === 'settings') {
    const tab = settingsActiveTab || 'users';
    return `${VIEW_PATHS.settings}?tab=${encodeURIComponent(tab)}`;
  }

  const path = VIEW_PATHS[currentView];
  if (path) return path === '/' ? '/' : path;

  return '/';
}

/** Разобрать window.location в состояние для setCurrentView / setActiveTableId */
export function parseLocation(pathname: string, search: string): UrlStateSlice | null {
  const path = pathname.replace(/\/+$/, '') || '/';

  if (path === '/' || path === '') {
    return { view: 'home' };
  }

  const segments = path.split('/').filter(Boolean);

  if (segments[0] === 'table' && segments[1]) {
    return {
      view: 'table',
      activeTableId: decodeURIComponent(segments[1]),
    };
  }

  if (segments[0] === 'doc') {
    return { view: 'doc-editor' };
  }

  const single = `/${segments[0]}`;
  const view = PATH_TO_VIEW[single];
  if (!view) return null;

  const out: UrlStateSlice = { view };

  if (view === 'spaces') {
    const q = new URLSearchParams(search);
    const space = q.get('space');
    if (space === 'content-plan' || space === 'backlog' || space === 'functionality') {
      out.activeSpaceTab = space;
    }
  }

  if (view === 'settings') {
    const q = new URLSearchParams(search);
    out.settingsTab = q.get('tab') || 'users';
  }

  return out;
}

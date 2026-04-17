/**
 * Синхронизация текущего раздела SPA с адресной строкой (History API).
 * Пути без кириллицы — меньше проблем с кодированием и прокси.
 */

import type { CrmHubTab } from '../types/crmHub';

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
  '/payroll': 'payroll',
  '/analytics': 'analytics',
  '/spaces': 'spaces',
  '/settings': 'settings',
  '/admin': 'admin',
};

export interface UrlStateSlice {
  view: string;
  activeTableId?: string;
  activeSpaceTab?: 'content-plan' | 'backlog' | 'functionality';
  settingsTab?: string;
  workdeskTab?: 'dashboard' | 'weekly' | 'tasks' | 'deals' | 'meetings' | 'documents';
  crmHubTab?: CrmHubTab;
  employeesHubTab?: 'team' | 'payroll';
}

/** Построить path + search из состояния навигации */
export function buildLocation(opts: {
  currentView: string;
  activeTableId?: string;
  activeSpaceTab?: 'content-plan' | 'backlog' | 'functionality' | undefined;
  settingsActiveTab?: string;
  workdeskTab?: 'dashboard' | 'weekly' | 'tasks' | 'deals' | 'meetings' | 'documents';
  crmHubTab?: CrmHubTab;
  employeesHubTab?: 'team' | 'payroll';
}): string {
  const {
    currentView,
    activeTableId,
    activeSpaceTab,
    settingsActiveTab,
    workdeskTab,
    crmHubTab,
    employeesHubTab,
  } = opts;

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

  if (currentView === 'home') {
    if (workdeskTab && workdeskTab !== 'dashboard') {
      return `/?desk=${encodeURIComponent(workdeskTab)}`;
    }
    return '/';
  }

  if (currentView === 'sales-funnel') {
    let path = VIEW_PATHS['sales-funnel'];
    if (crmHubTab === 'clients') path += '?crm=clients';
    else if (crmHubTab === 'contracts') path += '?crm=contracts';
    else if (crmHubTab === 'receivables') path += '?crm=receivables';
    return path;
  }

  if (currentView === 'business-processes') {
    return VIEW_PATHS['business-processes'];
  }

  if (currentView === 'employees') {
    let path = VIEW_PATHS.employees;
    if (employeesHubTab === 'payroll') path += '?tab=payroll';
    return path;
  }

  const path = VIEW_PATHS[currentView];
  if (path) return path === '/' ? '/' : path;

  return '/';
}

/** Разобрать window.location в состояние для setCurrentView / setActiveTableId */
export function parseLocation(pathname: string, search: string): UrlStateSlice | null {
  const path = pathname.replace(/\/+$/, '') || '/';

  if (path === '/' || path === '') {
    const q = new URLSearchParams(search);
    const desk = q.get('desk');
    const out: UrlStateSlice = { view: 'home' };
    if (
      desk === 'weekly' ||
      desk === 'tasks' ||
      desk === 'deals' ||
      desk === 'meetings' ||
      desk === 'documents'
    ) {
      out.workdeskTab = desk;
    } else if (desk === 'dashboard') {
      out.workdeskTab = 'dashboard';
    }
    return out;
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

  const q = new URLSearchParams(search);
  const out: UrlStateSlice = { view };

  // Обратная совместимость: старые пути → новый хаб CRM / рабочий стол / BPM
  if (view === 'clients') {
    out.view = 'sales-funnel';
    out.crmHubTab = 'clients';
  }
  if (view === 'meetings' || view === 'docs') {
    out.view = 'home';
    out.workdeskTab = view === 'meetings' ? 'meetings' : 'documents';
  }
  if (view === 'analytics') {
    out.view = 'home';
    out.workdeskTab = 'dashboard';
  }
  if (view === 'admin') {
    out.view = 'settings';
    out.settingsTab = 'admin';
  }
  if (view === 'payroll') {
    out.view = 'employees';
    out.employeesHubTab = 'payroll';
  }

  if (out.view === 'spaces') {
    const space = q.get('space');
    if (space === 'content-plan' || space === 'backlog' || space === 'functionality') {
      out.activeSpaceTab = space;
    }
  }

  if (out.view === 'settings') {
    const t = q.get('tab');
    if (t) {
      out.settingsTab = t;
    } else if (!out.settingsTab) {
      out.settingsTab = 'users';
    }
  }

  if (out.view === 'employees') {
    const t = q.get('tab');
    if (t === 'payroll') out.employeesHubTab = 'payroll';
  }

  if (out.view === 'sales-funnel') {
    const crm = q.get('crm');
    if (crm === 'clients') out.crmHubTab = 'clients';
    else if (crm === 'contracts') out.crmHubTab = 'contracts';
    else if (crm === 'receivables') out.crmHubTab = 'receivables';
    else if (crm === 'chats' || crm === 'rejected') out.crmHubTab = 'funnel';
    else if (!out.crmHubTab) out.crmHubTab = 'funnel';
  }

  if (out.view === 'business-processes') {
    const bpm = q.get('bpm');
    if (bpm === 'inventory') out.view = 'inventory';
  }

  return out;
}

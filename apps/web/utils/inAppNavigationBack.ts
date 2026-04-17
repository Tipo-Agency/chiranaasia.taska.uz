import type { CrmHubTab } from '../types/crmHub';

/** Срез навигации для кнопки «Назад» в шапке (без браузерного history). */
export type AppHeaderNavSnapshot = {
  currentView: string;
  workdeskTab: string;
  crmHubTab: CrmHubTab;
  employeesHubTab: 'team' | 'payroll';
  activeSpaceTab?: 'content-plan' | 'backlog' | 'functionality';
  settingsActiveTab: string;
};

const LEAF_MODULE_VIEWS = new Set<string>([
  'tasks',
  'inbox',
  'search',
  'finance',
  'inventory',
  'business-processes',
  'chat',
  'production',
]);

/**
 * Показывать ли кнопку «Назад»: только если есть «внутренний» уровень
 * (вкладка рабочего стола, подраздел CRM, страница таблицы и т.д.),
 * либо выход из целого раздела на рабочий стол — но не на произвольный history.
 */
export function canShowAppBackButton(s: AppHeaderNavSnapshot): boolean {
  if (s.currentView === 'home' && s.workdeskTab !== 'dashboard') return true;
  if (s.currentView === 'sales-funnel' && s.crmHubTab !== 'funnel') return true;
  if (s.currentView === 'employees' && s.employeesHubTab === 'payroll') return true;
  if (s.currentView === 'spaces' && (s.activeSpaceTab === 'backlog' || s.activeSpaceTab === 'functionality')) {
    return true;
  }
  if (s.currentView === 'settings') return true;
  if (s.currentView === 'table') return true;
  if (s.currentView === 'doc-editor') return true;
  if (LEAF_MODULE_VIEWS.has(s.currentView)) return true;
  return false;
}

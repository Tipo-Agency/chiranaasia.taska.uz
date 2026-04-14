
import React, { useState, useEffect, useMemo, useLayoutEffect, lazy, Suspense } from 'react';
import { Project, Task, User, StatusOption, PriorityOption, NotificationPreferences, AutomationRule, TableCollection, Deal, Department, FinanceCategory, Fund, SalesFunnel, Doc, ContentPost, EmployeeInfo, Client, Contract, BusinessProcess, Meeting, Warehouse, OrgPosition } from '../types';
import { User as UserIcon, Briefcase, Archive, Users, Building2, Wallet, TrendingUp, PiggyBank, ShieldAlert, Settings, BellRing, Zap, Package, ArrowLeft, ShieldCheck, Receipt, Link2 } from 'lucide-react';
import {
  Input,
  ModuleCreateDropdown,
  ModuleCreateIconButton,
  ModuleFilterIconButton,
  ModulePageShell,
  MODULE_PAGE_GUTTER,
  MODULE_PAGE_TOP_PAD,
  APP_TOOLBAR_MODULE_CLUSTER,
  MODULE_ACCENTS,
  MODULE_TOOLBAR_TAB_IDLE,
} from './ui';
import { ProfileSettings } from './settings/ProfileSettings';
import { AccessSettings } from './settings/AccessSettings';
import { StructureSettings } from './settings/StructureSettings';
import { SpaceSettings } from './settings/SpaceSettings';
import { AutomationSettings } from './settings/AutomationSettings';
import DepartmentsView from './DepartmentsView';
import SalesFunnelsSettings from './settings/SalesFunnelsSettings';
import { DEFAULT_NOTIFICATION_PREFS } from '../constants';
// Integrations are managed outside Settings now.
import { ArchiveView, ARCHIVE_TAB_OPTIONS, type ArchiveTabId } from './settings/ArchiveView';
import { FinanceSetupSettings } from './settings/FinanceSetupSettings';
import { IntegrationsRoadmapSettings } from './settings/IntegrationsRoadmapSettings';
import { TasksSetupSettings } from './settings/TasksSetupSettings';
import { hasPermission } from '../utils/permissions';
import { RouteFallback } from './ui/RouteFallback';
import { useAppToolbar } from '../contexts/AppToolbarContext';

const AdminViewLazy = lazy(() => import('./admin/AdminView').then((m) => ({ default: m.AdminView })));

interface SettingsViewProps {
  // Data
  users: User[];
  projects: Project[];
  tasks?: Task[];
  statuses: StatusOption[];
  priorities: PriorityOption[];
  tables?: TableCollection[];
  automationRules?: AutomationRule[];
  currentUser?: User;
  departments?: Department[];
  financeCategories?: FinanceCategory[];
  funds?: Fund[];
  warehouses?: Warehouse[];
  salesFunnels?: SalesFunnel[];
  employeeInfos?: EmployeeInfo[];
  deals?: Deal[];
  clients?: Client[];
  contracts?: Contract[];
  meetings?: Meeting[];
  businessProcesses?: BusinessProcess[];
  orgPositions?: OrgPosition[];
  
  // Actions
  onUpdateTable?: (table: TableCollection) => void;
  onCreateTable?: () => void;
  onDeleteTable?: (id: string) => void;
  onUpdateUsers: (users: User[]) => void;
  onUpdateProjects: (projects: Project[]) => void;
  onUpdateStatuses: (statuses: StatusOption[]) => void;
  onUpdatePriorities: (priorities: PriorityOption[]) => void;
  onRestoreTask?: (taskId: string) => void;
  onPermanentDelete?: (taskId: string) => void;
  onRestoreUser?: (userId: string) => void;
  onRestoreEmployee?: (employeeId: string) => void;
  onRestoreDoc?: (docId: string) => void;
  onRestorePost?: (postId: string) => void;
  onRestoreProject?: (projectId: string) => void;
  onRestoreDepartment?: (departmentId: string) => void;
  onRestoreFinanceCategory?: (categoryId: string) => void;
  onRestoreSalesFunnel?: (funnelId: string) => void;
  onRestoreTable?: (tableId: string) => void;
  onRestoreBusinessProcess?: (processId: string) => void;
  onRestoreDeal?: (dealId: string) => void;
  onRestoreClient?: (clientId: string) => void;
  onRestoreContract?: (contractId: string) => void;
  onRestoreMeeting?: (meetingId: string) => void;
  onRestoreOrgPosition?: (positionId: string) => void;
  onRestoreAutomationRule?: (ruleId: string) => void;
  onRestoreStatus?: (statusId: string) => void;
  onRestorePriority?: (priorityId: string) => void;
  docs?: Doc[];
  contentPosts?: ContentPost[];
  onClose: () => void;
  onUpdateNotificationPrefs: (prefs: NotificationPreferences) => void;
  onSaveAutomationRule?: (rule: AutomationRule) => void;
  onDeleteAutomationRule?: (id: string) => void;
  onUpdateProfile?: (user: User) => void;
  onSaveDeal?: (deal: Deal) => void;
  onSaveDepartment?: (dep: Department) => void;
  onDeleteDepartment?: (id: string) => void;
  onSaveFinanceCategory?: (cat: FinanceCategory) => void;
  onDeleteFinanceCategory?: (id: string) => void;
  onSaveFund?: (fund: Fund) => void;
  onDeleteFund?: (id: string) => void;
  onSaveWarehouse?: (warehouse: Warehouse) => void;
  onDeleteWarehouse?: (id: string) => void;
  onSaveSalesFunnel?: (funnel: SalesFunnel) => void;
  onDeleteSalesFunnel?: (id: string) => void;
  notificationPrefs?: NotificationPreferences;
  
  initialTab?: string;
}

const SETTINGS_TABS_BASE: { id: string; label: string; icon: React.ReactNode }[] = [
  { id: 'profile', label: 'Профиль', icon: <UserIcon size={14} /> },
  { id: 'users', label: 'Пользователи', icon: <Users size={14} /> },
  { id: 'tasks', label: 'Задачи', icon: <Briefcase size={14} /> },
  { id: 'structure', label: 'Структура', icon: <Building2 size={14} /> },
  { id: 'finance-setup', label: 'Финансы', icon: <Wallet size={14} /> },
  { id: 'sales-funnels', label: 'Воронки продаж', icon: <TrendingUp size={14} /> },
  { id: 'notifications', label: 'Уведомления', icon: <BellRing size={14} /> },
  { id: 'events', label: 'Триггеры', icon: <Zap size={14} /> },
];

const SettingsView: React.FC<SettingsViewProps> = ({ 
  users, projects, tasks = [], statuses, priorities, tables = [], automationRules = [], 
  onUpdateTable, onCreateTable, onDeleteTable, onUpdateUsers, onUpdateProjects, onUpdateStatuses, onUpdatePriorities,
  onRestoreTask, onPermanentDelete, onRestoreUser, onRestoreEmployee, onRestoreDoc, onRestorePost,
  onRestoreProject, onRestoreDepartment, onRestoreFinanceCategory, onRestoreSalesFunnel,
  onRestoreTable, onRestoreBusinessProcess, onRestoreDeal, onRestoreClient, onRestoreContract,
  onRestoreMeeting,
  onRestoreOrgPosition,
  onRestoreAutomationRule,
  onRestoreStatus,
  onRestorePriority,
  docs = [], contentPosts = [],
  onUpdateNotificationPrefs, onSaveAutomationRule, onDeleteAutomationRule,
  currentUser, onUpdateProfile, initialTab = 'users',
  onSaveDeal, departments = [], onSaveDepartment, onDeleteDepartment,
  financeCategories = [], onSaveFinanceCategory, onDeleteFinanceCategory,
  funds = [], onSaveFund, onDeleteFund,
  warehouses = [], onSaveWarehouse, onDeleteWarehouse,
  salesFunnels = [], onSaveSalesFunnel, onDeleteSalesFunnel,
  employeeInfos = [], deals = [], clients = [], contracts = [], meetings = [], businessProcesses = [], orgPositions = [],
  notificationPrefs, onClose: _onClose
}) => {
  const { setLeading, setModule } = useAppToolbar();
  const settingsTabs = useMemo(() => {
    const t = [...SETTINGS_TABS_BASE];
    if (currentUser && hasPermission(currentUser, 'admin.system')) {
      t.push({ id: 'integrations-roadmap', label: 'Интеграции (план)', icon: <Link2 size={14} /> });
      t.push({ id: 'admin', label: 'Админ-панель', icon: <ShieldCheck size={14} /> });
    }
    return t;
  }, [currentUser]);

  const normalizeTab = (t: string) => {
    if (t === 'spaces' || t === 'departments' || t === 'warehouses') return 'structure';
    if (t === 'finance-categories' || t === 'funds') return 'finance-setup';
    if (t === 'integrations' || t === 'system') return 'notifications';
    if (
      (t === 'admin' || t === 'integrations-roadmap') &&
      (!currentUser || !hasPermission(currentUser, 'admin.system'))
    ) {
      return 'users';
    }
    return t;
  };
  const [activeTab, setActiveTab] = useState<string>(normalizeTab(initialTab));
  const [showArchiveScreen, setShowArchiveScreen] = useState(false);
  const [archiveTab, setArchiveTab] = useState<ArchiveTabId>('tasks');
  const [archiveShowFilters, setArchiveShowFilters] = useState(false);
  const [archiveQuery, setArchiveQuery] = useState('');

  /** Инкремент при нажатии «+» на вкладке пользователей — открывает форму создания в AccessSettings */
  const [openNewUserSignal, setOpenNewUserSignal] = useState(0);
  const [structureCreateKind, setStructureCreateKind] = useState<null | 'project' | 'department' | 'warehouse'>(null);
  const [financeCreateKind, setFinanceCreateKind] = useState<null | 'category' | 'fund'>(null);
  const [salesFunnelsCreateRequested, setSalesFunnelsCreateRequested] = useState(0);

  useEffect(() => {
    // When Settings opened with legacy tab ids, map them to new unified tab.
    setActiveTab((prev) => normalizeTab(prev));
  }, []);

  useLayoutEffect(() => {
    const activeBox = MODULE_ACCENTS.slate.navIconActive;
    const idleBox = MODULE_TOOLBAR_TAB_IDLE;
    const leadingTabs = showArchiveScreen
      ? ARCHIVE_TAB_OPTIONS.map((t) => ({ id: t.id as string, label: t.label }))
      : settingsTabs.map((t) => ({ id: t.id, label: t.label }));
    const selectedId = showArchiveScreen ? archiveTab : activeTab;

    setLeading(
      <div className="flex items-center gap-0.5 sm:gap-1 shrink-0 flex-wrap sm:flex-nowrap" role="tablist" aria-label="Настройки">
        {leadingTabs.map((t) => {
          const active = selectedId === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                if (showArchiveScreen) setArchiveTab(t.id as ArchiveTabId);
                else setActiveTab(t.id);
              }}
              className={`px-2 sm:px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                active ? activeBox : idleBox
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>
    );

    const canCreate =
      !showArchiveScreen &&
      ((activeTab === 'users' && hasPermission(currentUser, 'access.users')) ||
        activeTab === 'structure' ||
        activeTab === 'finance-setup' ||
        activeTab === 'sales-funnels');

    setModule(
      <div className={APP_TOOLBAR_MODULE_CLUSTER}>
        {showArchiveScreen ? (
          <>
            <ModuleFilterIconButton
              accent="slate"
              size="sm"
              active={archiveShowFilters || !!archiveQuery.trim()}
              activeCount={archiveQuery.trim() ? 1 : 0}
              onClick={() => setArchiveShowFilters((v) => !v)}
              label="Фильтры"
            />
            <button
              type="button"
              onClick={() => {
                setShowArchiveScreen(false);
                setArchiveShowFilters(false);
                setArchiveQuery('');
              }}
              className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-gray-200 dark:border-[#333] bg-white dark:bg-[#1a1a1a] text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#252525]"
              title="Назад"
              aria-label="Назад"
            >
              <ArrowLeft size={16} />
            </button>
          </>
        ) : (
          <>
            {activeTab === 'structure' && canCreate ? (
              <ModuleCreateDropdown
                accent="slate"
                buttonSize="sm"
                label="Создать"
                items={[
                  {
                    id: 'project',
                    label: 'Проект / модуль',
                    icon: Briefcase,
                    onClick: () => setStructureCreateKind('project'),
                    iconClassName: 'text-slate-600 dark:text-slate-300',
                  },
                  {
                    id: 'department',
                    label: 'Подразделение',
                    icon: Building2,
                    onClick: () => setStructureCreateKind('department'),
                    iconClassName: 'text-slate-600 dark:text-slate-300',
                  },
                  {
                    id: 'warehouse',
                    label: 'Склад',
                    icon: Package,
                    onClick: () => setStructureCreateKind('warehouse'),
                    iconClassName: 'text-slate-600 dark:text-slate-300',
                  },
                ]}
              />
            ) : activeTab === 'finance-setup' && canCreate ? (
              <ModuleCreateDropdown
                accent="slate"
                buttonSize="sm"
                label="Создать"
                items={[
                  {
                    id: 'category',
                    label: 'Статья расходов',
                    icon: Receipt,
                    onClick: () => setFinanceCreateKind('category'),
                    iconClassName: 'text-slate-600 dark:text-slate-300',
                  },
                  {
                    id: 'fund',
                    label: 'Фонд',
                    icon: PiggyBank,
                    onClick: () => setFinanceCreateKind('fund'),
                    iconClassName: 'text-slate-600 dark:text-slate-300',
                  },
                ]}
              />
            ) : (
              <ModuleCreateIconButton
                accent="slate"
                size="sm"
                label={activeTab === 'users' ? 'Создать' : 'Создание доступно не во всех вкладках'}
                disabled={!canCreate}
                onClick={() => {
                  if (!canCreate) return;
                  if (activeTab === 'users') setOpenNewUserSignal((n) => n + 1);
                  if (activeTab === 'sales-funnels') setSalesFunnelsCreateRequested((x) => x + 1);
                }}
              />
            )}
            <button
              type="button"
              onClick={() => setShowArchiveScreen(true)}
              className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-gray-200 dark:border-[#333] bg-white dark:bg-[#1a1a1a] text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#252525]"
              title="Архив"
              aria-label="Архив"
            >
              <Archive size={16} />
            </button>
          </>
        )}
      </div>
    );

    return () => {
      setLeading(null);
      setModule(null);
    };
  }, [
    showArchiveScreen,
    archiveTab,
    activeTab,
    settingsTabs,
    archiveShowFilters,
    archiveQuery,
    setLeading,
    setModule,
  ]);

  return (
    <ModulePageShell>
      <div className="flex-1 min-h-0 overflow-hidden">
        <div className={`${MODULE_PAGE_GUTTER} ${MODULE_PAGE_TOP_PAD} pb-24 md:pb-32 h-full overflow-y-auto overflow-x-hidden custom-scrollbar`}>
          {showArchiveScreen ? (
            <div className="space-y-3">
              {archiveShowFilters && (
                <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-2xl p-4">
                  <Input
                    value={archiveQuery}
                    onChange={(e) => setArchiveQuery(e.target.value)}
                    placeholder="Поиск в архиве…"
                    fullWidth
                  />
                </div>
              )}
              <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-2xl p-4 md:p-6">
                <ArchiveView
                  layout="embedded"
                  activeTab={archiveTab}
                  onTabChange={setArchiveTab}
                  query={archiveQuery}
                  tasks={tasks.filter(t => t.isArchived)}
                  users={users.filter(u => u.isArchived)}
                  employees={employeeInfos.filter(e => e.isArchived)}
                  docs={docs.filter(d => d.isArchived)}
                  posts={contentPosts.filter(p => p.isArchived)}
                  projects={projects.filter(p => p.isArchived)}
                  departments={departments.filter(d => d.isArchived)}
                  financeCategories={financeCategories.filter(f => f.isArchived)}
                  salesFunnels={salesFunnels.filter(s => s.isArchived)}
                  tables={tables.filter(t => t.isArchived)}
                  businessProcesses={businessProcesses.filter(b => b.isArchived)}
                  deals={deals.filter(d => d.isArchived)}
                  clients={clients.filter(c => c.isArchived)}
                  contracts={contracts.filter(c => c.isArchived)}
                  meetings={meetings.filter(m => m.isArchived)}
                  orgPositions={orgPositions.filter(p => p.isArchived)}
                  automationRules={automationRules.filter(r => r.isArchived)}
                  statusOptions={statuses.filter(s => s.isArchived)}
                  priorityOptions={priorities.filter(p => p.isArchived)}
                  onRestoreTask={onRestoreTask}
                  onPermanentDelete={onPermanentDelete}
                  onRestoreUser={onRestoreUser}
                  onRestoreEmployee={onRestoreEmployee}
                  onRestoreDoc={onRestoreDoc}
                  onRestorePost={onRestorePost}
                  onRestoreProject={onRestoreProject}
                  onRestoreDepartment={onRestoreDepartment}
                  onRestoreFinanceCategory={onRestoreFinanceCategory}
                  onRestoreSalesFunnel={onRestoreSalesFunnel}
                  onRestoreTable={onRestoreTable}
                  onRestoreBusinessProcess={onRestoreBusinessProcess}
                  onRestoreDeal={onRestoreDeal}
                  onRestoreClient={onRestoreClient}
                  onRestoreContract={onRestoreContract}
                  onRestoreMeeting={onRestoreMeeting}
                  onRestoreOrgPosition={onRestoreOrgPosition}
                  onRestoreAutomationRule={onRestoreAutomationRule}
                  onRestoreStatus={onRestoreStatus}
                  onRestorePriority={onRestorePriority}
                />
              </div>
            </div>
          ) : (
            <>
              {activeTab === 'profile' && currentUser && <ProfileSettings activeTab="profile" currentUser={currentUser} users={users} onUpdateProfile={onUpdateProfile!} onUpdateUsers={onUpdateUsers} />}
              {activeTab === 'users' && currentUser && (
                <AccessSettings
                  currentUser={currentUser}
                  users={users}
                  onUpdateUsers={onUpdateUsers}
                  openNewUserSignal={openNewUserSignal}
                />
              )}
              {activeTab === 'tasks' && (
                <TasksSetupSettings
                  statuses={statuses}
                  priorities={priorities}
                  onUpdateStatuses={onUpdateStatuses}
                  onUpdatePriorities={onUpdatePriorities}
                />
              )}
              {activeTab === 'structure' && (
                <StructureSettings
                  projects={projects}
                  departments={departments}
                  warehouses={warehouses}
                  users={users}
                  onUpdateProjects={onUpdateProjects}
                  onSaveDepartment={onSaveDepartment!}
                  onDeleteDepartment={onDeleteDepartment!}
                  onSaveWarehouse={onSaveWarehouse!}
                  onDeleteWarehouse={onDeleteWarehouse!}
                  createKind={structureCreateKind}
                  onConsumedCreateKind={() => setStructureCreateKind(null)}
                />
              )}
              {activeTab === 'finance-setup' && (
                <FinanceSetupSettings
                  categories={financeCategories}
                  funds={funds}
                  onSaveCategory={onSaveFinanceCategory!}
                  onDeleteCategory={onDeleteFinanceCategory!}
                  onSaveFund={onSaveFund!}
                  onDeleteFund={onDeleteFund!}
                  createKind={financeCreateKind}
                  onConsumedCreateKind={() => setFinanceCreateKind(null)}
                />
              )}
              {activeTab === 'sales-funnels' && (
                <SalesFunnelsSettings
                  funnels={salesFunnels}
                  users={users}
                  onSave={onSaveSalesFunnel!}
                  onDelete={onDeleteSalesFunnel!}
                  notificationPrefs={notificationPrefs}
                  onUpdatePrefs={onUpdateNotificationPrefs}
                  createRequested={salesFunnelsCreateRequested}
                />
              )}
              {activeTab === 'notifications' && (
                <AutomationSettings
                  activeTab="notifications"
                  automationRules={automationRules}
                  notificationPrefs={notificationPrefs || DEFAULT_NOTIFICATION_PREFS}
                  statuses={statuses}
                  onSaveRule={onSaveAutomationRule!}
                  onDeleteRule={onDeleteAutomationRule!}
                  onUpdatePrefs={onUpdateNotificationPrefs}
                />
              )}
              {activeTab === 'events' && (
                <AutomationSettings
                  activeTab="events"
                  automationRules={automationRules}
                  notificationPrefs={notificationPrefs || DEFAULT_NOTIFICATION_PREFS}
                  statuses={statuses}
                  onSaveRule={onSaveAutomationRule!}
                  onDeleteRule={onDeleteAutomationRule!}
                  onUpdatePrefs={onUpdateNotificationPrefs}
                />
              )}
              {activeTab === 'integrations-roadmap' && currentUser && hasPermission(currentUser, 'admin.system') && (
                <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-2xl p-4 md:p-6">
                  <IntegrationsRoadmapSettings />
                </div>
              )}
              {activeTab === 'admin' && currentUser && hasPermission(currentUser, 'admin.system') && (
                <Suspense fallback={<RouteFallback />}>
                  <AdminViewLazy />
                </Suspense>
              )}
            </>
          )}
        </div>
      </div>

    </ModulePageShell>
  );
};

export default SettingsView;

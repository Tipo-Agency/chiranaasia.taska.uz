
import React, { useState, useEffect } from 'react';
import { Project, Role, Task, User, StatusOption, PriorityOption, NotificationPreferences, AutomationRule, TableCollection, Deal, Department, FinanceCategory, Fund, SalesFunnel, Doc, ContentPost, EmployeeInfo, Client, Contract, BusinessProcess, Meeting, Warehouse } from '../types';
import { User as UserIcon, Briefcase, Archive, Users, Building2, Wallet, TrendingUp, PiggyBank, ShieldAlert, Settings, BellRing, Zap, Package, ArrowLeft, Plus } from 'lucide-react';
import { Button, Input, ModuleFilterIconButton, ModulePageHeader, ModulePageShell, ModuleSegmentedControl, MODULE_PAGE_GUTTER, StandardModal } from './ui';
import { ProfileSettings } from './settings/ProfileSettings';
import { StructureSettings } from './settings/StructureSettings';
import { SpaceSettings } from './settings/SpaceSettings';
import { AutomationSettings } from './settings/AutomationSettings';
import DepartmentsView from './DepartmentsView';
import SalesFunnelsSettings from './settings/SalesFunnelsSettings';
import { DEFAULT_NOTIFICATION_PREFS } from '../constants';
// Integrations are managed outside Settings now.
import { ArchiveView, ARCHIVE_TAB_OPTIONS, type ArchiveTabId } from './settings/ArchiveView';
import { FinanceSetupSettings } from './settings/FinanceSetupSettings';

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

const SETTINGS_TABS: { id: string; label: string; icon: React.ReactNode }[] = [
  { id: 'profile', label: 'Профиль', icon: <UserIcon size={14} /> },
  { id: 'users', label: 'Пользователи', icon: <Users size={14} /> },
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
  docs = [], contentPosts = [],
  onUpdateNotificationPrefs, onSaveAutomationRule, onDeleteAutomationRule,
  currentUser, onUpdateProfile, initialTab = 'users',
  onSaveDeal, departments = [], onSaveDepartment, onDeleteDepartment,
  financeCategories = [], onSaveFinanceCategory, onDeleteFinanceCategory,
  funds = [], onSaveFund, onDeleteFund,
  warehouses = [], onSaveWarehouse, onDeleteWarehouse,
  salesFunnels = [], onSaveSalesFunnel, onDeleteSalesFunnel,
  employeeInfos = [], deals = [], clients = [], contracts = [], meetings = [], businessProcesses = [],
  notificationPrefs, onClose: _onClose
}) => {
  const normalizeTab = (t: string) => {
    if (t === 'spaces' || t === 'departments' || t === 'warehouses') return 'structure';
    if (t === 'finance-categories' || t === 'funds') return 'finance-setup';
    if (t === 'integrations' || t === 'system') return 'notifications';
    return t;
  };
  const [activeTab, setActiveTab] = useState<string>(normalizeTab(initialTab));
  const [showArchiveScreen, setShowArchiveScreen] = useState(false);
  const [archiveTab, setArchiveTab] = useState<ArchiveTabId>('tasks');
  const [archiveShowFilters, setArchiveShowFilters] = useState(false);
  const [archiveQuery, setArchiveQuery] = useState('');

  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [createUserName, setCreateUserName] = useState('');
  const [createUserLogin, setCreateUserLogin] = useState('');
  const [createUserPassword, setCreateUserPassword] = useState('');
  const [structureCreatePickerOpen, setStructureCreatePickerOpen] = useState(false);
  const [structureCreateKind, setStructureCreateKind] = useState<null | 'project' | 'department' | 'warehouse'>(null);
  const [financeCreatePickerOpen, setFinanceCreatePickerOpen] = useState(false);
  const [financeCreateKind, setFinanceCreateKind] = useState<null | 'category' | 'fund'>(null);
  const [salesFunnelsCreateRequested, setSalesFunnelsCreateRequested] = useState(0);

  useEffect(() => {
    // When Settings opened with legacy tab ids, map them to new unified tab.
    setActiveTab((prev) => normalizeTab(prev));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ModulePageShell>
      <div className={`${MODULE_PAGE_GUTTER} pt-6 md:pt-8 flex-shrink-0`}>
        <div className="mb-5">
          <ModulePageHeader
            accent="slate"
            icon={<Settings size={24} strokeWidth={2} />}
            title="Настройки"
            description=" "
            tabs={
              showArchiveScreen ? (
                <ModuleSegmentedControl
                  variant="neutral"
                  value={archiveTab}
                  onChange={(v) => setArchiveTab(v as ArchiveTabId)}
                  options={ARCHIVE_TAB_OPTIONS.map((t) => ({ value: t.id, label: t.label }))}
                />
              ) : (
                <ModuleSegmentedControl
                  variant="neutral"
                  value={activeTab}
                  onChange={(v) => setActiveTab(v)}
                  options={SETTINGS_TABS.map((t) => ({
                    value: t.id,
                    label: t.label,
                    icon: t.icon,
                  }))}
                />
              )
            }
            controls={
              showArchiveScreen ? (
                <>
                  <ModuleFilterIconButton
                    accent="slate"
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
                    className="inline-flex items-center justify-center w-11 h-11 rounded-xl border border-gray-200 dark:border-[#333] bg-white dark:bg-[#1a1a1a] text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#252525]"
                    title="Назад"
                    aria-label="Назад"
                  >
                    <ArrowLeft size={18} />
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      if (activeTab === 'users') setCreateUserOpen(true);
                      if (activeTab === 'structure') setStructureCreatePickerOpen(true);
                      if (activeTab === 'finance-setup') setFinanceCreatePickerOpen(true);
                      if (activeTab === 'sales-funnels') setSalesFunnelsCreateRequested((x) => x + 1);
                    }}
                    className={`inline-flex items-center justify-center w-11 h-11 rounded-xl border border-gray-200 dark:border-[#333] bg-white dark:bg-[#1a1a1a] text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#252525] ${
                      activeTab === 'users' || activeTab === 'structure' || activeTab === 'finance-setup' || activeTab === 'sales-funnels'
                        ? ''
                        : 'opacity-50 cursor-not-allowed'
                    }`}
                    title={activeTab === 'users' ? 'Создать' : 'Создание доступно не во всех вкладках'}
                    aria-label="Создать"
                    disabled={!(activeTab === 'users' || activeTab === 'structure' || activeTab === 'finance-setup' || activeTab === 'sales-funnels')}
                  >
                    <Plus size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowArchiveScreen(true)}
                    className="inline-flex items-center justify-center w-11 h-11 rounded-xl border border-gray-200 dark:border-[#333] bg-white dark:bg-[#1a1a1a] text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#252525]"
                    title="Архив"
                    aria-label="Архив"
                  >
                    <Archive size={18} />
                  </button>
                </>
              )
            }
          />
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        <div className={`${MODULE_PAGE_GUTTER} mt-3 pb-24 md:pb-32 h-full overflow-y-auto overflow-x-hidden custom-scrollbar`}>
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
                />
              </div>
            </div>
          ) : (
            <>
              {activeTab === 'profile' && currentUser && <ProfileSettings activeTab="profile" currentUser={currentUser} users={users} onUpdateProfile={onUpdateProfile!} onUpdateUsers={onUpdateUsers} />}
              {activeTab === 'users' && <ProfileSettings activeTab="users" currentUser={currentUser!} users={users} onUpdateProfile={onUpdateProfile!} onUpdateUsers={onUpdateUsers} />}
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
            </>
          )}
        </div>
      </div>

      <StandardModal
        isOpen={createUserOpen}
        onClose={() => {
          setCreateUserOpen(false);
          setCreateUserName('');
          setCreateUserLogin('');
          setCreateUserPassword('');
        }}
        title="Новый пользователь"
        size="sm"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" onClick={() => setCreateUserOpen(false)}>
              Отмена
            </Button>
            <Button
              onClick={() => {
                const name = createUserName.trim();
                const login = createUserLogin.trim();
                const password = createUserPassword.trim() || '123';
                if (!name || !login) return;
                const newUser: User = {
                  id: `u-${Date.now()}`,
                  name,
                  login,
                  password,
                  role: Role.EMPLOYEE,
                  mustChangePassword: true,
                } as any;
                onUpdateUsers([...(users || []), newUser]);
                setCreateUserOpen(false);
                setCreateUserName('');
                setCreateUserLogin('');
                setCreateUserPassword('');
              }}
              disabled={!createUserName.trim() || !createUserLogin.trim()}
            >
              Создать
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <Input label="Имя" value={createUserName} onChange={(e) => setCreateUserName(e.target.value)} />
          <Input label="Логин" value={createUserLogin} onChange={(e) => setCreateUserLogin(e.target.value)} placeholder="ivan" />
          <Input
            label="Пароль (можно пусто — будет 123)"
            value={createUserPassword}
            onChange={(e) => setCreateUserPassword(e.target.value)}
            type="password"
            placeholder="••••••"
          />
          <div className="text-xs text-gray-500 dark:text-gray-400">
            После первого входа пользователю покажется запрос на установку пароля.
          </div>
        </div>
      </StandardModal>

      <StandardModal
        isOpen={structureCreatePickerOpen}
        onClose={() => setStructureCreatePickerOpen(false)}
        title="Создать"
        size="sm"
      >
        <div className="grid grid-cols-1 gap-2">
          <button
            type="button"
            onClick={() => {
              setStructureCreatePickerOpen(false);
              setStructureCreateKind('project');
            }}
            className="w-full text-left px-4 py-3 rounded-xl border border-gray-200 dark:border-[#333] bg-white dark:bg-[#252525] hover:bg-gray-50 dark:hover:bg-[#303030]"
          >
            <div className="font-semibold text-gray-900 dark:text-white">Проект / модуль</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Иконка + цвет</div>
          </button>
          <button
            type="button"
            onClick={() => {
              setStructureCreatePickerOpen(false);
              setStructureCreateKind('department');
            }}
            className="w-full text-left px-4 py-3 rounded-xl border border-gray-200 dark:border-[#333] bg-white dark:bg-[#252525] hover:bg-gray-50 dark:hover:bg-[#303030]"
          >
            <div className="font-semibold text-gray-900 dark:text-white">Подразделение</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Название, руководитель</div>
          </button>
          <button
            type="button"
            onClick={() => {
              setStructureCreatePickerOpen(false);
              setStructureCreateKind('warehouse');
            }}
            className="w-full text-left px-4 py-3 rounded-xl border border-gray-200 dark:border-[#333] bg-white dark:bg-[#252525] hover:bg-gray-50 dark:hover:bg-[#303030]"
          >
            <div className="font-semibold text-gray-900 dark:text-white">Склад</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Название, локация</div>
          </button>
        </div>
      </StandardModal>

      <StandardModal
        isOpen={financeCreatePickerOpen}
        onClose={() => setFinanceCreatePickerOpen(false)}
        title="Создать"
        size="sm"
      >
        <div className="grid grid-cols-1 gap-2">
          <button
            type="button"
            onClick={() => {
              setFinanceCreatePickerOpen(false);
              setFinanceCreateKind('category');
            }}
            className="w-full text-left px-4 py-3 rounded-xl border border-gray-200 dark:border-[#333] bg-white dark:bg-[#252525] hover:bg-gray-50 dark:hover:bg-[#303030]"
          >
            <div className="font-semibold text-gray-900 dark:text-white">Статья расходов</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Фикс / процент</div>
          </button>
          <button
            type="button"
            onClick={() => {
              setFinanceCreatePickerOpen(false);
              setFinanceCreateKind('fund');
            }}
            className="w-full text-left px-4 py-3 rounded-xl border border-gray-200 dark:border-[#333] bg-white dark:bg-[#252525] hover:bg-gray-50 dark:hover:bg-[#303030]"
          >
            <div className="font-semibold text-gray-900 dark:text-white">Фонд</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Название и порядок</div>
          </button>
        </div>
      </StandardModal>
    </ModulePageShell>
  );
};

export default SettingsView;


import React, { useState, useEffect } from 'react';
import { Project, Role, Task, User, StatusOption, PriorityOption, NotificationPreferences, AutomationRule, TableCollection, Deal, Department, FinanceCategory, Fund, SalesFunnel, Doc, ContentPost, EmployeeInfo, Client, Contract, BusinessProcess, Meeting, Warehouse } from '../types';
import { User as UserIcon, Briefcase, Archive, Users, Building2, Wallet, TrendingUp, PiggyBank, PlugZap, ShieldAlert, Settings, BellRing, Zap, Package, ArrowLeft } from 'lucide-react';
import { ModulePageHeader, ModulePageShell, ModuleSegmentedControl, MODULE_PAGE_GUTTER } from './ui';
import { ProfileSettings } from './settings/ProfileSettings';
import { SystemLogsSettings } from './settings/SystemLogsSettings';
import { SpaceSettings } from './settings/SpaceSettings';
import { AutomationSettings } from './settings/AutomationSettings';
import DepartmentsView from './DepartmentsView';
import { storageService } from '../services/storageService';
import FinanceCategoriesSettings from './settings/FinanceCategoriesSettings';
import FundsSettings from './settings/FundsSettings';
import SalesFunnelsSettings from './settings/SalesFunnelsSettings';
import { DEFAULT_NOTIFICATION_PREFS } from '../constants';
import { IntegrationSettings } from './settings/IntegrationSettings';
import { WarehouseSettings } from './settings/WarehouseSettings';

// Компонент для отображения архива с вкладками
const ArchiveView: React.FC<{ 
    tasks: Task[];
    users?: User[];
    employees?: EmployeeInfo[];
    docs?: Doc[];
    posts?: ContentPost[];
    projects?: Project[];
    departments?: Department[];
    financeCategories?: FinanceCategory[];
    salesFunnels?: SalesFunnel[];
    tables?: TableCollection[];
    businessProcesses?: BusinessProcess[];
    deals?: Deal[];
    clients?: Client[];
    contracts?: Contract[];
    meetings?: Meeting[];
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
}> = ({ 
    tasks, users: initialUsers = [], employees: initialEmployees = [], docs = [], posts = [], 
    projects = [], departments = [], financeCategories = [], salesFunnels = [], tables = [],
    businessProcesses = [], deals = [], clients = [], contracts = [], meetings = [],
    onRestoreTask, onPermanentDelete, onRestoreUser, onRestoreEmployee, onRestoreDoc, onRestorePost,
    onRestoreProject, onRestoreDepartment, onRestoreFinanceCategory, onRestoreSalesFunnel,
    onRestoreTable, onRestoreBusinessProcess, onRestoreDeal, onRestoreClient, onRestoreContract,
    onRestoreMeeting
}) => {
    const [archiveTab, setArchiveTab] = useState<'tasks' | 'users' | 'employees' | 'docs' | 'posts' | 'projects' | 'departments' | 'financeCategories' | 'salesFunnels' | 'tables' | 'businessProcesses' | 'deals' | 'clients' | 'contracts' | 'meetings'>('tasks');
    const [allUsers, setAllUsers] = useState<User[]>(initialUsers);
    const [allEmployees, setAllEmployees] = useState<EmployeeInfo[]>(initialEmployees);
    
    const getEmployeeName = (employee: EmployeeInfo) => {
        const user = allUsers.find(u => u.id === employee.userId);
        return user ? user.name : `ID: ${employee.id}`;
    };
    
    // Загружаем всех пользователей и сотрудников (включая архивных) при открытии соответствующих вкладок
    useEffect(() => {
        if (archiveTab === 'users') {
            import('../backend/api').then(({ api }) => {
                api.users.getAll().then(users => {
                    setAllUsers(users);
                }).catch(err => console.error('Ошибка загрузки пользователей:', err));
            });
        }
        if (archiveTab === 'employees') {
            import('../backend/api').then(({ api }) => {
                api.employees.getAll().then(employees => {
                    setAllEmployees(employees);
                }).catch(err => console.error('Ошибка загрузки сотрудников:', err));
            });
        }
    }, [archiveTab]);
    
    const renderArchiveList = <T extends { id: string; isArchived?: boolean }>(
        items: T[],
        getLabel: (item: T) => string,
        onRestore?: (id: string) => void,
        emptyMessage: string = 'Архив пуст'
    ) => {
        const archived = items.filter(item => item.isArchived);
        if (archived.length === 0) {
            return <p className="text-gray-500 dark:text-gray-400">{emptyMessage}</p>;
        }
        return archived.map(item => (
            <div key={item.id} className="flex justify-between items-center p-3 border border-gray-200 dark:border-[#333] rounded-lg">
                <span className="text-sm text-gray-600 dark:text-gray-300">{getLabel(item)}</span>
                <div className="flex gap-2">
                    {onRestore && <button onClick={() => onRestore(item.id)} className="text-blue-600 hover:underline text-xs">Восстановить</button>}
                </div>
            </div>
        ));
    };
    
    const archiveTabOptions = [
        { id: 'tasks' as const, label: 'Задачи' },
        { id: 'users' as const, label: 'Пользователи' },
        { id: 'employees' as const, label: 'Сотрудники' },
        { id: 'projects' as const, label: 'Проекты' },
        { id: 'departments' as const, label: 'Подразделения' },
        { id: 'financeCategories' as const, label: 'Статьи расходов' },
        { id: 'salesFunnels' as const, label: 'Воронки' },
        { id: 'tables' as const, label: 'Таблицы' },
        { id: 'businessProcesses' as const, label: 'Бизнес-процессы' },
        { id: 'deals' as const, label: 'Сделки' },
        { id: 'clients' as const, label: 'Клиенты' },
        { id: 'contracts' as const, label: 'Договоры' },
        { id: 'docs' as const, label: 'Документы' },
        { id: 'posts' as const, label: 'Посты' },
        { id: 'meetings' as const, label: 'Встречи' },
    ];

    return (
        <div className="space-y-4">
            <h3 className="font-bold text-lg text-gray-800 dark:text-white tracking-tight">Архив</h3>
            <ModuleSegmentedControl
                variant="neutral"
                value={archiveTab}
                onChange={(v) => setArchiveTab(v as typeof archiveTab)}
                options={archiveTabOptions.map((t) => ({ value: t.id, label: t.label }))}
                className="w-full max-w-full justify-start"
            />
            
            {/* Контент вкладок */}
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                {archiveTab === 'tasks' && renderArchiveList<Task>(tasks, t => t.title, onRestoreTask, 'Архив задач пуст')}
                {archiveTab === 'users' && renderArchiveList<User>(allUsers, u => u.name, onRestoreUser, 'Архив пользователей пуст')}
                {archiveTab === 'employees' && renderArchiveList<EmployeeInfo>(allEmployees, e => getEmployeeName(e), onRestoreEmployee, 'Архив сотрудников пуст')}
                {archiveTab === 'projects' && renderArchiveList<Project>(projects, p => p.name, onRestoreProject, 'Архив проектов пуст')}
                {archiveTab === 'departments' && renderArchiveList<Department>(departments, d => d.name, onRestoreDepartment, 'Архив подразделений пуст')}
                {archiveTab === 'financeCategories' && renderArchiveList<FinanceCategory>(financeCategories, f => f.name, onRestoreFinanceCategory, 'Архив статей расходов пуст')}
                {archiveTab === 'salesFunnels' && renderArchiveList<SalesFunnel>(salesFunnels, s => s.name, onRestoreSalesFunnel, 'Архив воронок пуст')}
                {archiveTab === 'tables' && renderArchiveList<TableCollection>(tables, t => t.name, onRestoreTable, 'Архив таблиц пуст')}
                {archiveTab === 'businessProcesses' && renderArchiveList<BusinessProcess>(businessProcesses, b => b.title, onRestoreBusinessProcess, 'Архив бизнес-процессов пуст')}
                {archiveTab === 'deals' && renderArchiveList<Deal>(deals, d => d.title || d.id, onRestoreDeal, 'Архив сделок пуст')}
                {archiveTab === 'clients' && renderArchiveList<Client>(clients, c => c.name, onRestoreClient, 'Архив клиентов пуст')}
                {archiveTab === 'contracts' && renderArchiveList<Contract>(contracts, c => c.number || c.id, onRestoreContract, 'Архив договоров пуст')}
                {archiveTab === 'docs' && renderArchiveList<Doc>(docs, d => d.title, onRestoreDoc, 'Архив документов пуст')}
                {archiveTab === 'posts' && renderArchiveList<ContentPost>(posts, p => p.topic, onRestorePost, 'Архив постов пуст')}
                {archiveTab === 'meetings' && renderArchiveList<Meeting>(meetings, m => m.title, onRestoreMeeting, 'Архив встреч пуст')}
            </div>
        </div>
    );
};

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
  { id: 'spaces', label: 'Проекты / модули', icon: <Briefcase size={14} /> },
  { id: 'departments', label: 'Подразделения', icon: <Building2 size={14} /> },
  { id: 'warehouses', label: 'Склад', icon: <Package size={14} /> },
  { id: 'finance-categories', label: 'Статьи расходов', icon: <Wallet size={14} /> },
  { id: 'funds', label: 'Фонды', icon: <PiggyBank size={14} /> },
  { id: 'sales-funnels', label: 'Воронки продаж', icon: <TrendingUp size={14} /> },
  { id: 'notifications', label: 'Уведомления', icon: <BellRing size={14} /> },
  { id: 'events', label: 'События и роботы', icon: <Zap size={14} /> },
  { id: 'integrations', label: 'Интеграции', icon: <PlugZap size={14} /> },
  { id: 'system', label: 'Система / Логи', icon: <ShieldAlert size={14} /> },
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
  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [showArchiveScreen, setShowArchiveScreen] = useState(false);

  return (
    <ModulePageShell>
      <div className={`${MODULE_PAGE_GUTTER} max-w-5xl pt-6 pb-4 flex-shrink-0`}>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 pb-4 border-b border-gray-200 dark:border-[#333]">
          <ModulePageHeader
            accent="slate"
            icon={<Settings size={24} strokeWidth={2} />}
            title="Настройки системы"
            description="Пересобранный центр настроек: пользователи, склад, воронки, уведомления, события, интеграции."
            className="mb-0 flex-1"
          />
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
        <div className={`${MODULE_PAGE_GUTTER} max-w-5xl py-6 pb-24 space-y-6`}>
          <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2">
              Разделы настроек
            </p>
            <ModuleSegmentedControl
              variant="neutral"
              value={activeTab}
              onChange={(v) => setActiveTab(v)}
              options={SETTINGS_TABS.map((t) => ({
                value: t.id,
                label: t.label,
                icon: t.icon,
              }))}
              className="w-full max-w-full justify-start"
            />
          </div>
          <button
            type="button"
            onClick={() => setShowArchiveScreen(true)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 dark:border-[#333] text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#252525] shrink-0"
          >
            <Archive size={14} />
            Архив
          </button>
          </div>

          <div className="space-y-6">
          {showArchiveScreen ? (
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => setShowArchiveScreen(false)}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 dark:border-[#333] text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#252525]"
              >
                <ArrowLeft size={14} />
                Назад к настройкам
              </button>
              <ArchiveView 
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
          ) : (
          <>
          {activeTab === 'profile' && currentUser && <ProfileSettings activeTab="profile" currentUser={currentUser} users={users} onUpdateProfile={onUpdateProfile!} onUpdateUsers={onUpdateUsers} />}
          {activeTab === 'users' && <ProfileSettings activeTab="users" currentUser={currentUser!} users={users} onUpdateProfile={onUpdateProfile!} onUpdateUsers={onUpdateUsers} />}
          {activeTab === 'spaces' && <SpaceSettings activeTab="projects" tables={tables} projects={projects} statuses={statuses} priorities={priorities} onUpdateTable={onUpdateTable!} onCreateTable={onCreateTable!} onDeleteTable={onDeleteTable!} onUpdateProjects={onUpdateProjects} onUpdateStatuses={onUpdateStatuses} onUpdatePriorities={onUpdatePriorities} />}
          {activeTab === 'departments' && <DepartmentsView departments={departments} users={users} onSave={onSaveDepartment!} onDelete={onDeleteDepartment!} />}
          {activeTab === 'warehouses' && <WarehouseSettings warehouses={warehouses} departments={departments} onSave={onSaveWarehouse!} onDelete={onDeleteWarehouse!} />}
          {activeTab === 'finance-categories' && <FinanceCategoriesSettings categories={financeCategories} onSave={onSaveFinanceCategory!} onDelete={onDeleteFinanceCategory!} />}
          {activeTab === 'funds' && <FundsSettings funds={funds} onSave={onSaveFund!} onDelete={onDeleteFund!} />}
          {activeTab === 'sales-funnels' && <SalesFunnelsSettings funnels={salesFunnels} users={users} onSave={onSaveSalesFunnel!} onDelete={onDeleteSalesFunnel!} notificationPrefs={notificationPrefs} onUpdatePrefs={onUpdateNotificationPrefs} />}
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
          {activeTab === 'integrations' && (
            <IntegrationSettings
              activeTab="integrations"
              currentUser={currentUser}
              onSaveDeal={onSaveDeal}
            />
          )}
          {activeTab === 'system' && <SystemLogsSettings />}
          </>
          )}
          </div>
        </div>
      </div>
    </ModulePageShell>
  );
};

export default SettingsView;

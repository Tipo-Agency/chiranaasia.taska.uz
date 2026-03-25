
import React, { useState, useEffect } from 'react';
import { Project, Role, Task, User, StatusOption, PriorityOption, NotificationPreferences, AutomationRule, TableCollection, Deal, Department, FinanceCategory, Fund, SalesFunnel, Doc, ContentPost, EmployeeInfo, Client, Contract, BusinessProcess, Meeting, Warehouse } from '../types';
import { User as UserIcon, Briefcase, Archive, Users, Building2, Wallet, TrendingUp, PiggyBank, PlugZap, ShieldAlert, Settings, BellRing, Zap, Package, ArrowLeft } from 'lucide-react';
import { ModuleFilterIconButton, ModulePageHeader, ModulePageShell, ModuleSegmentedControl, MODULE_PAGE_GUTTER } from './ui';
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
import { ArchiveView } from './settings/ArchiveView';

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
      <div className={`${MODULE_PAGE_GUTTER} pt-6 md:pt-8 flex-shrink-0`}>
        <div className="mb-5">
          <ModulePageHeader
            accent="slate"
            icon={<Settings size={24} strokeWidth={2} />}
            title="Настройки"
            description=" "
            tabs={
              !showArchiveScreen ? (
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
              ) : null
            }
            controls={
              showArchiveScreen ? (
                <button
                  type="button"
                  onClick={() => setShowArchiveScreen(false)}
                  className="inline-flex items-center justify-center w-11 h-11 rounded-xl border border-gray-200 dark:border-[#333] bg-white dark:bg-[#1a1a1a] text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#252525]"
                  title="Назад"
                  aria-label="Назад"
                >
                  <ArrowLeft size={18} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowArchiveScreen(true)}
                  className="inline-flex items-center justify-center w-11 h-11 rounded-xl border border-gray-200 dark:border-[#333] bg-white dark:bg-[#1a1a1a] text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#252525]"
                  title="Архив"
                  aria-label="Архив"
                >
                  <Archive size={18} />
                </button>
              )
            }
          />
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        <div className={`${MODULE_PAGE_GUTTER} mt-3 pb-24 md:pb-32 h-full overflow-y-auto overflow-x-hidden custom-scrollbar`}>
          {showArchiveScreen ? (
            <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-2xl p-4 md:p-6">
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
    </ModulePageShell>
  );
};

export default SettingsView;

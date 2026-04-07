import React, { useEffect, useMemo, useState } from 'react';
import {
  AutomationRule,
  BusinessProcess,
  Client,
  Contract,
  Department,
  Deal,
  Doc,
  EmployeeInfo,
  FinanceCategory,
  Meeting,
  OrgPosition,
  Project,
  SalesFunnel,
  TableCollection,
  Task,
  User,
  ContentPost,
  StatusOption,
  PriorityOption,
} from '../../types';
import { ModuleSegmentedControl } from '../ui/ModuleSegmentedControl';

export type ArchiveTabId =
  | 'tasks'
  | 'users'
  | 'employees'
  | 'docs'
  | 'posts'
  | 'projects'
  | 'departments'
  | 'financeCategories'
  | 'salesFunnels'
  | 'tables'
  | 'businessProcesses'
  | 'deals'
  | 'clients'
  | 'contracts'
  | 'meetings'
  | 'orgPositions'
  | 'automationRules'
  | 'statuses'
  | 'priorities';

export const ARCHIVE_TAB_OPTIONS: Array<{ id: ArchiveTabId; label: string }> = [
  { id: 'tasks', label: 'Задачи' },
  { id: 'users', label: 'Пользователи' },
  { id: 'employees', label: 'Сотрудники' },
  { id: 'projects', label: 'Проекты' },
  { id: 'departments', label: 'Подразделения' },
  { id: 'financeCategories', label: 'Статьи расходов' },
  { id: 'salesFunnels', label: 'Воронки' },
  { id: 'tables', label: 'Таблицы' },
  { id: 'businessProcesses', label: 'Бизнес-процессы' },
  { id: 'orgPositions', label: 'Должности' },
  { id: 'automationRules', label: 'Автоматизация' },
  { id: 'statuses', label: 'Статусы задач' },
  { id: 'priorities', label: 'Приоритеты' },
  { id: 'deals', label: 'Сделки' },
  { id: 'clients', label: 'Клиенты' },
  { id: 'contracts', label: 'Договоры' },
  { id: 'docs', label: 'Документы' },
  { id: 'posts', label: 'Посты' },
  { id: 'meetings', label: 'Календарь' },
];

/**
 * Архив со вкладками: внутри разные сущности.
 * Разнесено отдельным компонентом, чтобы `SettingsView` не превращался в монолит.
 */
export const ArchiveView: React.FC<{
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
  orgPositions?: OrgPosition[];
  automationRules?: AutomationRule[];
  statusOptions?: StatusOption[];
  priorityOptions?: PriorityOption[];
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
  /** embedded — вкладки/хедер рисуются снаружи (в шапке модуля) */
  layout?: 'standalone' | 'embedded';
  activeTab?: ArchiveTabId;
  onTabChange?: (tab: ArchiveTabId) => void;
  query?: string;
}> = ({
  tasks,
  users: initialUsers = [],
  employees: initialEmployees = [],
  docs = [],
  posts = [],
  projects = [],
  departments = [],
  financeCategories = [],
  salesFunnels = [],
  tables = [],
  businessProcesses = [],
  deals = [],
  clients = [],
  contracts = [],
  meetings = [],
  orgPositions = [],
  automationRules = [],
  statusOptions = [],
  priorityOptions = [],
  onRestoreTask,
  onPermanentDelete,
  onRestoreUser,
  onRestoreEmployee,
  onRestoreDoc,
  onRestorePost,
  onRestoreProject,
  onRestoreDepartment,
  onRestoreFinanceCategory,
  onRestoreSalesFunnel,
  onRestoreTable,
  onRestoreBusinessProcess,
  onRestoreDeal,
  onRestoreClient,
  onRestoreContract,
  onRestoreMeeting,
  onRestoreOrgPosition,
  onRestoreAutomationRule,
  onRestoreStatus,
  onRestorePriority,
  layout = 'standalone',
  activeTab,
  onTabChange,
  query = ''
}) => {
  const [localTab, setLocalTab] = useState<ArchiveTabId>('tasks');
  const archiveTab = activeTab ?? localTab;
  const setArchiveTab = onTabChange ?? setLocalTab;

  const [allUsers, setAllUsers] = useState<User[]>(initialUsers);
  const [allEmployees, setAllEmployees] = useState<EmployeeInfo[]>(initialEmployees);

  const getEmployeeName = (employee: EmployeeInfo) => {
    const user = allUsers.find(u => u.id === employee.userId);
    return user ? user.name : `ID: ${employee.id}`;
  };

  // Загружаем всех пользователей и сотрудников (включая архивных) при открытии соответствующих вкладок
  useEffect(() => {
    if (archiveTab === 'users') {
      import('../../backend/api').then(({ api }) => {
        api.users
          .getAll()
          .then(users => setAllUsers(users))
          .catch(err => console.error('Ошибка загрузки пользователей:', err));
      });
    }
    if (archiveTab === 'employees') {
      import('../../backend/api').then(({ api }) => {
        api.employees
          .getAll()
          .then(employees => setAllEmployees(employees))
          .catch(err => console.error('Ошибка загрузки сотрудников:', err));
      });
    }
  }, [archiveTab]);

  const renderArchiveList = <T extends { id: string; isArchived?: boolean }>(
    items: T[],
    getLabel: (item: T) => string,
    onRestore?: (id: string) => void,
    emptyMessage: string = 'Архив пуст'
  ) => {
    const q = String(query || '').trim().toLowerCase();
    const archived = items
      .filter(item => item.isArchived)
      .filter(item => {
        if (!q) return true;
        const label = String(getLabel(item) || '').toLowerCase();
        return label.includes(q);
      });

    if (archived.length === 0) {
      return <p className="text-gray-500 dark:text-gray-400">{emptyMessage}</p>;
    }

    return archived.map(item => (
      <div
        key={item.id}
        className="flex justify-between items-center p-3 border border-gray-200 dark:border-[#333] rounded-lg"
      >
        <span className="text-sm text-gray-600 dark:text-gray-300">{getLabel(item)}</span>
        <div className="flex gap-2">
          {onRestore && (
            <button onClick={() => onRestore(item.id)} className="text-blue-600 hover:underline text-xs">
              Восстановить
            </button>
          )}
        </div>
      </div>
    ));
  };

  const emptyMessageByTab = useMemo(() => {
    switch (archiveTab) {
      case 'tasks': return 'Архив задач пуст';
      case 'users': return 'Архив пользователей пуст';
      case 'employees': return 'Архив сотрудников пуст';
      case 'projects': return 'Архив проектов пуст';
      case 'departments': return 'Архив подразделений пуст';
      case 'financeCategories': return 'Архив статей расходов пуст';
      case 'salesFunnels': return 'Архив воронок пуст';
      case 'tables': return 'Архив таблиц пуст';
      case 'businessProcesses': return 'Архив бизнес-процессов пуст';
      case 'orgPositions': return 'Архив должностей пуст';
      case 'automationRules': return 'Архив правил автоматизации пуст';
      case 'statuses': return 'Архив статусов пуст';
      case 'priorities': return 'Архив приоритетов пуст';
      case 'deals': return 'Архив сделок пуст';
      case 'clients': return 'Архив клиентов пуст';
      case 'contracts': return 'Архив договоров пуст';
      case 'docs': return 'Архив документов пуст';
      case 'posts': return 'Архив постов пуст';
      case 'meetings': return 'Архив встреч пуст';
      default: return 'Архив пуст';
    }
  }, [archiveTab]);

  const content = (
    <div className="space-y-2">
        {archiveTab === 'tasks' &&
          renderArchiveList<Task>(tasks, t => t.title, onRestoreTask, emptyMessageByTab)}
        {archiveTab === 'users' &&
          renderArchiveList<User>(allUsers, u => u.name, onRestoreUser, emptyMessageByTab)}
        {archiveTab === 'employees' &&
          renderArchiveList<EmployeeInfo>(
            allEmployees,
            e => getEmployeeName(e),
            onRestoreEmployee,
            emptyMessageByTab
          )}
        {archiveTab === 'projects' &&
          renderArchiveList<Project>(projects, p => p.name, onRestoreProject, emptyMessageByTab)}
        {archiveTab === 'departments' &&
          renderArchiveList<Department>(departments, d => d.name, onRestoreDepartment, emptyMessageByTab)}
        {archiveTab === 'financeCategories' &&
          renderArchiveList<FinanceCategory>(
            financeCategories,
            f => f.name,
            onRestoreFinanceCategory,
            emptyMessageByTab
          )}
        {archiveTab === 'salesFunnels' &&
          renderArchiveList<SalesFunnel>(
            salesFunnels,
            s => s.name,
            onRestoreSalesFunnel,
            emptyMessageByTab
          )}
        {archiveTab === 'tables' &&
          renderArchiveList<TableCollection>(tables, t => t.name, onRestoreTable, emptyMessageByTab)}
        {archiveTab === 'businessProcesses' &&
          renderArchiveList<BusinessProcess>(
            businessProcesses,
            b => b.title,
            onRestoreBusinessProcess,
            emptyMessageByTab
          )}
        {archiveTab === 'orgPositions' &&
          renderArchiveList<OrgPosition>(
            orgPositions,
            (p) => p.title,
            onRestoreOrgPosition,
            emptyMessageByTab
          )}
        {archiveTab === 'automationRules' &&
          renderArchiveList<AutomationRule>(
            automationRules,
            (r) => r.name,
            onRestoreAutomationRule,
            emptyMessageByTab
          )}
        {archiveTab === 'statuses' &&
          renderArchiveList<StatusOption>(
            statusOptions,
            (s) => s.name,
            onRestoreStatus,
            emptyMessageByTab
          )}
        {archiveTab === 'priorities' &&
          renderArchiveList<PriorityOption>(
            priorityOptions,
            (p) => p.name,
            onRestorePriority,
            emptyMessageByTab
          )}
        {archiveTab === 'deals' &&
          renderArchiveList<Deal>(deals, d => d.title || d.id, onRestoreDeal, emptyMessageByTab)}
        {archiveTab === 'clients' &&
          renderArchiveList<Client>(clients, c => c.name, onRestoreClient, emptyMessageByTab)}
        {archiveTab === 'contracts' &&
          renderArchiveList<Contract>(contracts, c => c.number || c.id, onRestoreContract, emptyMessageByTab)}
        {archiveTab === 'docs' && renderArchiveList<Doc>(docs, d => d.title, onRestoreDoc, emptyMessageByTab)}
        {archiveTab === 'posts' &&
          renderArchiveList<ContentPost>(posts, p => p.topic, onRestorePost, emptyMessageByTab)}
        {archiveTab === 'meetings' &&
          renderArchiveList<Meeting>(meetings, m => m.title, onRestoreMeeting, emptyMessageByTab)}
    </div>
  );

  if (layout === 'embedded') return content;

  return (
    <div className="space-y-4">
      <h3 className="font-bold text-lg text-gray-800 dark:text-white tracking-tight">Архив</h3>
      <ModuleSegmentedControl
        size="sm"
        variant="neutral"
        value={archiveTab}
        onChange={v => setArchiveTab(v as ArchiveTabId)}
        options={ARCHIVE_TAB_OPTIONS.map(t => ({ value: t.id, label: t.label }))}
        className="w-full max-w-full justify-start"
      />
      <div className="max-h-[60vh] overflow-y-auto">{content}</div>
    </div>
  );
};


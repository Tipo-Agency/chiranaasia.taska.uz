import React, { useEffect, useState } from 'react';
import {
  BusinessProcess,
  Client,
  Contract,
  Department,
  Deal,
  Doc,
  EmployeeInfo,
  FinanceCategory,
  Meeting,
  Project,
  SalesFunnel,
  TableCollection,
  Task,
  User,
  ContentPost
} from '../../types';
import { ModuleSegmentedControl } from '../ui/ModuleSegmentedControl';

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
  onRestoreMeeting
}) => {
  const [archiveTab, setArchiveTab] = useState<
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
  >('tasks');

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
    const archived = items.filter(item => item.isArchived);
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
    { id: 'meetings' as const, label: 'Встречи' }
  ];

  return (
    <div className="space-y-4">
      <h3 className="font-bold text-lg text-gray-800 dark:text-white tracking-tight">Архив</h3>

      <ModuleSegmentedControl
        variant="neutral"
        value={archiveTab}
        onChange={v => setArchiveTab(v as typeof archiveTab)}
        options={archiveTabOptions.map(t => ({ value: t.id, label: t.label }))}
        className="w-full max-w-full justify-start"
      />

      {/* Контент вкладок */}
      <div className="space-y-2 max-h-[60vh] overflow-y-auto">
        {archiveTab === 'tasks' &&
          renderArchiveList<Task>(tasks, t => t.title, onRestoreTask, 'Архив задач пуст')}
        {archiveTab === 'users' &&
          renderArchiveList<User>(allUsers, u => u.name, onRestoreUser, 'Архив пользователей пуст')}
        {archiveTab === 'employees' &&
          renderArchiveList<EmployeeInfo>(
            allEmployees,
            e => getEmployeeName(e),
            onRestoreEmployee,
            'Архив сотрудников пуст'
          )}
        {archiveTab === 'projects' &&
          renderArchiveList<Project>(projects, p => p.name, onRestoreProject, 'Архив проектов пуст')}
        {archiveTab === 'departments' &&
          renderArchiveList<Department>(departments, d => d.name, onRestoreDepartment, 'Архив подразделений пуст')}
        {archiveTab === 'financeCategories' &&
          renderArchiveList<FinanceCategory>(
            financeCategories,
            f => f.name,
            onRestoreFinanceCategory,
            'Архив статей расходов пуст'
          )}
        {archiveTab === 'salesFunnels' &&
          renderArchiveList<SalesFunnel>(
            salesFunnels,
            s => s.name,
            onRestoreSalesFunnel,
            'Архив воронок пуст'
          )}
        {archiveTab === 'tables' &&
          renderArchiveList<TableCollection>(tables, t => t.name, onRestoreTable, 'Архив таблиц пуст')}
        {archiveTab === 'businessProcesses' &&
          renderArchiveList<BusinessProcess>(
            businessProcesses,
            b => b.title,
            onRestoreBusinessProcess,
            'Архив бизнес-процессов пуст'
          )}
        {archiveTab === 'deals' &&
          renderArchiveList<Deal>(deals, d => d.title || d.id, onRestoreDeal, 'Архив сделок пуст')}
        {archiveTab === 'clients' &&
          renderArchiveList<Client>(clients, c => c.name, onRestoreClient, 'Архив клиентов пуст')}
        {archiveTab === 'contracts' &&
          renderArchiveList<Contract>(contracts, c => c.number || c.id, onRestoreContract, 'Архив договоров пуст')}
        {archiveTab === 'docs' && renderArchiveList<Doc>(docs, d => d.title, onRestoreDoc, 'Архив документов пуст')}
        {archiveTab === 'posts' &&
          renderArchiveList<ContentPost>(posts, p => p.topic, onRestorePost, 'Архив постов пуст')}
        {archiveTab === 'meetings' &&
          renderArchiveList<Meeting>(meetings, m => m.title, onRestoreMeeting, 'Архив встреч пуст')}
      </div>
    </div>
  );
};


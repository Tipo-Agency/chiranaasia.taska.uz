import React from 'react';
import { EmployeeInfo, User, Department, OrgPosition, BusinessProcess, Task, TableCollection } from '../../types';
import type { AppActions } from '../../frontend/hooks/useAppLogic';
import EmployeesView from '../EmployeesView';
import DepartmentsView from '../DepartmentsView';
import BusinessProcessesView from '../BusinessProcessesView';
import { PayrollModuleView } from '../PayrollModuleView';
import { MODULE_ACCENTS, MODULE_TOOLBAR_TAB_IDLE } from '../ui/moduleAccent';

interface HRModuleProps {
  view: 'employees' | 'departments' | 'business-processes';
  employeesHubTab?: 'team' | 'payroll';
  onEmployeesHubTabChange?: (tab: 'team' | 'payroll') => void;
  employees: EmployeeInfo[];
  users: User[];
  departments: Department[];
  orgPositions: OrgPosition[];
  processes: BusinessProcess[];
  tasks?: Task[];
  tables?: TableCollection[];
  currentUser?: User | null;
  actions: AppActions;
  autoOpenCreateModal?: boolean;
}

export const HRModule: React.FC<HRModuleProps> = ({
  view,
  employeesHubTab = 'team',
  onEmployeesHubTabChange,
  employees,
  users,
  departments,
  orgPositions,
  processes,
  tasks = [],
  tables = [],
  currentUser,
  actions,
  autoOpenCreateModal = false,
}) => {
    if (view === 'employees') {
        const hubTab = employeesHubTab;
        const setHub = onEmployeesHubTabChange ?? (() => {});
        const activeChip = MODULE_ACCENTS.orange.navIconActive;
        const idleChip = MODULE_TOOLBAR_TAB_IDLE;
        return (
            <div className="h-full min-h-0 flex flex-col bg-gray-50/50 dark:bg-[#191919]">
                <div className="shrink-0 flex items-center gap-1 px-3 sm:px-4 py-2 border-b border-gray-200 dark:border-[#333] bg-white/90 dark:bg-[#1f1f1f]/95">
                    <div
                        className="flex items-center gap-0.5 sm:gap-1 flex-wrap sm:flex-nowrap"
                        role="tablist"
                        aria-label="Сотрудники"
                    >
                        <button
                            type="button"
                            role="tab"
                            aria-selected={hubTab === 'team'}
                            onClick={() => setHub('team')}
                            className={`px-2 sm:px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                                hubTab === 'team' ? activeChip : idleChip
                            }`}
                        >
                            Сотрудники
                        </button>
                        <button
                            type="button"
                            role="tab"
                            aria-selected={hubTab === 'payroll'}
                            onClick={() => setHub('payroll')}
                            className={`px-2 sm:px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                                hubTab === 'payroll' ? activeChip : idleChip
                            }`}
                        >
                            Зарплата
                        </button>
                    </div>
                </div>
                <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                    {hubTab === 'payroll' ? (
                        <PayrollModuleView users={users} departments={departments} />
                    ) : (
                        <EmployeesView
                            employees={employees}
                            users={users}
                            departments={departments}
                            orgPositions={orgPositions}
                            onSave={actions.saveEmployee}
                            onDelete={actions.deleteEmployee}
                            onSavePosition={actions.savePosition}
                            onDeletePosition={actions.deletePosition}
                        />
                    )}
                </div>
            </div>
        );
    }
    if (view === 'departments') {
        return <DepartmentsView departments={departments} users={users} onSave={actions.saveDepartment} onDelete={actions.deleteDepartment} />;
    }
    if (view === 'business-processes') {
        return <BusinessProcessesView 
            processes={processes} 
            orgPositions={orgPositions}
            employees={employees}
            users={users} 
            tasks={tasks}
            tables={tables}
            currentUser={currentUser}
            onSaveProcess={actions.saveProcess} 
            onDeleteProcess={actions.deleteProcess}
            onSaveTask={actions.saveTask}
            onOpenTask={actions.openTaskModal}
            onCompleteProcessStepWithBranch={actions.completeProcessStepWithBranch}
            onSavePosition={actions.savePosition}
            autoOpenCreateModal={autoOpenCreateModal}
        />;
    }
    return null;
};

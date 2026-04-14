import React from 'react';
import { EmployeeInfo, User, Department, OrgPosition, BusinessProcess, Task, TableCollection } from '../../types';
import type { AppActions } from '../../frontend/hooks/useAppLogic';
import EmployeesView from '../EmployeesView';
import DepartmentsView from '../DepartmentsView';
import BusinessProcessesView from '../BusinessProcessesView';
import { PayrollModuleView } from '../PayrollModuleView';

interface HRModuleProps {
  view: 'employees' | 'departments' | 'business-processes' | 'payroll';
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

export const HRModule: React.FC<HRModuleProps> = ({ view, employees, users, departments, orgPositions, processes, tasks = [], tables = [], currentUser, actions, autoOpenCreateModal = false }) => {
    if (view === 'payroll') {
        return <PayrollModuleView users={users} departments={departments} />;
    }
    if (view === 'employees') {
        return <EmployeesView employees={employees} users={users} departments={departments} orgPositions={orgPositions} onSave={actions.saveEmployee} onDelete={actions.deleteEmployee} onSavePosition={actions.savePosition} onDeletePosition={actions.deletePosition} />;
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

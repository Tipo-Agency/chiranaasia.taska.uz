import React, { lazy, Suspense } from 'react';
import { RouteFallback } from '../components/ui/RouteFallback';
import type { AppRouterProps } from '../components/appRouterTypes';

const HRModuleLazy = lazy(() =>
  import('../components/modules/HRModule').then((m) => ({ default: m.HRModule }))
);

type HrRoutesViewProps = AppRouterProps & { hrView: 'employees' | 'business-processes' };

export function HrRoutesView(props: HrRoutesViewProps) {
  const { actions, hrView } = props;
  return (
    <Suspense fallback={<RouteFallback />}>
      <HRModuleLazy
        view={hrView}
        employeesHubTab={props.employeesHubTab ?? 'team'}
        onEmployeesHubTabChange={actions.setEmployeesHubTab}
        employees={props.employeeInfos}
        users={props.users}
        currentUser={props.currentUser}
        departments={props.departments}
        orgPositions={props.orgPositions}
        processes={props.businessProcesses}
        tasks={props.filteredTasks}
        tables={props.tables}
        actions={actions}
      />
    </Suspense>
  );
}

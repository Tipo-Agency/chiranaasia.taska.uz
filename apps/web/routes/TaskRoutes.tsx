import React, { lazy, Suspense } from 'react';
import { TasksPage } from '../components/pages/TasksPage';
import { SystemSearchView } from '../components/pages/SystemSearchView';
import TableView from '../components/TableView';
import { SpacesTabsView } from '../components/SpacesTabsView';
import { RouteFallback } from '../components/ui/RouteFallback';
import type { AppRouterProps } from '../components/appRouterTypes';

const SpaceModuleLazy = lazy(() =>
  import('../components/modules/SpaceModule').then((m) => ({ default: m.SpaceModule }))
);

type TaskRoutesViewProps = AppRouterProps & { view: string };

/**
 * Задачи, пространства, глобальный поиск, динамическая таблица — по ТЗ «TaskRoutes».
 */
export function TaskRoutesView(props: TaskRoutesViewProps) {
  const { view, actions } = props;

  if (view === 'tasks') {
    return (
      <TasksPage
        tasks={props.allTasks}
        headerSearchQuery={props.searchQuery}
        users={props.users}
        projects={props.projects}
        statuses={props.statuses}
        priorities={props.priorities}
        tables={props.tables}
        businessProcesses={props.businessProcesses}
        currentUser={props.currentUser}
        onUpdateTask={(id, updates) => actions.saveTask({ id, ...updates })}
        onDeleteTask={actions.deleteTask}
        onOpenTask={actions.openTaskModal}
        onCreateTask={() => actions.openTaskModal(null)}
      />
    );
  }

  if (view === 'spaces') {
    return (
      <SpacesTabsView
        tables={props.tables}
        currentUser={props.currentUser}
        activeTableId={props.activeTableId}
        currentView={props.currentView}
        initialTab={props.activeSpaceTab}
        onActiveSpaceTypeChange={(t) => actions.setActiveSpaceTab(t)}
        onSelectTable={(id) => {
          actions.setActiveTableId(id);
          actions.setCurrentView('table');
        }}
        onEditTable={actions.openEditTable}
        onDeleteTable={actions.deleteTable}
        onCreateTable={(type) => {
          actions.openCreateTable(type);
        }}
      />
    );
  }

  if (view === 'search') {
    return (
      <SystemSearchView
        query={props.searchQuery}
        tasks={props.allTasks}
        deals={props.deals}
        clients={props.clients}
        meetings={props.meetings}
        docs={props.docs}
        actions={actions}
      />
    );
  }

  if (view === 'table') {
    if (!props.activeTable) {
      return <div className="p-10 text-center text-gray-500">Страница не найдена. Выберите страницу из списка.</div>;
    }
    return (
      <Suspense fallback={<RouteFallback />}>
        <SpaceModuleLazy
          activeTable={props.activeTable}
          viewMode={props.viewMode}
          tasks={props.filteredTasks}
          users={props.users}
          currentUser={props.currentUser}
          projects={props.projects}
          statuses={props.statuses}
          priorities={props.priorities}
          tables={props.tables}
          docs={props.docs}
          folders={props.folders}
          meetings={props.meetings}
          contentPosts={props.contentPosts}
          shootPlans={props.shootPlans}
          businessProcesses={props.businessProcesses}
          clients={props.clients}
          deals={props.deals}
          notificationPrefs={props.notificationPrefs}
          actions={actions}
        />
      </Suspense>
    );
  }

  return null;
}

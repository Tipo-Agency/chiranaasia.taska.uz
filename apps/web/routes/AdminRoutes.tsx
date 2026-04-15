import React, { lazy, Suspense } from 'react';
import { RouteFallback } from '../components/ui/RouteFallback';
import type { AppRouterProps } from '../components/appRouterTypes';

const SettingsViewLazy = lazy(() => import('../components/SettingsView'));

/**
 * Настройки и админ-функции в одном экране (по ТЗ — AdminRoutes).
 */
export function AdminRoutesView(props: AppRouterProps) {
  const { actions } = props;
  return (
    <Suspense fallback={<RouteFallback />}>
      <SettingsViewLazy
        users={props.users}
        projects={props.projects}
        tasks={props.allTasks}
        statuses={props.statuses}
        priorities={props.priorities}
        tables={props.tables}
        automationRules={props.automationRules}
        currentUser={props.currentUser}
        departments={props.departments}
        docs={props.docs}
        contentPosts={props.contentPosts}
        financeCategories={props.financeCategories}
        funds={props.funds}
        employeeInfos={props.employeeInfos}
        deals={props.deals}
        clients={props.clients}
        contracts={props.contracts}
        meetings={props.meetings}
        salesFunnels={props.salesFunnels}
        productionPipelines={props.productionPipelines}
        onSaveProductionPipeline={actions.saveProductionPipeline}
        onDeleteProductionPipeline={actions.deleteProductionPipeline}
        businessProcesses={props.businessProcesses}
        orgPositions={props.orgPositions}
        onUpdateUsers={actions.updateUsers}
        onUpdateProjects={actions.updateProjects}
        onUpdateStatuses={actions.updateStatuses}
        onUpdatePriorities={actions.updatePriorities}
        onUpdateTable={actions.updateTable}
        onCreateTable={actions.openCreateTable}
        onDeleteTable={actions.deleteTable}
        onUpdateNotificationPrefs={actions.updateNotificationPrefs}
        onSaveAutomationRule={actions.saveAutomationRule}
        onDeleteAutomationRule={actions.deleteAutomationRule}
        onUpdateProfile={actions.updateProfile}
        onSaveDeal={actions.saveDeal}
        onClose={actions.closeSettings}
        initialTab={props.settingsActiveTab}
        onSaveDepartment={actions.saveDepartment}
        onDeleteDepartment={actions.deleteDepartment}
        onSaveFinanceCategory={actions.saveFinanceCategory}
        onDeleteFinanceCategory={actions.deleteFinanceCategory}
        onSaveFund={actions.saveFund}
        onDeleteFund={actions.deleteFund}
        onSaveWarehouse={actions.saveWarehouse}
        onDeleteWarehouse={actions.deleteWarehouse}
        warehouses={props.warehouses}
        onSaveSalesFunnel={actions.saveSalesFunnel}
        onDeleteSalesFunnel={actions.deleteSalesFunnel}
        notificationPrefs={props.notificationPrefs}
        onRestoreTask={actions.restoreTask}
        onPermanentDelete={actions.permanentDeleteTask}
        onRestoreUser={actions.restoreUser}
        onRestoreEmployee={actions.restoreEmployee}
        onRestoreDoc={actions.restoreDoc}
        onRestorePost={actions.restorePost}
        onRestoreProject={actions.restoreProject}
        onRestoreDepartment={actions.restoreDepartment}
        onRestoreFinanceCategory={actions.restoreFinanceCategory}
        onRestoreSalesFunnel={actions.restoreSalesFunnel}
        onRestoreTable={actions.restoreTable}
        onRestoreBusinessProcess={actions.restoreBusinessProcess}
        onRestoreDeal={actions.restoreDeal}
        onRestoreClient={actions.restoreClient}
        onRestoreContract={actions.restoreContract}
        onRestoreMeeting={actions.restoreMeeting}
        onRestoreOrgPosition={actions.restoreOrgPosition}
        onRestoreAutomationRule={actions.restoreAutomationRule}
        onRestoreStatus={actions.restoreStatus}
        onRestorePriority={actions.restorePriority}
      />
    </Suspense>
  );
}

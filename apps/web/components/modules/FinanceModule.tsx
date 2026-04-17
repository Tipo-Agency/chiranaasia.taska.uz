
import React from 'react';
import { FinanceCategory, FinancePlan, PurchaseRequest, Department, User, FinancialPlanDocument, FinancialPlanning, Bdr, IncomeReport } from '../../types';
import type { AppActions } from '../../frontend/hooks/useAppLogic';
import FinanceView from '../FinanceView';

interface FinanceModuleProps {
  categories: FinanceCategory[];
  plan: FinancePlan | null;
  requests: PurchaseRequest[];
  departments: Department[];
  users: User[];
  currentUser: User;
  financialPlanDocuments?: FinancialPlanDocument[];
  financialPlannings?: FinancialPlanning[];
  incomeReports?: IncomeReport[];
  bdr?: Bdr | null;
  actions: AppActions;
}

export const FinanceModule: React.FC<FinanceModuleProps> = ({ categories, plan, requests, departments, users, currentUser, financialPlanDocuments = [], financialPlannings = [], incomeReports = [], bdr = null, actions }) => {
    return (
        <div className="h-full min-h-0 flex flex-col">
        <FinanceView 
            categories={categories}
            plan={plan || {id:'p1', period:'month', salesPlan:0, currentIncome:0}} 
            requests={requests} 
            departments={departments} 
            users={users} 
            currentUser={currentUser}
            financialPlanDocuments={financialPlanDocuments}
            financialPlannings={financialPlannings}
            incomeReports={incomeReports}
            bdr={bdr}
            onRefreshIncomeReports={actions.refreshIncomeReports}
            onLoadBdr={actions.loadBdr}
            onSaveBdr={actions.saveBdr}
            onSaveRequest={actions.savePurchaseRequest} 
            onDeleteRequest={actions.deletePurchaseRequest}
            onSaveFinancialPlanDocument={actions.saveFinancialPlanDocument}
            onDeleteFinancialPlanDocument={actions.deleteFinancialPlanDocument}
            onSaveFinancialPlanning={actions.saveFinancialPlanning}
            onDeleteFinancialPlanning={actions.deleteFinancialPlanning}
            onRefreshPurchaseRequests={actions.refreshPurchaseRequests}
        />
        </div>
    );
};

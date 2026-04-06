
import React from 'react';
import { FinanceCategory, Fund, FinancePlan, PurchaseRequest, Department, User, FinancialPlanDocument, FinancialPlanning, Bdr } from '../../types';
import type { AppActions } from '../../frontend/hooks/useAppLogic';
import FinanceView from '../FinanceView';

interface FinanceModuleProps {
  categories: FinanceCategory[];
  funds: Fund[];
  plan: FinancePlan | null;
  requests: PurchaseRequest[];
  departments: Department[];
  users: User[];
  currentUser: User;
  financialPlanDocuments?: FinancialPlanDocument[];
  financialPlannings?: FinancialPlanning[];
  bdr?: Bdr | null;
  actions: AppActions;
}

export const FinanceModule: React.FC<FinanceModuleProps> = ({ categories, funds = [], plan, requests, departments, users, currentUser, financialPlanDocuments = [], financialPlannings = [], bdr = null, actions }) => {
    return (
        <div className="h-full min-h-0 flex flex-col">
        <FinanceView 
            categories={categories}
            funds={funds}
            plan={plan || {id:'p1', period:'month', salesPlan:0, currentIncome:0}} 
            requests={requests} 
            departments={departments} 
            users={users} 
            currentUser={currentUser}
            financialPlanDocuments={financialPlanDocuments}
            financialPlannings={financialPlannings}
            bdr={bdr}
            onLoadBdr={actions.loadBdr}
            onSaveBdr={actions.saveBdr}
            onSaveRequest={actions.savePurchaseRequest} 
            onDeleteRequest={actions.deletePurchaseRequest}
            onSaveFinancialPlanDocument={actions.saveFinancialPlanDocument}
            onDeleteFinancialPlanDocument={actions.deleteFinancialPlanDocument}
            onSaveFinancialPlanning={actions.saveFinancialPlanning}
            onDeleteFinancialPlanning={actions.deleteFinancialPlanning}
        />
        </div>
    );
};

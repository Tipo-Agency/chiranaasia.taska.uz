
import { useState } from 'react';
import { Department, FinanceCategory, Fund, FinancePlan, PurchaseRequest, FinancialPlanDocument, FinancialPlanning, Bdr } from '../../../types';
import { api } from '../../../backend/api';
import { createSaveHandler, createDeleteHandler } from '../../../utils/crudUtils';
import { NOTIFICATION_MESSAGES } from '../../../constants/messages';

export const useFinanceLogic = (showNotification: (msg: string) => void) => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [financeCategories, setFinanceCategories] = useState<FinanceCategory[]>([]);
  const [funds, setFunds] = useState<Fund[]>([]);
  const [financePlan, setFinancePlan] = useState<FinancePlan | null>(null);
  const [purchaseRequests, setPurchaseRequests] = useState<PurchaseRequest[]>([]);
  const [financialPlanDocuments, setFinancialPlanDocuments] = useState<FinancialPlanDocument[]>([]);
  const [financialPlannings, setFinancialPlannings] = useState<FinancialPlanning[]>([]);
  const [bdr, setBdr] = useState<Bdr | null>(null);

  // Departments
  const saveDepartment = createSaveHandler(
    setDepartments,
    api.departments.updateAll,
    showNotification,
    NOTIFICATION_MESSAGES.DEPARTMENT_SAVED
  );

  const deleteDepartment = createDeleteHandler(
    setDepartments,
    api.departments.updateAll,
    showNotification,
    NOTIFICATION_MESSAGES.DEPARTMENT_DELETED
  );

  // Finance Categories
  const saveFinanceCategory = createSaveHandler(
    setFinanceCategories,
    api.finance.updateCategories,
    showNotification,
    NOTIFICATION_MESSAGES.FINANCE_CATEGORY_SAVED
  );

  const deleteFinanceCategory = createDeleteHandler(
    setFinanceCategories,
    api.finance.updateCategories,
    showNotification,
    NOTIFICATION_MESSAGES.FINANCE_CATEGORY_DELETED
  );

  // Funds
  const saveFund = createSaveHandler(
    setFunds,
    api.finance.updateFunds,
    showNotification,
    NOTIFICATION_MESSAGES.FUND_SAVED
  );

  const deleteFund = createDeleteHandler(
    setFunds,
    api.finance.updateFunds,
    showNotification,
    NOTIFICATION_MESSAGES.FUND_DELETED
  );

  // Finance Plan
  const updateFinancePlan = (updates: Partial<FinancePlan>) => {
      const newPlan = { ...financePlan, ...updates } as FinancePlan;
      setFinancePlan(newPlan);
      api.finance.updatePlan(newPlan).catch(() => showNotification('Ошибка сохранения плана'));
      // showNotification('План обновлен'); // Too noisy for simple inputs
  };

  // Purchase Requests
  const savePurchaseRequest = createSaveHandler(
    setPurchaseRequests,
    api.finance.updateRequests,
    showNotification,
    NOTIFICATION_MESSAGES.PURCHASE_REQUEST_SAVED
  );

  const deletePurchaseRequest = createDeleteHandler(
    setPurchaseRequests,
    api.finance.updateRequests,
    showNotification,
    NOTIFICATION_MESSAGES.PURCHASE_REQUEST_DELETED
  );

  // Financial Plan Documents
  const saveFinancialPlanDocument = createSaveHandler(
    setFinancialPlanDocuments,
    api.finance.updateFinancialPlanDocuments,
    showNotification,
    NOTIFICATION_MESSAGES.FINANCIAL_PLAN_SAVED
  );

  const deleteFinancialPlanDocument = createDeleteHandler(
    setFinancialPlanDocuments,
    api.finance.updateFinancialPlanDocuments,
    showNotification,
    NOTIFICATION_MESSAGES.FINANCIAL_PLAN_DELETED
  );

  // Financial Planning
  const saveFinancialPlanning = createSaveHandler(
    setFinancialPlannings,
    api.finance.updateFinancialPlannings,
    showNotification,
    NOTIFICATION_MESSAGES.FINANCIAL_PLANNING_SAVED
  );

  const deleteFinancialPlanning = createDeleteHandler(
    setFinancialPlannings,
    api.finance.updateFinancialPlannings,
    showNotification,
    NOTIFICATION_MESSAGES.FINANCIAL_PLANNING_DELETED
  );

  const loadBdr = async (year?: string) => {
    const y = year || String(new Date().getFullYear());
    try {
      const data = await api.finance.getBdr(y);
      setBdr({ year: data.year, rows: (data.rows || []) as Bdr['rows'] });
    } catch {
      setBdr({ year: y, rows: [] });
    }
  };

  const saveBdr = async (payload: { year: string; rows: Bdr['rows'] }) => {
    await api.finance.updateBdr(payload);
    setBdr({ year: payload.year, rows: payload.rows });
    showNotification('БДР сохранён');
  };

  return {
    state: { departments, financeCategories, funds, financePlan, purchaseRequests, financialPlanDocuments, financialPlannings, bdr },
    setters: { setDepartments, setFinanceCategories, setFunds, setFinancePlan, setPurchaseRequests, setFinancialPlanDocuments, setFinancialPlannings, setBdr },
    actions: { 
        saveDepartment, deleteDepartment, 
        saveFinanceCategory, deleteFinanceCategory,
        saveFund, deleteFund,
        updateFinancePlan,
        savePurchaseRequest, deletePurchaseRequest,
        saveFinancialPlanDocument, deleteFinancialPlanDocument,
        saveFinancialPlanning, deleteFinancialPlanning,
        loadBdr, saveBdr
    }
  };
};

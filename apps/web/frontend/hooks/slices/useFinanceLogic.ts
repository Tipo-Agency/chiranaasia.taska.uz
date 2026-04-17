
import { useCallback, useState } from 'react';
import { Department, FinanceCategory, FinancePlan, PurchaseRequest, FinancialPlanDocument, FinancialPlanning, Bdr, IncomeReport } from '../../../types';
import { api } from '../../../backend/api';
import { createSaveHandler, createDeleteHandler, saveItem } from '../../../utils/crudUtils';
import { NOTIFICATION_MESSAGES } from '../../../constants/messages';

function financeRequestPostBody(item: PurchaseRequest): Record<string, unknown> {
  const title = (item.title && String(item.title).trim()) || 'Заявка';
  return {
    id: item.id,
    title,
    amount: String(item.amount),
    currency: item.currency ?? 'UZS',
    ...(item.category != null && item.category !== '' ? { category: item.category } : {}),
    ...(item.categoryId != null && item.categoryId !== '' ? { categoryId: item.categoryId } : {}),
    ...(item.counterparty != null && item.counterparty !== '' ? { counterparty: item.counterparty } : {}),
    ...(item.requestedBy || item.requesterId
      ? { requestedBy: item.requestedBy ?? item.requesterId, requesterId: item.requesterId ?? item.requestedBy }
      : {}),
    ...(item.departmentId ? { departmentId: item.departmentId } : {}),
    ...(item.comment != null && item.comment !== '' ? { comment: item.comment } : {}),
    ...(item.description != null && item.description !== '' ? { description: item.description } : {}),
    ...(item.paymentDate ? { paymentDate: item.paymentDate } : {}),
    ...(item.attachments?.length ? { attachments: item.attachments } : {}),
    ...(item.counterpartyInn ? { counterpartyInn: item.counterpartyInn } : {}),
    ...(item.invoiceNumber ? { invoiceNumber: item.invoiceNumber } : {}),
    ...(item.invoiceDate ? { invoiceDate: item.invoiceDate } : {}),
    status: item.status,
    isArchived: item.isArchived ?? false,
  };
}

/** Режим PATCH только статуса (без полного тела — иначе блокировка approved/paid на API). */
export type PurchaseRequestStatusPatchMode = 'approve' | 'reject' | 'submit' | 'paid';

export type SavePurchaseRequestOptions = {
  statusPatch?: PurchaseRequestStatusPatchMode;
  /** Обязателен при statusPatch === 'reject' */
  rejectComment?: string;
  /** Только вложения / ИНН / счёт (для одобренных и оплаченных заявок). */
  metadataOnly?: boolean;
};

function financeRequestPatchBody(item: PurchaseRequest): Record<string, unknown> {
  const title = item.title != null ? String(item.title).trim() : '';
  const b: Record<string, unknown> = {
    ...(title ? { title } : {}),
    amount: String(item.amount),
    ...(item.currency != null ? { currency: item.currency } : {}),
    ...(item.category !== undefined ? { category: item.category } : {}),
    ...(item.categoryId !== undefined ? { categoryId: item.categoryId } : {}),
    ...(item.counterparty !== undefined ? { counterparty: item.counterparty } : {}),
    ...(item.requestedBy !== undefined || item.requesterId !== undefined
      ? { requestedBy: item.requestedBy ?? item.requesterId, requesterId: item.requesterId ?? item.requestedBy }
      : {}),
    ...(item.departmentId !== undefined ? { departmentId: item.departmentId } : {}),
    ...(item.comment !== undefined ? { comment: item.comment } : {}),
    ...(item.description !== undefined ? { description: item.description } : {}),
    ...(item.paymentDate !== undefined ? { paymentDate: item.paymentDate } : {}),
    ...(item.attachments !== undefined ? { attachments: item.attachments ?? [] } : {}),
    ...(item.counterpartyInn !== undefined ? { counterpartyInn: item.counterpartyInn } : {}),
    ...(item.invoiceNumber !== undefined ? { invoiceNumber: item.invoiceNumber } : {}),
    ...(item.invoiceDate !== undefined ? { invoiceDate: item.invoiceDate } : {}),
    status: item.status,
    ...(item.isArchived !== undefined ? { isArchived: item.isArchived } : {}),
    ...(item.version != null && Number.isFinite(item.version) ? { version: item.version } : {}),
  };
  return Object.fromEntries(Object.entries(b).filter(([, v]) => v !== undefined));
}

function withRequestVersion(
  body: Record<string, unknown>,
  row: PurchaseRequest | null | undefined
): Record<string, unknown> {
  if (row?.version != null && Number.isFinite(row.version)) {
    return { ...body, version: row.version };
  }
  return body;
}

export const useFinanceLogic = (showNotification: (msg: string) => void) => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [financeCategories, setFinanceCategories] = useState<FinanceCategory[]>([]);
  const [financePlan, setFinancePlan] = useState<FinancePlan | null>(null);
  const [purchaseRequests, setPurchaseRequests] = useState<PurchaseRequest[]>([]);
  const [financialPlanDocuments, setFinancialPlanDocuments] = useState<FinancialPlanDocument[]>([]);
  const [financialPlannings, setFinancialPlannings] = useState<FinancialPlanning[]>([]);
  const [incomeReports, setIncomeReports] = useState<IncomeReport[]>([]);
  const [bdr, setBdr] = useState<Bdr | null>(null);

  const refreshIncomeReports = useCallback(async () => {
    try {
      const rows = await api.finance.getIncomeReports();
      setIncomeReports((rows || []) as IncomeReport[]);
    } catch {
      /* ignore */
    }
  }, []);

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

  // Finance Plan
  const updateFinancePlan = (updates: Partial<FinancePlan>) => {
      const newPlan = { ...financePlan, ...updates } as FinancePlan;
      setFinancePlan(newPlan);
      api.finance.updatePlan(newPlan).catch(() => showNotification('Ошибка сохранения плана'));
      // showNotification('План обновлен'); // Too noisy for simple inputs
  };

  const refreshPurchaseRequests = async () => {
    try {
      const list = await api.finance.getRequestsAll();
      setPurchaseRequests(list);
    } catch {
      /* ignore */
    }
  };

  // Purchase Requests (POST / PATCH, без PUT списком)
  const savePurchaseRequest = (item: PurchaseRequest, opts?: SavePurchaseRequestOptions) => {
    setPurchaseRequests((prevItems) => {
      const prevRow = prevItems.find((x) => x.id === item.id);
      const exists = !!prevRow;
      const optimistic =
        opts?.statusPatch === 'reject' && opts.rejectComment
          ? ({ ...item, status: 'rejected' as const, comment: opts.rejectComment.trim() } satisfies PurchaseRequest)
          : item;
      const updated = saveItem(prevItems, optimistic);
      void (async () => {
        try {
          if (exists) {
            if (opts?.metadataOnly) {
              await api.finance.patchRequest(
                item.id,
                withRequestVersion(
                  {
                    attachments: item.attachments ?? [],
                    counterpartyInn: item.counterpartyInn ?? null,
                    invoiceNumber: item.invoiceNumber ?? null,
                    invoiceDate: item.invoiceDate ?? null,
                  },
                  prevRow
                )
              );
              await refreshPurchaseRequests();
              return;
            }
            if (opts?.statusPatch === 'reject' && opts.rejectComment) {
              const body: Record<string, unknown> = {
                status: 'rejected',
                comment: opts.rejectComment.trim(),
              };
              if (item.departmentId) body.departmentId = item.departmentId;
              await api.finance.patchRequest(item.id, withRequestVersion(body, prevRow));
            } else if (opts?.statusPatch === 'approve') {
              await api.finance.patchRequest(item.id, withRequestVersion({ status: 'approved' }, prevRow));
            } else if (opts?.statusPatch === 'paid') {
              await api.finance.patchRequest(item.id, withRequestVersion({ status: 'paid' }, prevRow));
            } else if (opts?.statusPatch === 'submit') {
              await api.finance.patchRequest(item.id, withRequestVersion({ status: 'pending' }, prevRow));
            } else if (
              prevRow &&
              (prevRow.status === 'approved' || prevRow.status === 'paid') &&
              prevRow.isArchived !== item.isArchived
            ) {
              await api.finance.patchRequest(
                item.id,
                withRequestVersion({ isArchived: item.isArchived }, prevRow)
              );
            } else {
              await api.finance.patchRequest(item.id, financeRequestPatchBody(item));
            }
          } else {
            await api.finance.postRequest(financeRequestPostBody(item));
          }
        } catch {
          showNotification('Ошибка сохранения. Проверьте подключение и повторите.');
        }
      })();
      showNotification(NOTIFICATION_MESSAGES.PURCHASE_REQUEST_SAVED);
      return updated;
    });
  };

  const deletePurchaseRequest = (id: string) => {
    const row = purchaseRequests.find((x) => x.id === id);
    setPurchaseRequests((prevItems) =>
      prevItems.map((item) => (item.id === id ? { ...item, isArchived: true } : item))
    );
    void api.finance
      .patchRequest(id, withRequestVersion({ isArchived: true }, row))
      .catch(() => {
      showNotification('Ошибка удаления. Проверьте подключение и повторите.');
    });
    showNotification(NOTIFICATION_MESSAGES.PURCHASE_REQUEST_DELETED);
  };

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
      setBdr({
        year: data.year,
        rows: (data.rows || []) as Bdr['rows'],
        totals: data.totals,
      });
    } catch {
      setBdr({ year: y, rows: [] });
    }
  };

  const saveBdr = async (payload: { year: string; rows: Bdr['rows'] }) => {
    try {
      const data = await api.finance.updateBdr({ year: payload.year, rows: payload.rows });
      setBdr({
        year: data.year,
        rows: (data.rows || []) as Bdr['rows'],
        totals: data.totals,
      });
      showNotification('БДР сохранён');
    } catch {
      showNotification('Ошибка сохранения БДР');
    }
  };

  return {
    state: { departments, financeCategories, financePlan, purchaseRequests, financialPlanDocuments, financialPlannings, incomeReports, bdr },
    setters: { setDepartments, setFinanceCategories, setFinancePlan, setPurchaseRequests, setFinancialPlanDocuments, setFinancialPlannings, setIncomeReports, setBdr },
    actions: { 
        saveDepartment, deleteDepartment, 
        saveFinanceCategory, deleteFinanceCategory,
        updateFinancePlan,
        savePurchaseRequest, deletePurchaseRequest, refreshPurchaseRequests,
        saveFinancialPlanDocument, deleteFinancialPlanDocument,
        saveFinancialPlanning, deleteFinancialPlanning,
        refreshIncomeReports,
        loadBdr, saveBdr
    }
  };
};

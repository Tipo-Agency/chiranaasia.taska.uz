export interface FinanceCategory {
  id: string;
  name: string;
  type: 'fixed' | 'percent';
  color?: string;
  value?: number;
  /** Порядок в справочнике и в бюджете. */
  order?: number;
  isArchived?: boolean;
  updatedAt?: string;
}

export interface FinancePlan {
  id: string;
  period: 'week' | 'month';
  salesPlan: number;
  currentIncome: number;
}

/** Вложение к заявке (PDF счёта и т.д.) для сверки с выпиской */
export interface FinanceRequestAttachmentMeta {
  id: string;
  name: string;
  url: string;
  type: string;
  uploadedAt?: string;
  storagePath?: string;
}

export interface PurchaseRequest {
  id: string;
  title?: string;
  amount: string | number;
  currency?: string;
  category?: string;
  categoryId?: string;
  counterparty?: string | null;
  requestedBy?: string;
  requesterId?: string;
  approvedBy?: string | null;
  status: 'draft' | 'pending' | 'approved' | 'rejected' | 'paid' | 'deferred';
  comment?: string;
  description?: string;
  date?: string;
  paymentDate?: string;
  paidAt?: string | null;
  decisionDate?: string;
  departmentId?: string;
  isArchived?: boolean;
  /** Optimistic locking для PATCH /finance/requests/{id}. */
  version?: number;
  attachments?: FinanceRequestAttachmentMeta[];
  /** ИНН контрагента — для поиска в назначении платежа в выписке */
  counterpartyInn?: string;
  invoiceNumber?: string;
  /** Дата счёта (YYYY-MM-DD) */
  invoiceDate?: string;
}

/** Одна неделя внутри месячного документа плана (не отдельный план в списке). */
export interface FinancialPlanWeekSlice {
  start: string;
  end: string;
  label?: string;
  income: number;
  expenses: Record<string, number>;
}

export interface FinancialPlanDocument {
  id: string;
  departmentId: string;
  period: string;
  periodStart?: string;
  periodEnd?: string;
  income: number;
  expenses: Record<string, number>;
  status: 'created' | 'conducted' | 'approved';
  createdAt: string;
  updatedAt?: string;
  approvedBy?: string;
  approvedAt?: string;
  isArchived?: boolean;
  /** Группа недельных срезов одного месяца (один department + месяц). */
  planSeriesId?: string;
  periodLabel?: string;
  /** Срезы по неделям внутри одного документа; итог месяца — поля income / expenses выше. */
  weekBreakdown?: FinancialPlanWeekSlice[];
}

/** Движение между фондами внутри бюджета (перераспределение / «заём»). */
export interface FinancialPlanningFundMovement {
  id: string;
  fromFundId: string;
  toFundId: string;
  amount: number;
  note?: string;
  at: string;
}

export interface FinancialPlanning {
  id: string;
  departmentId: string;
  period: string;
  periodStart?: string;
  periodEnd?: string;
  planDocumentId?: string;
  /** Несколько планов (например по неделям), суммарно по числу периодов. */
  planDocumentIds?: string[];
  income?: number;
  fundAllocations?: Record<string, number>;
  requestFundIds?: Record<string, string>;
  requestIds: string[];
  status: 'created' | 'conducted' | 'approved';
  createdAt: string;
  updatedAt?: string;
  approvedBy?: string;
  approvedAt?: string;
  notes?: string;
  isArchived?: boolean;
  /** Справка о доходах (месяц); блокируется при проведённом/утверждённом бюджете. */
  incomeReportId?: string | null;
  /** Несколько справок, привязанных к бюджету (например по неделям). */
  incomeReportIds?: string[];
  fundMovements?: FinancialPlanningFundMovement[];
  /** Распределение дохода по статьям (UZS), по данным планов. */
  expenseDistribution?: Record<string, number>;
}

/** Справка о доходах по дням (модуль «Выписки»). */
export interface IncomeReport {
  id: string;
  period: string;
  data: Record<string, number>;
  createdAt?: string;
  updatedAt?: string;
  lockedByPlanningId?: string | null;
}

export interface BdrRow {
  id: string;
  name: string;
  type: 'income' | 'expense';
  amounts: Record<string, number>;
}

export interface BdrTotalsMonth {
  income: number;
  expense: number;
  profit: number;
}

export interface BdrTotals {
  byMonth: Record<string, BdrTotalsMonth>;
  year: { income: number; expense: number; profit: number };
}

export interface Bdr {
  year: string;
  rows: BdrRow[];
  totals?: BdrTotals;
}

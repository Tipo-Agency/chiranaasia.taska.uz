export interface FinanceCategory {
  id: string;
  name: string;
  type: 'fixed' | 'percent';
  color?: string;
  value?: number;
  isArchived?: boolean;
  updatedAt?: string;
}

export interface FinancePlan {
  id: string;
  period: 'week' | 'month';
  salesPlan: number;
  currentIncome: number;
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
}

export interface Fund {
  id: string;
  name: string;
  order?: number;
  isArchived?: boolean;
}

export interface FinancialPlanning {
  id: string;
  departmentId: string;
  period: string;
  periodStart?: string;
  periodEnd?: string;
  planDocumentId?: string;
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

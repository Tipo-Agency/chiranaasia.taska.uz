
import React, { useState, useRef, useMemo, useEffect, useCallback, useLayoutEffect } from 'react';
import {
  FinanceCategory,
  Fund,
  FinancePlan,
  PurchaseRequest,
  Department,
  User,
  FinancialPlanDocument,
  FinancialPlanWeekSlice,
  FinancialPlanning,
  Bdr,
  IncomeReport,
} from '../types';
import type { SavePurchaseRequestOptions } from '../frontend/hooks/slices/useFinanceLogic';
import { hasPermission } from '../utils/permissions';
import { Plus, X, Edit2, Trash2, PieChart, TrendingUp, DollarSign, Check, AlertCircle, Calendar, Settings, ArrowLeft, ArrowRight, Save, FileText, Clock, CheckCircle2, ChevronDown, Upload, Archive, RotateCcw, Printer } from 'lucide-react';
import {
  Button,
  ModulePageShell,
  MODULE_PAGE_GUTTER,
  MODULE_PAGE_TOP_PAD,
  ModuleCreateDropdown,
  ModuleFilterIconButton,
  DateInput,
  ModuleSegmentedControl,
  SystemAlertDialog,
  APP_TOOLBAR_MODULE_CLUSTER,
  MODULE_ACCENTS,
  MODULE_TOOLBAR_TAB_IDLE,
  EntitySearchSelect,
} from './ui';
import { useAppToolbar } from '../contexts/AppToolbarContext';
import { BankStatementsView, type BankStatementsViewHandle } from './finance/BankStatementsView';
import { BdrView } from './finance/BdrView';
import { FilterConfig } from './FiltersPanel';
import { uploadFile } from '../services/localStorageService';
import { allocateMonthPlanToWeekSlices, getMajorityBasedMonthBounds } from '../utils/financeMonthWeeks';
import {
  sumIncomeReportInRange,
  sumIncomeReportsInRange,
  distributeIncomeFromPlanDocuments,
  approvedAmountByFund,
  parseRequestAmountUzs,
  fundAvailableBalances,
} from '../utils/financePlanningUtils';
import { moneyToTiyin, mulPercentMoney, subtractMoney, sumMoney } from '../utils/uzsMoney';

function requestAmountLabel(amount: PurchaseRequest['amount']): string {
  const raw = (
    typeof amount === 'number' && !Number.isNaN(amount) ? String(amount) : String(amount ?? '0')
  )
    .trim()
    .replace(/\s/g, '')
    .replace(/,/g, '.');
  const neg = raw.startsWith('-');
  const [intPart, frac = ''] = (neg ? raw.slice(1) : raw).split('.');
  const digits = intPart.replace(/\D/g, '') || '0';
  try {
    const n = BigInt(digits);
    const fmt = n.toLocaleString('ru-RU');
    const f = frac.replace(/\D/g, '').slice(0, 2);
    return f ? `${neg ? '−' : ''}${fmt}.${f}` : `${neg ? '−' : ''}${fmt}`;
  } catch {
    return raw || '0';
  }
}

function normalizeRequestStatusForFilter(req: PurchaseRequest): string {
  return req.status === 'deferred' ? 'draft' : req.status;
}

/**
 * YYYY-MM якоря плана/бюджета: не выводить из periodStart — при разбиении по неделям
 * «по большинству дней» дата начала может попадать в предыдущий календарный месяц.
 */
function canonicalFinancialMonthYm(
  anchorPeriod: string | undefined,
  periodStart: string | undefined,
  fallbackYm: string
): string {
  const p = String(anchorPeriod ?? '').trim();
  if (/^\d{4}-\d{2}$/.test(p)) return p;
  const fromStart = String(periodStart ?? '').trim().slice(0, 7);
  if (/^\d{4}-\d{2}$/.test(fromStart)) return fromStart;
  return String(fallbackYm ?? '').trim();
}

function sumRequestAmountsUzs(list: PurchaseRequest[]): string {
  let sum = BigInt(0);
  for (const r of list) {
    const s = String(r.amount ?? '0').replace(/\s/g, '').replace(/,/g, '.');
    const neg = s.startsWith('-');
    const [intPart] = (neg ? s.slice(1) : s).split('.');
    const digits = intPart.replace(/\D/g, '') || '0';
    sum += BigInt(digits);
  }
  return sum.toLocaleString('ru-RU');
}

interface FinanceViewProps {
  categories: FinanceCategory[];
  funds: Fund[];
  plan: FinancePlan;
  requests: PurchaseRequest[];
  departments: Department[];
  users: User[];
  currentUser: User;
  financialPlanDocuments?: FinancialPlanDocument[];
  financialPlannings?: FinancialPlanning[];
  incomeReports?: IncomeReport[];
  bdr?: Bdr | null;
  onLoadBdr?: (year?: string) => Promise<void>;
  onSaveBdr?: (payload: { year: string; rows: Bdr['rows'] }) => Promise<void>;
  onSaveRequest: (req: PurchaseRequest, opts?: SavePurchaseRequestOptions) => void;
  onDeleteRequest: (id: string) => void;
  onSaveFinancialPlanDocument?: (doc: FinancialPlanDocument) => void;
  onDeleteFinancialPlanDocument?: (id: string) => void;
  onSaveFinancialPlanning?: (planning: FinancialPlanning) => void;
  onDeleteFinancialPlanning?: (id: string) => void;
  onRefreshPurchaseRequests?: () => void | Promise<void>;
  onRefreshIncomeReports?: () => void | Promise<void>;
}

const FinanceView: React.FC<FinanceViewProps> = ({ 
    categories, funds = [], plan, requests, departments, users, currentUser,
    financialPlanDocuments = [], financialPlannings = [], incomeReports = [], bdr = null,
    onLoadBdr, onSaveBdr,
    onSaveRequest, onDeleteRequest,
    onSaveFinancialPlanDocument, onDeleteFinancialPlanDocument, onSaveFinancialPlanning, onDeleteFinancialPlanning,
    onRefreshPurchaseRequests,
    onRefreshIncomeReports,
}) => {
  const { setLeading, setModule } = useAppToolbar();
  const [activeTab, setActiveTab] = useState<'planning' | 'requests' | 'plan' | 'statements' | 'bdr'>('planning');
  
  // Состояния для детальных страниц
  const [selectedPlanning, setSelectedPlanning] = useState<FinancialPlanning | null>(null);
  const [selectedPlanDoc, setSelectedPlanDoc] = useState<FinancialPlanDocument | null>(null);
  
  // Фильтры для финансовых планирований
  const [planningStatusFilter, setPlanningStatusFilter] = useState<'all' | 'created' | 'conducted' | 'approved'>('all');
  const [planningDepartmentFilter, setPlanningDepartmentFilter] = useState<string>('all');
  const [showApprovedPlannings, setShowApprovedPlannings] = useState<string>('hide'); // 'hide' или 'show'
  const [showPlanningFilters, setShowPlanningFilters] = useState(false);
  
  // Фильтры для финансовых планов
  const [planStatusFilter, setPlanStatusFilter] = useState<'all' | 'created' | 'conducted' | 'approved'>('all');
  const [planDepartmentFilter, setPlanDepartmentFilter] = useState<string>('all');
  const [showApprovedPlans, setShowApprovedPlans] = useState<string>('hide'); // 'hide' или 'show'
  const [showPlanFilters, setShowPlanFilters] = useState(false);
  
  // Фильтры для заявок
  const [requestStatusFilter, setRequestStatusFilter] = useState<
    'all' | 'draft' | 'pending' | 'approved' | 'rejected' | 'paid'
  >('all');
  const [requestDepartmentFilter, setRequestDepartmentFilter] = useState<string>('all');
  const [requestCategoryFilter, setRequestCategoryFilter] = useState<string>('all');
  const [showRequestFilters, setShowRequestFilters] = useState(false);
  /** Активные записи vs архив — только в модуле «Финансы», не в Settings → Архив */
  const [financeArchiveScope, setFinanceArchiveScope] = useState<'active' | 'archived'>('active');
  
  /** Список | полноэкранное создание | полноэкранная карточка сущности */
  const [planningSubView, setPlanningSubView] = useState<'list' | 'create' | 'detail'>('list');
  const [planSubView, setPlanSubView] = useState<'list' | 'create' | 'detail'>('list');

  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [editingRequest, setEditingRequest] = useState<PurchaseRequest | null>(null);
  const [alertText, setAlertText] = useState<string | null>(null);
  const bankStatementsRef = useRef<BankStatementsViewHandle>(null);
  /** Текущий календарный месяц (yyyy-mm) для планов и планирования — пересчитывается на каждом рендере (без «залипания» на месяце открытия вкладки). */
  const now = new Date();
  const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [statementFiltersOpen, setStatementFiltersOpen] = useState(true);

  // Формы
  const [reqAmount, setReqAmount] = useState('');
  const [reqDesc, setReqDesc] = useState('');
  const [reqDep, setReqDep] = useState('');
  const [reqCat, setReqCat] = useState('');
  const [reqPaymentDate, setReqPaymentDate] = useState('');
  const [reqTitle, setReqTitle] = useState('');
  const [reqInn, setReqInn] = useState('');
  const [reqInvoiceNumber, setReqInvoiceNumber] = useState('');
  const [reqInvoiceDate, setReqInvoiceDate] = useState('');
  const [reqAttachments, setReqAttachments] = useState<NonNullable<PurchaseRequest['attachments']>>([]);
  const [createRequestId, setCreateRequestId] = useState('');
  const reqAttachInputRef = useRef<HTMLInputElement>(null);

  const getDefaultRangeForMonth = useCallback((yyyyMm: string) => {
    const trimmed = (yyyyMm || '').trim();
    const majority = getMajorityBasedMonthBounds(trimmed);
    if (majority) return majority;
    const d = new Date(`${trimmed}-01T00:00:00`);
    const start = new Date(d.getFullYear(), d.getMonth(), 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    const toIso = (x: Date) => x.toISOString().slice(0, 10);
    return { start: toIso(start), end: toIso(end) };
  }, []);

  const formatRangeLabel = useCallback((startIso?: string, endIso?: string, fallbackPeriod?: string) => {
    try {
      if (startIso && endIso) {
        const s = new Date(`${startIso}T00:00:00`);
        const e = new Date(`${endIso}T00:00:00`);
        const fmt = (x: Date) =>
          x.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '.');
        return `${fmt(s)} — ${fmt(e)}`;
      }
    } catch {
      // ignore
    }
    if (fallbackPeriod) {
      try {
        const periodDate = new Date(`${fallbackPeriod}-01T00:00:00`);
        return periodDate.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
      } catch {
        // ignore
      }
    }
    return '—';
  }, []);

  const planDocRowPeriodLabel = useCallback(
    (planDoc: FinancialPlanDocument) => {
      const base = formatRangeLabel(planDoc.periodStart, planDoc.periodEnd, planDoc.period);
      const n = planDoc.weekBreakdown?.length;
      if (n && n > 1) return `${base} · ${n} нед.`;
      return base;
    },
    [formatRangeLabel]
  );

  // Инициализируем текущий период (используем как дефолт при создании)

  useEffect(() => {
    if (planningSubView === 'detail' && !selectedPlanning) setPlanningSubView('list');
  }, [planningSubView, selectedPlanning]);
  useEffect(() => {
    if (planSubView === 'detail' && !selectedPlanDoc) setPlanSubView('list');
  }, [planSubView, selectedPlanDoc]);

  const financeFullScreen =
    (activeTab === 'planning' && planningSubView !== 'list') ||
    (activeTab === 'plan' && planSubView !== 'list');
  
  // Состояния для детальной страницы планирования
  const planningDetailInitialValuesRef = useRef<{
    requestIds: string[];
    notes?: string;
    income?: number;
    departmentId?: string;
    periodStart?: string;
    periodEnd?: string;
    fundAllocations?: Record<string, number>;
    requestFundIds?: Record<string, string>;
    planDocumentIds?: string[];
    incomeReportId?: string;
    incomeReportIds?: string[];
    expenseDistribution?: Record<string, number>;
    fundMovements?: NonNullable<FinancialPlanning['fundMovements']>;
  } | null>(null);
  const [planningDetailDepartmentId, setPlanningDetailDepartmentId] = useState('');
  const [planningDetailPeriodStart, setPlanningDetailPeriodStart] = useState('');
  const [planningDetailPeriodEnd, setPlanningDetailPeriodEnd] = useState('');
  const [planningDetailRequestIds, setPlanningDetailRequestIds] = useState<string[]>([]);
  const [planningDetailNotes, setPlanningDetailNotes] = useState('');
  const [planningDetailIncome, setPlanningDetailIncome] = useState<number>(0);
  const [planningDetailFundAllocations, setPlanningDetailFundAllocations] = useState<Record<string, number>>({});
  const [planningDetailRequestFundIds, setPlanningDetailRequestFundIds] = useState<Record<string, string>>({});
  const [planningDetailPlanDocumentIds, setPlanningDetailPlanDocumentIds] = useState<string[]>([]);
  const [planningDetailIncomeReportIds, setPlanningDetailIncomeReportIds] = useState<string[]>([]);
  const [planningDetailExpenseDistribution, setPlanningDetailExpenseDistribution] = useState<Record<string, number>>({});
  const [planningDetailFundMovements, setPlanningDetailFundMovements] = useState<NonNullable<FinancialPlanning['fundMovements']>>([]);
  const [planningFundTransferOpen, setPlanningFundTransferOpen] = useState(false);
  const [fundTransferFrom, setFundTransferFrom] = useState('');
  const [fundTransferTo, setFundTransferTo] = useState('');
  const [fundTransferAmount, setFundTransferAmount] = useState('');
  
  // Состояния для детальной страницы плана
  const planDetailInitialValuesRef = useRef<{
    income: number;
    expenses: Record<string, number>;
    selectedCategories: string[];
    departmentId?: string;
    periodStart?: string;
    periodEnd?: string;
    weekBreakdown: FinancialPlanWeekSlice[];
  } | null>(null);
  const [planDetailDepartmentId, setPlanDetailDepartmentId] = useState('');
  const [planDetailPeriodStart, setPlanDetailPeriodStart] = useState('');
  const [planDetailPeriodEnd, setPlanDetailPeriodEnd] = useState('');
  const [planDetailIncome, setPlanDetailIncome] = useState(0);
  const [planDetailExpenses, setPlanDetailExpenses] = useState<Record<string, number>>({});
  const [planDetailSelectedCategories, setPlanDetailSelectedCategories] = useState<string[]>([]);
  /** Дропдаун «Добавить статью» на детальной странице плана — хуки на уровне FinanceView (нельзя в renderPlanDetail: React #310). */
  const [planDetailCategoryDropdownOpen, setPlanDetailCategoryDropdownOpen] = useState(false);
  const planDetailCategoryDropdownRef = useRef<HTMLDivElement>(null);
  const [planDetailWeekBreakdown, setPlanDetailWeekBreakdown] = useState<FinancialPlanWeekSlice[]>([]);
  
  // Синхронизация состояний детальных страниц при изменении выбранных элементов
  useEffect(() => {
    if (selectedPlanning) {
      const fallback = getDefaultRangeForMonth(selectedPlanning.period || currentPeriod);
      const pids = (selectedPlanning.planDocumentIds?.length ? selectedPlanning.planDocumentIds : selectedPlanning.planDocumentId ? [selectedPlanning.planDocumentId] : []);
      const irRaw = [...(selectedPlanning.incomeReportIds || [])];
      const irSingle = (selectedPlanning.incomeReportId || '').trim();
      const incomeReportIdsMerged = irSingle && !irRaw.includes(irSingle) ? [irSingle, ...irRaw] : irRaw.length ? irRaw : irSingle ? [irSingle] : [];
      planningDetailInitialValuesRef.current = {
        requestIds: selectedPlanning.requestIds,
        notes: selectedPlanning.notes,
        income: selectedPlanning.income ?? 0,
        departmentId: selectedPlanning.departmentId,
        periodStart: selectedPlanning.periodStart || fallback.start,
        periodEnd: selectedPlanning.periodEnd || fallback.end,
        fundAllocations: selectedPlanning.fundAllocations ?? {},
        requestFundIds: selectedPlanning.requestFundIds ?? {},
        planDocumentIds: pids,
        incomeReportId: incomeReportIdsMerged[0] || '',
        incomeReportIds: incomeReportIdsMerged,
        expenseDistribution: selectedPlanning.expenseDistribution ?? {},
        fundMovements: selectedPlanning.fundMovements ?? [],
      };
      setPlanningDetailDepartmentId(selectedPlanning.departmentId || '');
      setPlanningDetailPeriodStart(selectedPlanning.periodStart || fallback.start);
      setPlanningDetailPeriodEnd(selectedPlanning.periodEnd || fallback.end);
      setPlanningDetailRequestIds(selectedPlanning.requestIds);
      setPlanningDetailNotes(selectedPlanning.notes || '');
      setPlanningDetailIncome(selectedPlanning.income ?? 0);
      setPlanningDetailFundAllocations(selectedPlanning.fundAllocations ?? {});
      setPlanningDetailRequestFundIds(selectedPlanning.requestFundIds ?? {});
      setPlanningDetailPlanDocumentIds(pids);
      setPlanningDetailIncomeReportIds(incomeReportIdsMerged);
      setPlanningDetailExpenseDistribution(selectedPlanning.expenseDistribution ?? {});
      setPlanningDetailFundMovements(selectedPlanning.fundMovements ?? []);
    } else {
      planningDetailInitialValuesRef.current = null;
      setPlanningDetailDepartmentId('');
      setPlanningDetailPeriodStart('');
      setPlanningDetailPeriodEnd('');
      setPlanningDetailRequestIds([]);
      setPlanningDetailNotes('');
      setPlanningDetailIncome(0);
      setPlanningDetailFundAllocations({});
      setPlanningDetailRequestFundIds({});
      setPlanningDetailPlanDocumentIds([]);
      setPlanningDetailIncomeReportIds([]);
      setPlanningDetailExpenseDistribution({});
      setPlanningDetailFundMovements([]);
    }
  }, [selectedPlanning]);
  
  useEffect(() => {
    if (selectedPlanDoc) {
      const fallback = getDefaultRangeForMonth(selectedPlanDoc.period || currentPeriod);
      const selectedCats = Object.keys(selectedPlanDoc.expenses || {});
      const wb =
        selectedPlanDoc.weekBreakdown && Array.isArray(selectedPlanDoc.weekBreakdown)
          ? selectedPlanDoc.weekBreakdown.map((w) => ({ ...w, expenses: { ...(w.expenses || {}) } }))
          : [];
      planDetailInitialValuesRef.current = {
        income: selectedPlanDoc.income || 0,
        expenses: selectedPlanDoc.expenses || {},
        selectedCategories: selectedCats,
        departmentId: selectedPlanDoc.departmentId,
        periodStart: selectedPlanDoc.periodStart || fallback.start,
        periodEnd: selectedPlanDoc.periodEnd || fallback.end,
        weekBreakdown: wb,
      };
      setPlanDetailDepartmentId(selectedPlanDoc.departmentId || '');
      setPlanDetailPeriodStart(selectedPlanDoc.periodStart || fallback.start);
      setPlanDetailPeriodEnd(selectedPlanDoc.periodEnd || fallback.end);
      setPlanDetailIncome(selectedPlanDoc.income || 0);
      setPlanDetailExpenses(selectedPlanDoc.expenses || {});
      setPlanDetailSelectedCategories(selectedCats);
      setPlanDetailWeekBreakdown(wb);
    } else {
      // Сбрасываем значения, если план не выбран
      planDetailInitialValuesRef.current = null;
      setPlanDetailDepartmentId('');
      setPlanDetailPeriodStart('');
      setPlanDetailPeriodEnd('');
      setPlanDetailIncome(0);
      setPlanDetailExpenses({});
      setPlanDetailSelectedCategories([]);
      setPlanDetailWeekBreakdown([]);
    }
    setPlanDetailCategoryDropdownOpen(false);
  }, [selectedPlanDoc]);

  // Держим выбранные сущности синхронизированными с props после сохранения статуса/данных.
  useEffect(() => {
    if (!selectedPlanDoc) return;
    const fresh = financialPlanDocuments.find(d => d.id === selectedPlanDoc.id);
    if (fresh && fresh.updatedAt !== selectedPlanDoc.updatedAt) {
      setSelectedPlanDoc(fresh);
    }
  }, [financialPlanDocuments, selectedPlanDoc]);

  useEffect(() => {
    if (!selectedPlanning) return;
    const fresh = financialPlannings.find(p => p.id === selectedPlanning.id);
    if (fresh && fresh.updatedAt !== selectedPlanning.updatedAt) {
      setSelectedPlanning(fresh);
    }
  }, [financialPlannings, selectedPlanning]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (planDetailCategoryDropdownRef.current && !planDetailCategoryDropdownRef.current.contains(event.target as Node)) {
        setPlanDetailCategoryDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const calculatePlanDetailPercentAmount = useCallback((catId: string): number => {
    const cat = categories.find(c => c.id === catId);
    if (!cat || cat.type !== 'percent') return 0;
    const percent = planDetailExpenses[catId] || 0;
    return mulPercentMoney(planDetailIncome, percent);
  }, [categories, planDetailExpenses, planDetailIncome]);

  const planDetailTotalPercentExpenses = useMemo(() => {
    const parts = planDetailSelectedCategories
      .filter((catId) => {
        const cat = categories.find((c) => c.id === catId);
        return cat && cat.type === 'percent';
      })
      .map((catId) => calculatePlanDetailPercentAmount(catId));
    return sumMoney(parts);
  }, [planDetailSelectedCategories, planDetailExpenses, planDetailIncome, categories, calculatePlanDetailPercentAmount]);

  const planDetailTotalExpenses = useMemo(() => {
    const fixedParts = planDetailSelectedCategories
      .filter((catId) => {
        const cat = categories.find((c) => c.id === catId);
        return cat && cat.type === 'fixed';
      })
      .map((catId) => planDetailExpenses[catId] || 0);
    return sumMoney([planDetailTotalPercentExpenses, ...fixedParts]);
  }, [planDetailSelectedCategories, planDetailExpenses, planDetailTotalPercentExpenses, categories]);

  // Фильтруем финансовые планирования
  const filteredPlannings = useMemo(() => {
    let result = [...financialPlannings].sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    
    if (planningStatusFilter !== 'all') {
      result = result.filter(p => p.status === planningStatusFilter);
    }
    
    if (planningDepartmentFilter !== 'all') {
      result = result.filter(p => p.departmentId === planningDepartmentFilter);
    }
    
    if (showApprovedPlannings === 'hide') {
      result = result.filter(p => p.status !== 'approved');
    }

    if (financeArchiveScope === 'active') {
      result = result.filter(p => !p.isArchived);
    } else {
      result = result.filter(p => p.isArchived === true);
    }
    
    return result;
  }, [financialPlannings, planningStatusFilter, planningDepartmentFilter, showApprovedPlannings, financeArchiveScope]);

  // Конфигурация фильтров для планирований
  const planningFilters: FilterConfig[] = useMemo(() => [
    {
      label: 'Статус',
      value: planningStatusFilter,
      onChange: (val) => setPlanningStatusFilter(val as any),
      options: [
        { value: 'all', label: 'Все статусы' },
        { value: 'created', label: 'Создан' },
        { value: 'conducted', label: 'Проведен' },
        { value: 'approved', label: 'Одобрен' }
      ]
    },
    {
      label: 'Подразделение',
      value: planningDepartmentFilter,
      onChange: setPlanningDepartmentFilter,
      options: [
        { value: 'all', label: 'Все подразделения' },
        ...departments.map(d => ({ value: d.id, label: d.name }))
      ]
    },
    {
      label: 'Одобренные',
      value: showApprovedPlannings,
      onChange: setShowApprovedPlannings,
      options: [
        { value: 'hide', label: 'Скрыть' },
        { value: 'show', label: 'Показать' }
      ]
    }
  ], [planningStatusFilter, planningDepartmentFilter, showApprovedPlannings, departments]);

  const hasActivePlanningFilters = useMemo(() => 
    planningStatusFilter !== 'all' || planningDepartmentFilter !== 'all' || showApprovedPlannings !== 'hide',
    [planningStatusFilter, planningDepartmentFilter, showApprovedPlannings]
  );
  
  const clearPlanningFilters = useCallback(() => {
    setPlanningStatusFilter('all');
    setPlanningDepartmentFilter('all');
    setShowApprovedPlannings('hide');
  }, []);

  // Фильтруем финансовые планы
  const filteredPlanDocs = useMemo(() => {
    let result = financialPlanDocuments.filter(doc => {
      // Только текущего периода
      if (doc.period !== currentPeriod) return false;
      return true;
    }).sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    
    if (planStatusFilter !== 'all') {
      result = result.filter(p => p.status === planStatusFilter);
    }
    
    if (planDepartmentFilter !== 'all') {
      result = result.filter(p => p.departmentId === planDepartmentFilter);
    }
    
    if (showApprovedPlans === 'hide') {
      result = result.filter(p => p.status !== 'approved');
    }

    if (financeArchiveScope === 'active') {
      result = result.filter(p => !p.isArchived);
    } else {
      result = result.filter(p => p.isArchived === true);
    }
    
    return result;
  }, [financialPlanDocuments, currentPeriod, planStatusFilter, planDepartmentFilter, showApprovedPlans, financeArchiveScope]);

  // Конфигурация фильтров для планов
  const planFilters: FilterConfig[] = useMemo(() => [
    {
      label: 'Статус',
      value: planStatusFilter,
      onChange: (val) => setPlanStatusFilter(val as any),
      options: [
        { value: 'all', label: 'Все статусы' },
        { value: 'created', label: 'Создан' },
        { value: 'conducted', label: 'Проведен' },
        { value: 'approved', label: 'Утвержден' }
      ]
    },
    {
      label: 'Подразделение',
      value: planDepartmentFilter,
      onChange: setPlanDepartmentFilter,
      options: [
        { value: 'all', label: 'Все подразделения' },
        ...departments.map(d => ({ value: d.id, label: d.name }))
      ]
    },
    {
      label: 'Утвержденные',
      value: showApprovedPlans,
      onChange: setShowApprovedPlans,
      options: [
        { value: 'hide', label: 'Скрыть' },
        { value: 'show', label: 'Показать' }
      ]
    }
  ], [planStatusFilter, planDepartmentFilter, showApprovedPlans, departments]);

  const hasActivePlanFilters = useMemo(() => 
    planStatusFilter !== 'all' || planDepartmentFilter !== 'all' || showApprovedPlans !== 'hide',
    [planStatusFilter, planDepartmentFilter, showApprovedPlans]
  );
  
  const clearPlanFilters = useCallback(() => {
    setPlanStatusFilter('all');
    setPlanDepartmentFilter('all');
    setShowApprovedPlans('hide');
  }, []);

  // Конфигурация фильтров для заявок
  const requestFilters: FilterConfig[] = useMemo(() => [
    {
      label: 'Статус',
      value: requestStatusFilter,
      onChange: (val) => setRequestStatusFilter(val as any),
      options: [
        { value: 'all', label: 'Все статусы' },
        { value: 'draft', label: 'Черновик' },
        { value: 'pending', label: 'Ожидание' },
        { value: 'approved', label: 'Одобрено' },
        { value: 'rejected', label: 'Отклонено' },
        { value: 'paid', label: 'Оплачено' }
      ]
    },
    {
      label: 'Подразделение',
      value: requestDepartmentFilter,
      onChange: setRequestDepartmentFilter,
      options: [
        { value: 'all', label: 'Все подразделения' },
        ...departments.map(d => ({ value: d.id, label: d.name }))
      ]
    },
    {
      label: 'Статья',
      value: requestCategoryFilter,
      onChange: setRequestCategoryFilter,
      options: [
        { value: 'all', label: 'Все статьи' },
        ...categories.map(c => ({ value: c.id, label: c.name }))
      ]
    }
  ], [requestStatusFilter, requestDepartmentFilter, requestCategoryFilter, departments, categories]);

  const hasActiveRequestFilters = useMemo(() => 
    requestStatusFilter !== 'all' || requestDepartmentFilter !== 'all' || requestCategoryFilter !== 'all',
    [requestStatusFilter, requestDepartmentFilter, requestCategoryFilter]
  );
  
  const clearRequestFilters = useCallback(() => {
    setRequestStatusFilter('all');
    setRequestDepartmentFilter('all');
    setRequestCategoryFilter('all');
  }, []);

  const filteredFinanceRequests = useMemo(() => {
    return requests.filter(req => {
      if (requestStatusFilter !== 'all' && normalizeRequestStatusForFilter(req) !== requestStatusFilter) return false;
      if (requestDepartmentFilter !== 'all' && req.departmentId !== requestDepartmentFilter) return false;
      if (requestCategoryFilter !== 'all' && req.categoryId !== requestCategoryFilter) return false;
      if (financeArchiveScope === 'active' && req.isArchived) return false;
      if (financeArchiveScope === 'archived' && !req.isArchived) return false;
      return true;
    });
  }, [requests, requestStatusFilter, requestDepartmentFilter, requestCategoryFilter, financeArchiveScope]);

  // --- Handlers ---

  const handleOpenRequestCreate = () => {
      setFinanceArchiveScope('active');
      setEditingRequest(null);
      const nid = `pr-${Date.now()}`;
      setCreateRequestId(nid);
      setReqAmount('');
      setReqTitle('');
      setReqDesc('');
      setReqDep(departments[0]?.id || '');
      setReqCat(categories[0]?.id || '');
      setReqPaymentDate('');
      setReqInn('');
      setReqInvoiceNumber('');
      setReqInvoiceDate('');
      setReqAttachments([]);
      setIsRequestModalOpen(true);
  };
  
  const handleOpenRequestEdit = (req: PurchaseRequest) => {
      setEditingRequest(req);
      setCreateRequestId(req.id);
      setReqAmount(String(req.amount ?? '').replace(/\s/g, ''));
      setReqTitle(req.title || '');
      const sourceDesc = req.description ?? req.comment ?? '';
      const m = sourceDesc.match(/\[paymentDate:([0-9]{4}-[0-9]{2}-[0-9]{2})\]/);
      setReqPaymentDate(req.paymentDate || m?.[1] || '');
      setReqDesc(sourceDesc.replace(/\s*\[paymentDate:[0-9]{4}-[0-9]{2}-[0-9]{2}\]\s*/g, '').trim());
      setReqDep(req.departmentId || '');
      setReqCat(req.categoryId || req.category || '');
      setReqInn(req.counterpartyInn || '');
      setReqInvoiceNumber(req.invoiceNumber || '');
      setReqInvoiceDate(req.invoiceDate || '');
      setReqAttachments(req.attachments?.length ? [...req.attachments] : []);
      setIsRequestModalOpen(true);
  };

  const handleRequestSubmit = (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      if (editingRequest && (editingRequest.status === 'approved' || editingRequest.status === 'paid')) {
        return;
      }
      const amountStr = reqAmount.replace(/\s/g, '').replace(/,/g, '.').trim() || '0';
      const title =
        reqTitle.trim() || (reqDesc.trim().slice(0, 500) || 'Заявка');
      const rid = editingRequest?.id ?? (createRequestId || `pr-${Date.now()}`);
      onSaveRequest({
          id: rid,
          title,
          comment: reqDesc.trim(),
          requesterId: editingRequest?.requesterId ?? currentUser.id,
          requestedBy: editingRequest?.requestedBy ?? editingRequest?.requesterId ?? currentUser.id,
          departmentId: reqDep,
          categoryId: reqCat,
          category: reqCat,
          amount: amountStr,
          currency: 'UZS',
          paymentDate: reqPaymentDate || undefined,
          status: editingRequest ? editingRequest.status : 'pending',
          date: editingRequest?.date ?? new Date().toISOString(),
          isArchived: editingRequest?.isArchived,
          attachments: reqAttachments.length ? reqAttachments : undefined,
          counterpartyInn: reqInn.trim() || undefined,
          invoiceNumber: reqInvoiceNumber.trim() || undefined,
          invoiceDate: reqInvoiceDate || undefined,
          version: editingRequest?.version,
      });
      setIsRequestModalOpen(false);
  };

  const handleSaveRequestMetadata = () => {
    if (!editingRequest) return;
    onSaveRequest(
      {
        ...editingRequest,
        attachments: reqAttachments,
        counterpartyInn: reqInn.trim() || undefined,
        invoiceNumber: reqInvoiceNumber.trim() || undefined,
        invoiceDate: reqInvoiceDate || undefined,
      },
      { metadataOnly: true }
    );
    setIsRequestModalOpen(false);
  };

  const handleRequestAttachmentFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    const uid = editingRequest?.id || createRequestId;
    if (!uid) return;
    const next = [...reqAttachments];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const r = await uploadFile(file, `finance-requests/${uid}/`);
        next.push({
          id: `fra-${Date.now()}-${i}`,
          name: file.name,
          url: r.url,
          type: file.type || 'application/octet-stream',
          uploadedAt: new Date().toISOString(),
          storagePath: r.path,
        });
      } catch {
        setAlertText('Не удалось загрузить файл');
      }
    }
    setReqAttachments(next);
    e.target.value = '';
  };

  const handleStatusChange = (req: PurchaseRequest, status: PurchaseRequest['status']) => {
      if (status === 'rejected') {
        const reason = typeof window !== 'undefined' ? window.prompt('Причина отклонения (обязательно):') : null;
        if (reason === null) return;
        const trimmed = reason.trim();
        if (!trimmed) {
          setAlertText('Укажите причину отклонения');
          return;
        }
        onSaveRequest(
          { ...req, status: 'rejected', comment: trimmed },
          { statusPatch: 'reject', rejectComment: trimmed }
        );
        return;
      }
      if (status === 'approved') {
        const pl = financialPlannings.find((p) => (p.requestIds || []).includes(req.id));
        if (pl) {
          const fid = pl.requestFundIds?.[req.id] || '';
          if (!fid) {
            setAlertText('В бюджете для этой заявки не выбран фонд. Откройте бюджет и назначьте фонд заявке.');
            return;
          }
          const alloc = Number(pl.fundAllocations?.[fid]) || 0;
          const used = approvedAmountByFund(pl, requests, req.id);
          const need = parseRequestAmountUzs(req);
          if (moneyToTiyin(used[fid] || 0) + moneyToTiyin(need) > moneyToTiyin(alloc)) {
            const free = alloc - (used[fid] || 0);
            setAlertText(
              `Недостаточно средств на фонде. Доступно ${free.toLocaleString('ru-RU')} UZS, нужно ${need.toLocaleString('ru-RU')} UZS. Сделайте перераспределение в карточке бюджета.`
            );
            return;
          }
        }
        onSaveRequest({ ...req, status }, { statusPatch: 'approve' });
        return;
      }
      if (status === 'paid') {
        onSaveRequest({ ...req, status }, { statusPatch: 'paid' });
        return;
      }
      if (status === 'pending') {
        onSaveRequest({ ...req, status }, { statusPatch: 'submit' });
        return;
      }
      onSaveRequest({ ...req, status });
  };

  const archiveFinancialPlanning = useCallback((e: React.MouseEvent, p: FinancialPlanning) => {
    e.stopPropagation();
    if (!onSaveFinancialPlanning) return;
    if (!confirm('Переместить бюджет в архив?')) return;
    onSaveFinancialPlanning({ ...p, isArchived: true, updatedAt: new Date().toISOString() });
  }, [onSaveFinancialPlanning]);

  const restoreFinancialPlanning = useCallback((e: React.MouseEvent, p: FinancialPlanning) => {
    e.stopPropagation();
    if (!onSaveFinancialPlanning) return;
    onSaveFinancialPlanning({ ...p, isArchived: false, updatedAt: new Date().toISOString() });
  }, [onSaveFinancialPlanning]);

  const archiveFinancialPlanDocument = useCallback((e: React.MouseEvent, d: FinancialPlanDocument) => {
    e.stopPropagation();
    if (!onSaveFinancialPlanDocument) return;
    if (!confirm('Переместить документ плана в архив?')) return;
    onSaveFinancialPlanDocument({ ...d, isArchived: true, updatedAt: new Date().toISOString() });
  }, [onSaveFinancialPlanDocument]);

  const restoreFinancialPlanDocument = useCallback((e: React.MouseEvent, d: FinancialPlanDocument) => {
    e.stopPropagation();
    if (!onSaveFinancialPlanDocument) return;
    onSaveFinancialPlanDocument({ ...d, isArchived: false, updatedAt: new Date().toISOString() });
  }, [onSaveFinancialPlanDocument]);

  const archivePurchaseRequest = useCallback((e: React.MouseEvent, r: PurchaseRequest) => {
    e.stopPropagation();
    if (!confirm('Переместить заявку в архив?')) return;
    onSaveRequest({ ...r, isArchived: true });
  }, [onSaveRequest]);

  const restorePurchaseRequest = useCallback((e: React.MouseEvent, r: PurchaseRequest) => {
    e.stopPropagation();
    onSaveRequest({ ...r, isArchived: false });
  }, [onSaveRequest]);

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'created': return 'Создан';
      case 'conducted': return 'Проведен';
      case 'approved': return 'Одобрен';
      default: return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'created': return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
      case 'conducted': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      case 'approved': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  // --- Render Planning List ---
  const renderPlanningList = () => {
    const sorted = [...filteredPlannings].sort(
      (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );
    return (
      <div className="space-y-6">
        {sorted.length === 0 ? (
          <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-xl p-12 text-center">
            <FileText size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
            <p className="text-gray-400 dark:text-gray-500 text-sm mb-2">
              {financeArchiveScope === 'archived' ? 'Нет архивных бюджетов' : 'Нет бюджетов'}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              {financeArchiveScope === 'archived'
                ? 'Архивные записи появятся после перемещения в архив'
                : 'Создайте первый бюджет через кнопку с плюсом в шапке'}
            </p>
          </div>
        ) : (
          <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-xl overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 dark:bg-[#202020] border-b border-gray-200 dark:border-[#333]">
                <tr>
                  <th className="px-4 py-3 text-gray-600 dark:text-gray-400">Период</th>
                  <th className="px-4 py-3 text-gray-600 dark:text-gray-400">Подразделение</th>
                  <th className="px-4 py-3 text-gray-600 dark:text-gray-400">Доход</th>
                  <th className="px-4 py-3 text-gray-600 dark:text-gray-400">Заявок</th>
                  <th className="px-4 py-3 text-gray-600 dark:text-gray-400">Статус</th>
                  <th className="px-4 py-3 text-gray-600 dark:text-gray-400">Создан</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-[#333]">
                {sorted.map((planning) => {
                  const periodLabel = formatRangeLabel(planning.periodStart, planning.periodEnd, planning.period);
                  const dep = departments.find((d) => d.id === planning.departmentId);
                  return (
                    <tr
                      key={planning.id}
                      className="hover:bg-gray-50 dark:hover:bg-[#303030] cursor-pointer group"
                      onClick={() => {
                        setSelectedPlanning(planning);
                        setPlanningSubView('detail');
                      }}
                    >
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{periodLabel}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400 text-xs">{dep?.name || '—'}</td>
                      <td className="px-4 py-3 font-bold text-gray-900 dark:text-gray-100">
                        {(planning.income || 0).toLocaleString()} UZS
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400 tabular-nums">{planning.requestIds.length}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${getStatusColor(planning.status)}`}>
                          {getStatusLabel(planning.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">
                        {new Date(planning.createdAt).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '.')}
                      </td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          {financeArchiveScope === 'active' ? (
                            <button
                              type="button"
                              onClick={(e) => archiveFinancialPlanning(e, planning)}
                              className="text-gray-400 hover:text-amber-600 dark:hover:text-amber-400"
                              title="В архив"
                            >
                              <Archive size={14} />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => restoreFinancialPlanning(e, planning)}
                              className="text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400"
                              title="Восстановить"
                            >
                              <RotateCcw size={14} />
                            </button>
                          )}
                          <ArrowRight size={16} className="text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-200" />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  // --- Render Planning Detail ---
  const renderPlanningDetail = () => {
    if (!selectedPlanning) return null;
    
    const dep = departments.find(d => d.id === planningDetailDepartmentId);
    const periodLabel = formatRangeLabel(planningDetailPeriodStart, planningDetailPeriodEnd, selectedPlanning.period);
    const planningRequests = requests.filter(r => selectedPlanning.requestIds.includes(r.id));
    
    const hasChanges = (): boolean => {
      if (!planningDetailInitialValuesRef.current) return false;
      const ref = planningDetailInitialValuesRef.current;
      return (
        JSON.stringify([...planningDetailRequestIds].sort()) !== JSON.stringify([...ref.requestIds].sort()) ||
        planningDetailNotes !== (ref.notes || '') ||
        planningDetailIncome !== (ref.income || 0) ||
        planningDetailDepartmentId !== (ref.departmentId || '') ||
        planningDetailPeriodStart !== (ref.periodStart || '') ||
        planningDetailPeriodEnd !== (ref.periodEnd || '') ||
        JSON.stringify(planningDetailFundAllocations) !== JSON.stringify(ref.fundAllocations || {}) ||
        JSON.stringify(planningDetailRequestFundIds) !== JSON.stringify(ref.requestFundIds || {}) ||
        JSON.stringify([...planningDetailPlanDocumentIds].sort()) !== JSON.stringify([...(ref.planDocumentIds || [])].sort()) ||
        JSON.stringify([...planningDetailIncomeReportIds].sort()) !== JSON.stringify([...(ref.incomeReportIds || [])].sort()) ||
        JSON.stringify(planningDetailExpenseDistribution) !== JSON.stringify(ref.expenseDistribution || {}) ||
        JSON.stringify(planningDetailFundMovements || []) !== JSON.stringify(ref.fundMovements || [])
      );
    };
    
    const handleBack = () => {
      const goList = () => {
        setPlanningSubView('list');
        setSelectedPlanning(null);
      };
      if (!hasChanges()) {
        goList();
        return;
      }
      if (window.confirm('Сохранить изменения перед выходом?')) {
        handleSave();
      }
      goList();
    };
    
    const handleSave = () => {
      if (!onSaveFinancialPlanning) return;
      const docIds = [...planningDetailPlanDocumentIds];
      const irs = [...planningDetailIncomeReportIds];
      const updated: FinancialPlanning = {
        ...selectedPlanning,
        departmentId: planningDetailDepartmentId || selectedPlanning.departmentId,
        period: canonicalFinancialMonthYm(selectedPlanning.period, planningDetailPeriodStart, currentPeriod),
        periodStart: planningDetailPeriodStart || undefined,
        periodEnd: planningDetailPeriodEnd || undefined,
        requestIds: planningDetailRequestIds,
        notes: planningDetailNotes,
        income: planningDetailIncome,
        fundAllocations: Object.keys(planningDetailFundAllocations).length ? planningDetailFundAllocations : undefined,
        requestFundIds: Object.keys(planningDetailRequestFundIds).length ? planningDetailRequestFundIds : undefined,
        planDocumentIds: docIds.length ? docIds : undefined,
        planDocumentId: docIds[0] || selectedPlanning.planDocumentId,
        incomeReportIds: irs.length ? irs : undefined,
        incomeReportId: irs[0] || undefined,
        expenseDistribution: Object.keys(planningDetailExpenseDistribution).length ? planningDetailExpenseDistribution : undefined,
        fundMovements: planningDetailFundMovements?.length ? planningDetailFundMovements : undefined,
        updatedAt: new Date().toISOString()
      };
      onSaveFinancialPlanning(updated);
      void onRefreshIncomeReports?.();
      planningDetailInitialValuesRef.current = {
        requestIds: planningDetailRequestIds,
        notes: planningDetailNotes,
        income: planningDetailIncome,
        departmentId: planningDetailDepartmentId,
        periodStart: planningDetailPeriodStart,
        periodEnd: planningDetailPeriodEnd,
        fundAllocations: planningDetailFundAllocations,
        requestFundIds: planningDetailRequestFundIds,
        planDocumentIds: docIds,
        incomeReportId: irs[0] || '',
        incomeReportIds: irs,
        expenseDistribution: planningDetailExpenseDistribution,
        fundMovements: planningDetailFundMovements,
      };
    };
    
    const handleRefreshRequests = () => {
      if (!selectedPlanning) return;
      const startIso = planningDetailPeriodStart || selectedPlanning.periodStart;
      const endIso = planningDetailPeriodEnd || selectedPlanning.periodEnd;
      const fallback = getDefaultRangeForMonth(selectedPlanning.period || currentPeriod);
      const periodStart = new Date(`${(startIso || fallback.start)}T00:00:00`);
      const periodEnd = new Date(`${(endIso || fallback.end)}T23:59:59`);
      
      // Находим заявки, которые подходят под период и подразделение
      const matchingRequests = requests.filter(req => {
        if (!req.date) return false;
        const reqDate = new Date(req.date);
        // Проверяем, что дата заявки попадает в период планирования
        const isInPeriod = reqDate >= periodStart && reqDate <= periodEnd;
        // Проверяем подразделение
        const isSameDepartment = req.departmentId === (planningDetailDepartmentId || selectedPlanning.departmentId);
        // Проверяем статус (берем все, кроме отклоненных)
        const isValidStatus = req.status !== 'rejected' && req.status !== 'paid';
        
        return isInPeriod && isSameDepartment && isValidStatus && !req.isArchived;
      });
      
      const newRequestIds = Array.from(new Set([...planningDetailRequestIds, ...matchingRequests.map(r => r.id)]));
      setPlanningDetailRequestIds(newRequestIds);
    };
    
    const handleApprove = () => {
      if (!onSaveFinancialPlanning || !hasPermission(currentUser, 'finance.approve')) return;
      if (confirm('Одобрить бюджет?')) {
        const updated: FinancialPlanning = {
          ...selectedPlanning,
          status: 'approved',
          approvedBy: currentUser.id,
          approvedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        setSelectedPlanning(updated);
        onSaveFinancialPlanning(updated);
      }
    };
    
    const handleConduct = () => {
      if (!onSaveFinancialPlanning) return;
      const updated: FinancialPlanning = {
        ...selectedPlanning,
        status: 'conducted',
        updatedAt: new Date().toISOString()
      };
      setSelectedPlanning(updated);
      onSaveFinancialPlanning(updated);
    };

    const isPlanningArchived = selectedPlanning.isArchived === true;

    const handleArchivePlanningFromDetail = () => {
      if (!onSaveFinancialPlanning) return;
      if (!confirm('Переместить бюджет в архив?')) return;
      onSaveFinancialPlanning({ ...selectedPlanning, isArchived: true, updatedAt: new Date().toISOString() });
      setPlanningSubView('list');
      setSelectedPlanning(null);
    };

    const handleRestorePlanningFromDetail = () => {
      if (!onSaveFinancialPlanning) return;
      onSaveFinancialPlanning({ ...selectedPlanning, isArchived: false, updatedAt: new Date().toISOString() });
    };
    
    return (
      <div className="flex flex-col flex-1 min-h-0 -mx-4 md:-mx-6">
        <div className="hidden print:block px-4 py-4 border-b-2 border-black text-black">
          <h1 className="text-xl font-bold">Бюджет (печать)</h1>
          <p className="text-sm mt-1">{dep?.name || '—'} · {periodLabel}</p>
          <p className="text-xs text-gray-600 mt-2">Сформировано: {new Date().toLocaleString('ru-RU')}</p>
        </div>
        <div className="sticky top-0 z-20 flex flex-wrap items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-[#333] bg-white/95 dark:bg-[#191919]/95 backdrop-blur-md print:hidden">
          <button
            type="button"
            onClick={handleBack}
            className="p-2 rounded-xl border border-gray-200 dark:border-[#333] hover:bg-gray-50 dark:hover:bg-[#252525] transition-colors"
          >
            <ArrowLeft size={20} className="text-gray-600 dark:text-gray-400" />
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white truncate">
              Бюджет
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {dep?.name || '—'} · {periodLabel}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end print:hidden">
            <button
              type="button"
              onClick={() => window.print()}
              className="px-3 py-2 border border-gray-200 dark:border-[#444] text-gray-700 dark:text-gray-200 text-sm font-medium rounded-xl flex items-center gap-2"
            >
              <Printer size={16} />
              Печать
            </button>
            {isPlanningArchived ? (
              <button
                type="button"
                onClick={handleRestorePlanningFromDetail}
                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-xl flex items-center gap-2"
              >
                <RotateCcw size={16} />
                Восстановить
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    if (selectedPlanning.status === 'created') return handleConduct();
                    if (selectedPlanning.status === 'conducted' && hasPermission(currentUser, 'finance.approve')) return handleApprove();
                  }}
                  disabled={!(selectedPlanning.status === 'created' || (selectedPlanning.status === 'conducted' && hasPermission(currentUser, 'finance.approve')))}
                  className={`px-3 py-2 rounded-xl text-sm font-bold uppercase border transition-colors ${
                    (selectedPlanning.status === 'created' || (selectedPlanning.status === 'conducted' && hasPermission(currentUser, 'finance.approve')))
                      ? 'cursor-pointer hover:opacity-90'
                      : 'cursor-default opacity-70'
                  } ${getStatusColor(selectedPlanning.status)} border-transparent`}
                  title={
                    selectedPlanning.status === 'created'
                      ? 'Нажмите, чтобы провести'
                      : selectedPlanning.status === 'conducted' && hasPermission(currentUser, 'finance.approve')
                      ? 'Нажмите, чтобы одобрить'
                      : 'Статус'
                  }
                >
                  {selectedPlanning.status === 'created'
                    ? 'Провести'
                    : selectedPlanning.status === 'conducted' && hasPermission(currentUser, 'finance.approve')
                    ? 'Утвердить'
                    : getStatusLabel(selectedPlanning.status)}
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="px-3 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-medium hover:opacity-90 rounded-xl flex items-center gap-2"
                >
                  <Save size={16} />
                  Сохранить
                </button>
                <button
                  type="button"
                  onClick={handleArchivePlanningFromDetail}
                  className="px-3 py-2 border border-gray-200 dark:border-[#444] text-gray-700 dark:text-gray-200 text-sm font-medium hover:bg-gray-50 dark:hover:bg-[#252525] rounded-xl flex items-center gap-2"
                  title="В архив"
                >
                  <Archive size={16} />
                  В архив
                </button>
              </>
            )}
          </div>
        </div>
        <div className={`${MODULE_PAGE_GUTTER} py-6 flex-1 overflow-y-auto custom-scrollbar min-h-0 print:overflow-visible print:py-4`}>
        <fieldset disabled={isPlanningArchived} className="border-0 p-0 m-0 min-w-0 space-y-6 flex flex-col print:shadow-none">

        {/* Период + подразделение */}
        <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-xl p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">
                Подразделение
              </label>
              <EntitySearchSelect
                value={planningDetailDepartmentId}
                onChange={setPlanningDetailDepartmentId}
                options={departments.map((d) => ({ value: d.id, label: d.name, searchText: d.name }))}
                searchPlaceholder="Подразделение…"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">
                Период (месяц)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <DateInput value={planningDetailPeriodStart} onChange={setPlanningDetailPeriodStart} placeholder="Дата начала" />
                <DateInput value={planningDetailPeriodEnd} onChange={setPlanningDetailPeriodEnd} placeholder="Дата конца" />
              </div>
            </div>
          </div>
        </div>

        {/* Справка о доходах и планы */}
        <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-xl p-6 space-y-4 print:break-inside-avoid">
          <h3 className="text-sm font-bold text-gray-800 dark:text-white uppercase">Справка о доходах и планы</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                Справки за месяц {selectedPlanning.period} (можно несколько)
              </label>
              <div className="max-h-36 overflow-y-auto space-y-1 border border-gray-200 dark:border-[#444] rounded-lg p-2 text-sm">
                {incomeReports.filter(
                  (r) =>
                    r.period === selectedPlanning.period &&
                    (!r.lockedByPlanningId || r.lockedByPlanningId === selectedPlanning.id)
                ).length === 0 ? (
                  <span className="text-xs text-gray-500 dark:text-gray-400">Нет доступных справок</span>
                ) : (
                  incomeReports
                    .filter(
                      (r) =>
                        r.period === selectedPlanning.period &&
                        (!r.lockedByPlanningId || r.lockedByPlanningId === selectedPlanning.id)
                    )
                    .map((r) => (
                      <label key={r.id} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={planningDetailIncomeReportIds.includes(r.id)}
                          onChange={() => {
                            setPlanningDetailIncomeReportIds((prev) =>
                              prev.includes(r.id) ? prev.filter((x) => x !== r.id) : [...prev, r.id]
                            );
                          }}
                        />
                        <span className="truncate text-gray-800 dark:text-gray-100">
                          {r.period} (справка)
                          {r.lockedByPlanningId === selectedPlanning.id ? ' · привязана к этому бюджету' : ''}
                        </span>
                      </label>
                    ))
                )}
              </div>
              <button
                type="button"
                className="mt-2 text-xs text-[#3337AD] hover:underline print:hidden"
                onClick={() => {
                  if (!planningDetailIncomeReportIds.length) {
                    setAlertText('Отметьте одну или несколько справок');
                    return;
                  }
                  const sum = sumIncomeReportsInRange(
                    incomeReports,
                    planningDetailIncomeReportIds,
                    planningDetailPeriodStart,
                    planningDetailPeriodEnd
                  );
                  setPlanningDetailIncome(sum);
                }}
              >
                Подтянуть доход из выбранных справок за даты периода
              </button>
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Планы (тот же месяц и подразделение)</label>
              <div className="max-h-36 overflow-y-auto space-y-1 border border-gray-200 dark:border-[#444] rounded-lg p-2 text-sm">
                {financialPlanDocuments
                  .filter(
                    (d) =>
                      !d.isArchived &&
                      d.departmentId === planningDetailDepartmentId &&
                      d.period === selectedPlanning.period
                  )
                  .map((d) => (
                    <label key={d.id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={planningDetailPlanDocumentIds.includes(d.id)}
                        onChange={() => {
                          setPlanningDetailPlanDocumentIds((prev) =>
                            prev.includes(d.id) ? prev.filter((x) => x !== d.id) : [...prev, d.id]
                          );
                        }}
                      />
                      <span className="truncate text-gray-800 dark:text-gray-100">
                        {planDocRowPeriodLabel(d)} · {(d.income || 0).toLocaleString('ru-RU')} UZS
                      </span>
                    </label>
                  ))}
              </div>
              <button
                type="button"
                className="mt-2 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs print:hidden"
                onClick={() => {
                  const docs = financialPlanDocuments.filter((d) => planningDetailPlanDocumentIds.includes(d.id));
                  setPlanningDetailExpenseDistribution(distributeIncomeFromPlanDocuments(planningDetailIncome, docs, categories));
                }}
              >
                Распределить доход по статьям из планов
              </button>
            </div>
          </div>
          {Object.keys(planningDetailExpenseDistribution).length > 0 && (
            <div className="border-t border-gray-100 dark:border-[#333] pt-3">
              <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">Распределение по статьям (расчёт)</div>
              <ul className="text-sm space-y-1">
                {(Object.entries(planningDetailExpenseDistribution) as [string, number][]).map(([cid, amt]) => {
                  const cn = categories.find((c) => c.id === cid)?.name || cid;
                  return (
                    <li key={cid} className="flex justify-between gap-2">
                      <span className="text-gray-600 dark:text-gray-400">{cn}</span>
                      <span className="font-mono tabular-nums">{Number(amt).toLocaleString('ru-RU')} UZS</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
        
        {/* Доход */}
        <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-xl p-6">
          <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">
            Доход за период (UZS), кассовый метод
          </label>
          <input
            type="number"
            value={planningDetailIncome || ''}
            onChange={(e) => setPlanningDetailIncome(parseFloat(e.target.value) || 0)}
            className="w-full bg-white dark:bg-[#333] border border-gray-300 dark:border-[#555] rounded-lg px-4 py-3 text-lg font-bold text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
            placeholder="0"
          />
        </div>

        {/* Распределение по фондам */}
        {funds.filter(f => !f.isArchived).length > 0 && (
          <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-xl p-6">
            <h3 className="text-sm font-bold text-gray-800 dark:text-white uppercase mb-3">Распределение дохода по фондам</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Сумма по фондам не должна превышать доход за период.</p>
            <div className="space-y-3">
              {funds.filter(f => !f.isArchived).map(fund => (
                <div key={fund.id} className="flex items-center gap-4">
                  <label className="w-40 text-sm font-medium text-gray-700 dark:text-gray-300 shrink-0">{fund.name}</label>
                  <input
                    type="number"
                    min={0}
                    value={planningDetailFundAllocations[fund.id] ?? ''}
                    onChange={(e) => setPlanningDetailFundAllocations(prev => ({ ...prev, [fund.id]: parseFloat(e.target.value) || 0 }))}
                    className="flex-1 bg-white dark:bg-[#333] border border-gray-300 dark:border-[#555] rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-gray-100 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    placeholder="0"
                  />
                  <span className="text-xs text-gray-500 dark:text-gray-400">UZS</span>
                </div>
              ))}
            </div>
            {planningDetailIncome > 0 && (() => {
              const allocated = sumMoney(Object.values(planningDetailFundAllocations) as number[]);
              const rest = subtractMoney(planningDetailIncome, allocated);
              return (
                <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                  Распределено: {allocated.toLocaleString()} UZS · Остаток: {rest.toLocaleString()} UZS
                  {rest < 0 && <span className="text-red-600 dark:text-red-400 ml-2">(превышение)</span>}
                </div>
              );
            })()}
          </div>
        )}

        {funds.filter((f) => !f.isArchived).length > 0 && (
          <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-xl p-6 print:break-inside-avoid">
            <h3 className="text-sm font-bold text-gray-800 dark:text-white uppercase mb-2">Остатки на фондах</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              После одобрения заявок остаток уменьшается. Перераспределение фиксируется в бюджете (движения).
            </p>
            <div className="space-y-2 text-sm">
              {funds
                .filter((f) => !f.isArchived)
                .map((fund) => {
                  const synthetic: FinancialPlanning = {
                    ...selectedPlanning,
                    fundAllocations: planningDetailFundAllocations,
                    requestFundIds: planningDetailRequestFundIds,
                    requestIds: planningDetailRequestIds,
                  };
                  const bal = fundAvailableBalances(synthetic, requests)[fund.id] ?? 0;
                  return (
                    <div key={fund.id} className="flex justify-between gap-2">
                      <span className="text-gray-700 dark:text-gray-300">{fund.name}</span>
                      <span className={`tabular-nums font-medium ${bal < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                        {bal.toLocaleString('ru-RU')} UZS
                      </span>
                    </div>
                  );
                })}
            </div>
            {planningDetailFundMovements && planningDetailFundMovements.length > 0 && (
              <div className="mt-4 border-t border-gray-100 dark:border-[#333] pt-3 text-xs text-gray-500 dark:text-gray-400">
                <div className="font-bold text-gray-600 dark:text-gray-300 mb-1">Движения между фондами</div>
                <ul className="space-y-1">
                  {planningDetailFundMovements.map((m) => {
                    const fromN = funds.find((f) => f.id === m.fromFundId)?.name || m.fromFundId;
                    const toN = funds.find((f) => f.id === m.toFundId)?.name || m.toFundId;
                    return (
                      <li key={m.id}>
                        {fromN} → {toN}: {m.amount.toLocaleString('ru-RU')} UZS
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            {!isPlanningArchived && (
              <button
                type="button"
                className="mt-3 text-sm text-[#3337AD] hover:underline print:hidden"
                onClick={() => setPlanningFundTransferOpen(true)}
              >
                Перераспределить между фондами
              </button>
            )}
          </div>
        )}

        {/* Info */}
        <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-xl p-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Статус</div>
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase ${getStatusColor(selectedPlanning.status)}`}>
                {getStatusLabel(selectedPlanning.status)}
              </span>
            </div>
            <div>
              <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Заявок</div>
              <div className="text-lg font-bold text-gray-900 dark:text-white">{planningRequests.length}</div>
            </div>
          </div>
        </div>
        
        {/* Заявки */}
        <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-xl overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-[#333] flex items-center justify-between flex-wrap gap-2">
            <h3 className="font-bold text-gray-800 dark:text-white">Заявки в бюджете ({planningRequests.length})</h3>
            <div className="flex items-center gap-4">
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Сумма: {sumRequestAmountsUzs(planningRequests)} UZS
              </div>
              <button
                onClick={handleRefreshRequests}
                className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 rounded-lg flex items-center gap-2"
              >
                <CheckCircle2 size={14} />
                Обновить заявки
              </button>
            </div>
          </div>
          <div className="p-4">
            {planningRequests.length === 0 ? (
              <div className="text-center py-8 text-gray-400 dark:text-gray-500 text-sm">
                Нет заявок в бюджете
              </div>
            ) : (
              <div className="space-y-2">
                {planningRequests.map(req => {
                  const cat = categories.find(c => c.id === (req.categoryId || req.category));
                  const user = users.find(u => u.id === (req.requesterId || req.requestedBy));
                  const activeFundsList = funds.filter(f => !f.isArchived);
                  const requestFundId = planningDetailRequestFundIds[req.id] || '';
                  return (
                    <div
                      key={req.id}
                      className="flex items-center justify-between gap-4 p-3 bg-gray-50 dark:bg-[#303030] rounded-lg hover:bg-gray-100 dark:hover:bg-[#404040] transition-colors group"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 dark:text-white">{req.title || cat?.name || 'Без названия'}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {user?.name} • {requestAmountLabel(req.amount)} UZS
                          {req.date && (
                            <> • {new Date(req.date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '.')}</>
                          )}
                        </div>
                        {(req.description || req.comment) && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-1">
                            {req.description || req.comment}
                          </div>
                        )}
                      </div>
                      {activeFundsList.length > 0 && (
                        <div className="shrink-0 w-40">
                          <select
                            value={requestFundId}
                            onChange={(e) => setPlanningDetailRequestFundIds(prev => ({ ...prev, [req.id]: e.target.value }))}
                            className="w-full bg-white dark:bg-[#333] border border-gray-300 dark:border-[#555] rounded-lg px-2 py-1.5 text-xs text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">— Фонд —</option>
                            {activeFundsList.map(f => (
                              <option key={f.id} value={f.id}>{f.name}</option>
                            ))}
                          </select>
                        </div>
                      )}
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${
                          req.status === 'paid' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300' :
                          req.status === 'approved' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                          req.status === 'rejected' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                          req.status === 'draft' || req.status === 'deferred' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' :
                          'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                        }`}>
                          {req.status === 'paid' ? 'Оплачено' : req.status === 'approved' ? 'Одобрено' : req.status === 'rejected' ? 'Отклонено' : req.status === 'draft' || req.status === 'deferred' ? 'Черновик' : 'Ожидание'}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenRequestEdit(req);
                          }}
                          className="p-1.5 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded text-blue-600 dark:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Редактировать заявку"
                        >
                          <Edit2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        
        {/* Примечания */}
        <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-xl p-6">
          <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">
            Примечания
          </label>
          <textarea
            value={planningDetailNotes}
            onChange={(e) => setPlanningDetailNotes(e.target.value)}
            rows={4}
            className="w-full bg-white dark:bg-[#333] border border-gray-300 dark:border-[#555] rounded-lg px-4 py-3 text-sm text-gray-900 dark:text-gray-100 resize-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 outline-none"
            placeholder="Добавьте примечания..."
          />
        </div>
        </fieldset>
        </div>
        {planningFundTransferOpen && (
          <div
            className="fixed inset-0 z-[280] flex items-center justify-center bg-black/40 p-4 print:hidden"
            onClick={() => setPlanningFundTransferOpen(false)}
            role="presentation"
          >
            <div
              className="bg-white dark:bg-[#252525] rounded-xl p-6 max-w-md w-full border border-gray-200 dark:border-[#333] shadow-xl"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
            >
              <h4 className="font-bold text-gray-900 dark:text-white mb-4">Перераспределение между фондами</h4>
              <div className="space-y-3 text-sm">
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Из фонда</label>
                  <EntitySearchSelect
                    value={fundTransferFrom}
                    onChange={setFundTransferFrom}
                    options={[
                      { value: '', label: '—' },
                      ...funds.filter((f) => !f.isArchived).map((f) => ({ value: f.id, label: f.name, searchText: f.name })),
                    ]}
                    searchPlaceholder="Фонд…"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">В фонд</label>
                  <EntitySearchSelect
                    value={fundTransferTo}
                    onChange={setFundTransferTo}
                    options={[
                      { value: '', label: '—' },
                      ...funds.filter((f) => !f.isArchived).map((f) => ({ value: f.id, label: f.name, searchText: f.name })),
                    ]}
                    searchPlaceholder="Фонд…"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Сумма UZS</label>
                  <input
                    value={fundTransferAmount}
                    onChange={(e) => setFundTransferAmount(e.target.value)}
                    className="w-full border border-gray-300 dark:border-[#555] rounded-lg px-3 py-2 bg-white dark:bg-[#333] text-gray-900 dark:text-gray-100"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <Button type="button" variant="secondary" onClick={() => setPlanningFundTransferOpen(false)} size="md">
                  Отмена
                </Button>
                <Button
                  type="button"
                  size="md"
                  onClick={() => {
                    const amt = Number(fundTransferAmount.replace(/\s/g, '').replace(/,/g, '.')) || 0;
                    if (amt <= 0 || !fundTransferFrom || !fundTransferTo || fundTransferFrom === fundTransferTo) return;
                    setPlanningDetailFundMovements((prev) => [
                      ...prev,
                      {
                        id: `fm-${Date.now()}`,
                        fromFundId: fundTransferFrom,
                        toFundId: fundTransferTo,
                        amount: amt,
                        at: new Date().toISOString(),
                      },
                    ]);
                    setPlanningDetailFundAllocations((prev) => ({
                      ...prev,
                      [fundTransferFrom]: (Number(prev[fundTransferFrom]) || 0) - amt,
                      [fundTransferTo]: (Number(prev[fundTransferTo]) || 0) + amt,
                    }));
                    setPlanningFundTransferOpen(false);
                    setFundTransferAmount('');
                  }}
                >
                  Применить
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // --- Render Plan List ---
  const renderPlanList = () => {
    const sorted = [...filteredPlanDocs].sort(
      (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );
    return (
      <div className="space-y-6">
        {sorted.length === 0 ? (
          <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-xl p-12 text-center">
            <FileText size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
            <p className="text-gray-400 dark:text-gray-500 text-sm mb-2">
              {financeArchiveScope === 'archived' ? 'Нет архивных документов плана' : 'Нет планов'}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              {financeArchiveScope === 'archived'
                ? 'Архивные документы появятся после перемещения в архив'
                : 'Создайте первый план через кнопку с плюсом в шапке'}
            </p>
          </div>
        ) : (
          <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-xl overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 dark:bg-[#202020] border-b border-gray-200 dark:border-[#333]">
                <tr>
                  <th className="px-4 py-3 text-gray-600 dark:text-gray-400">Период</th>
                  <th className="px-4 py-3 text-gray-600 dark:text-gray-400">Подразделение</th>
                  <th className="px-4 py-3 text-gray-600 dark:text-gray-400">Доход</th>
                  <th className="px-4 py-3 text-gray-600 dark:text-gray-400">Расход</th>
                  <th className="px-4 py-3 text-gray-600 dark:text-gray-400">Статус</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-[#333]">
                {sorted.map((planDoc) => {
                  const periodLabel = planDocRowPeriodLabel(planDoc);
                  const totalExpenses = sumMoney(Object.values(planDoc.expenses || {}) as number[]);
                  const dep = departments.find((d) => d.id === planDoc.departmentId);
                  return (
                    <tr
                      key={planDoc.id}
                      className="hover:bg-gray-50 dark:hover:bg-[#303030] cursor-pointer group"
                      onClick={() => {
                        setSelectedPlanDoc(planDoc);
                        setPlanSubView('detail');
                      }}
                    >
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{periodLabel}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400 text-xs">{dep?.name || '—'}</td>
                      <td className="px-4 py-3 font-bold text-gray-900 dark:text-gray-100">
                        {(planDoc.income || 0).toLocaleString()} UZS
                      </td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{totalExpenses.toLocaleString()} UZS</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${getStatusColor(planDoc.status)}`}>
                          {getStatusLabel(planDoc.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          {financeArchiveScope === 'active' ? (
                            <button
                              type="button"
                              onClick={(e) => archiveFinancialPlanDocument(e, planDoc)}
                              className="text-gray-400 hover:text-amber-600 dark:hover:text-amber-400"
                              title="В архив"
                            >
                              <Archive size={14} />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => restoreFinancialPlanDocument(e, planDoc)}
                              className="text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400"
                              title="Восстановить"
                            >
                              <RotateCcw size={14} />
                            </button>
                          )}
                          <ArrowRight size={16} className="text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-200" />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  // --- Render Plan Detail ---
  const renderPlanDetail = () => {
    if (!selectedPlanDoc) return null;
    
    const dep = departments.find(d => d.id === planDetailDepartmentId);
    const periodLabel = formatRangeLabel(planDetailPeriodStart, planDetailPeriodEnd, selectedPlanDoc.period);
    
    const hasChanges = (): boolean => {
      if (!planDetailInitialValuesRef.current) return false;
      return (
        planDetailIncome !== planDetailInitialValuesRef.current.income ||
        JSON.stringify(planDetailExpenses) !== JSON.stringify(planDetailInitialValuesRef.current.expenses) ||
        JSON.stringify([...planDetailSelectedCategories].sort()) !== JSON.stringify([...planDetailInitialValuesRef.current.selectedCategories].sort()) ||
        planDetailDepartmentId !== (planDetailInitialValuesRef.current.departmentId || '') ||
        planDetailPeriodStart !== (planDetailInitialValuesRef.current.periodStart || '') ||
        planDetailPeriodEnd !== (planDetailInitialValuesRef.current.periodEnd || '') ||
        JSON.stringify(planDetailWeekBreakdown) !== JSON.stringify(planDetailInitialValuesRef.current.weekBreakdown ?? [])
      );
    };
    
    const handleBack = () => {
      const goList = () => {
        setPlanSubView('list');
        setSelectedPlanDoc(null);
      };
      if (!hasChanges()) {
        goList();
        return;
      }
      if (window.confirm('Сохранить изменения перед выходом?')) {
        handleSave();
      }
      goList();
    };
    
    const handleSave = () => {
      if (!onSaveFinancialPlanDocument) return;
      // Оставляем только выбранные категории
      const filteredExpenses: Record<string, number> = {};
      planDetailSelectedCategories.forEach(catId => {
        if (planDetailExpenses[catId] !== undefined) {
          filteredExpenses[catId] = planDetailExpenses[catId];
        }
      });
      const hasWeeks = planDetailWeekBreakdown.length > 0;
      const updated: FinancialPlanDocument = {
        ...selectedPlanDoc,
        departmentId: planDetailDepartmentId || selectedPlanDoc.departmentId,
        period: canonicalFinancialMonthYm(selectedPlanDoc.period, planDetailPeriodStart, currentPeriod),
        periodStart: planDetailPeriodStart || undefined,
        periodEnd: planDetailPeriodEnd || undefined,
        income: planDetailIncome,
        expenses: filteredExpenses,
        weekBreakdown: hasWeeks ? planDetailWeekBreakdown : [],
        planSeriesId: hasWeeks ? undefined : selectedPlanDoc.planSeriesId,
        periodLabel: hasWeeks ? undefined : selectedPlanDoc.periodLabel,
        updatedAt: new Date().toISOString(),
      };
      onSaveFinancialPlanDocument(updated);
      planDetailInitialValuesRef.current = {
        income: planDetailIncome,
        expenses: filteredExpenses,
        selectedCategories: planDetailSelectedCategories,
        departmentId: planDetailDepartmentId,
        periodStart: planDetailPeriodStart,
        periodEnd: planDetailPeriodEnd,
        weekBreakdown: hasWeeks ? planDetailWeekBreakdown.map((w) => ({ ...w, expenses: { ...w.expenses } })) : [],
      };
    };
    
    const remainingForFixed = subtractMoney(planDetailIncome, planDetailTotalPercentExpenses);

    const availableCategories = categories.filter(cat => !planDetailSelectedCategories.includes(cat.id));
    
    const addCategory = (catId: string) => {
      if (!planDetailSelectedCategories.includes(catId)) {
        setPlanDetailSelectedCategories([...planDetailSelectedCategories, catId]);
        setPlanDetailExpenses({ ...planDetailExpenses, [catId]: 0 });
      }
      setPlanDetailCategoryDropdownOpen(false);
    };
    
    const removeCategory = (catId: string) => {
      setPlanDetailSelectedCategories(planDetailSelectedCategories.filter(id => id !== catId));
      const newExpenses = { ...planDetailExpenses };
      delete newExpenses[catId];
      setPlanDetailExpenses(newExpenses);
    };
    
    const handleApprove = () => {
      if (!onSaveFinancialPlanDocument || !hasPermission(currentUser, 'finance.approve')) return;
      if (confirm('Утвердить план?')) {
        const updated: FinancialPlanDocument = {
          ...selectedPlanDoc,
          status: 'approved',
          approvedBy: currentUser.id,
          approvedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        setSelectedPlanDoc(updated);
        onSaveFinancialPlanDocument(updated);
      }
    };
    
    const handleConduct = () => {
      if (!onSaveFinancialPlanDocument) return;
      const updated: FinancialPlanDocument = {
        ...selectedPlanDoc,
        status: 'conducted',
        updatedAt: new Date().toISOString()
      };
      setSelectedPlanDoc(updated);
      onSaveFinancialPlanDocument(updated);
    };

    const isPlanDocArchived = selectedPlanDoc.isArchived === true;

    const handleArchivePlanDocFromDetail = () => {
      if (!onSaveFinancialPlanDocument) return;
      if (!confirm('Переместить документ плана в архив?')) return;
      onSaveFinancialPlanDocument({ ...selectedPlanDoc, isArchived: true, updatedAt: new Date().toISOString() });
      setPlanSubView('list');
      setSelectedPlanDoc(null);
    };

    const handleRestorePlanDocFromDetail = () => {
      if (!onSaveFinancialPlanDocument) return;
      onSaveFinancialPlanDocument({ ...selectedPlanDoc, isArchived: false, updatedAt: new Date().toISOString() });
    };
    
    const balance = subtractMoney(planDetailIncome, planDetailTotalExpenses);

    const buildFilteredPlanExpenses = (): Record<string, number> => {
      const out: Record<string, number> = {};
      planDetailSelectedCategories.forEach((catId) => {
        if (planDetailExpenses[catId] !== undefined) out[catId] = planDetailExpenses[catId];
      });
      return out;
    };

    const handleSplitPlanToWeeks = () => {
      const ym = /^\d{4}-\d{2}$/.test((selectedPlanDoc.period || '').trim())
        ? selectedPlanDoc.period.trim()
        : (planDetailPeriodStart || '').slice(0, 7);
      if (!/^\d{4}-\d{2}$/.test(ym)) {
        setAlertText('Укажите корректный месяц плана (период YYYY-MM).');
        return;
      }
      const slices = allocateMonthPlanToWeekSlices(
        ym,
        Number(planDetailIncome) || 0,
        buildFilteredPlanExpenses(),
        planDetailSelectedCategories
      );
      if (slices.length <= 1) {
        setAlertText('Для этого месяца недельное разбиение не требуется или получается одна неделя.');
        return;
      }
      if (
        !confirm(
          `Заполнить разбиение по ${slices.length} неделям внутри этого плана (месяц ${ym})? Документ плана останется один; итоги месяца — в полях «Доход» и статьи выше. Не забудьте нажать «Сохранить».`
        )
      )
        return;
      const fb = getDefaultRangeForMonth(ym);
      setPlanDetailPeriodStart(fb.start);
      setPlanDetailPeriodEnd(fb.end);
      setPlanDetailWeekBreakdown(slices);
    };

    const handleRecalculateWeekBreakdown = () => {
      const ym = /^\d{4}-\d{2}$/.test((selectedPlanDoc.period || '').trim())
        ? selectedPlanDoc.period.trim()
        : (planDetailPeriodStart || '').slice(0, 7);
      if (!/^\d{4}-\d{2}$/.test(ym)) {
        setAlertText('Укажите корректный месяц плана (период YYYY-MM).');
        return;
      }
      const slices = allocateMonthPlanToWeekSlices(
        ym,
        Number(planDetailIncome) || 0,
        buildFilteredPlanExpenses(),
        planDetailSelectedCategories
      );
      if (!slices.length) {
        setAlertText('Не удалось пересчитать недели для выбранного месяца.');
        return;
      }
      const fb = getDefaultRangeForMonth(ym);
      setPlanDetailPeriodStart(fb.start);
      setPlanDetailPeriodEnd(fb.end);
      setPlanDetailWeekBreakdown(slices);
    };

    const handleClearWeekBreakdown = () => {
      if (!planDetailWeekBreakdown.length) return;
      if (!confirm('Убрать недельное разбиение из этого плана?')) return;
      setPlanDetailWeekBreakdown([]);
    };
    
    return (
      <div className="flex flex-col flex-1 min-h-0 -mx-4 md:-mx-6">
        <div className="hidden print:block px-4 py-4 border-b-2 border-black text-black">
          <h1 className="text-xl font-bold">План (печать)</h1>
          <p className="text-sm mt-1">{dep?.name || '—'} · {periodLabel}</p>
          <p className="text-xs text-gray-600 mt-2">Сформировано: {new Date().toLocaleString('ru-RU')}</p>
          {planDetailWeekBreakdown.length > 0 && (
            <table className="mt-4 w-full text-xs border border-black border-collapse">
              <thead>
                <tr>
                  <th className="border border-black p-1 text-left">Неделя</th>
                  <th className="border border-black p-1 text-left">Даты</th>
                  <th className="border border-black p-1 text-right">Доход</th>
                  {planDetailSelectedCategories.map((cid) => (
                    <th key={cid} className="border border-black p-1 text-right">
                      {categories.find((c) => c.id === cid)?.name || cid}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {planDetailWeekBreakdown.map((row, ri) => (
                  <tr key={`p-${row.start}-${ri}`}>
                    <td className="border border-black p-1">{row.label || `Неделя ${ri + 1}`}</td>
                    <td className="border border-black p-1">
                      {row.start} — {row.end}
                    </td>
                    <td className="border border-black p-1 text-right">{Number(row.income || 0).toLocaleString('ru-RU')}</td>
                    {planDetailSelectedCategories.map((cid) => (
                      <td key={cid} className="border border-black p-1 text-right">
                        {Number(row.expenses?.[cid] || 0).toLocaleString('ru-RU')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="sticky top-0 z-20 flex flex-wrap items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-[#333] bg-white/95 dark:bg-[#191919]/95 backdrop-blur-md print:hidden">
          <button
            type="button"
            onClick={handleBack}
            className="p-2 rounded-xl border border-gray-200 dark:border-[#333] hover:bg-gray-50 dark:hover:bg-[#252525] transition-colors print:hidden"
          >
            <ArrowLeft size={20} className="text-gray-600 dark:text-gray-400" />
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white truncate">
              План
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {dep?.name || '—'} · {periodLabel}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end print:hidden">
            <button
              type="button"
              onClick={() => window.print()}
              className="px-3 py-2 border border-gray-200 dark:border-[#444] text-gray-700 dark:text-gray-200 text-sm font-medium rounded-xl flex items-center gap-2"
            >
              <Printer size={16} />
              Печать
            </button>
            {!isPlanDocArchived && (
              <button
                type="button"
                onClick={handleSplitPlanToWeeks}
                title="Заполнить таблицу недель в этом же документе (без создания новых планов)"
                className="px-3 py-2 border border-indigo-200 dark:border-indigo-900 text-indigo-800 dark:text-indigo-200 text-sm font-medium rounded-xl"
              >
                Недели внутри плана
              </button>
            )}
            {isPlanDocArchived ? (
              <button
                type="button"
                onClick={handleRestorePlanDocFromDetail}
                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-xl flex items-center gap-2"
              >
                <RotateCcw size={16} />
                Восстановить
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    if (selectedPlanDoc.status === 'created') return handleConduct();
                    if (selectedPlanDoc.status === 'conducted' && hasPermission(currentUser, 'finance.approve')) return handleApprove();
                  }}
                  disabled={!(selectedPlanDoc.status === 'created' || (selectedPlanDoc.status === 'conducted' && hasPermission(currentUser, 'finance.approve')))}
                  className={`px-3 py-2 rounded-xl text-sm font-bold uppercase border transition-colors ${
                    (selectedPlanDoc.status === 'created' || (selectedPlanDoc.status === 'conducted' && hasPermission(currentUser, 'finance.approve')))
                      ? 'cursor-pointer hover:opacity-90'
                      : 'cursor-default opacity-70'
                  } ${getStatusColor(selectedPlanDoc.status)} border-transparent`}
                  title={
                    selectedPlanDoc.status === 'created'
                      ? 'Нажмите, чтобы провести'
                      : selectedPlanDoc.status === 'conducted' && hasPermission(currentUser, 'finance.approve')
                      ? 'Нажмите, чтобы утвердить'
                      : 'Статус'
                  }
                >
                  {selectedPlanDoc.status === 'created'
                    ? 'Провести'
                    : selectedPlanDoc.status === 'conducted' && hasPermission(currentUser, 'finance.approve')
                    ? 'Утвердить'
                    : getStatusLabel(selectedPlanDoc.status)}
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="px-3 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-medium hover:opacity-90 rounded-xl flex items-center gap-2"
                >
                  <Save size={16} />
                  Сохранить
                </button>
                <button
                  type="button"
                  onClick={handleArchivePlanDocFromDetail}
                  className="px-3 py-2 border border-gray-200 dark:border-[#444] text-gray-700 dark:text-gray-200 text-sm font-medium hover:bg-gray-50 dark:hover:bg-[#252525] rounded-xl flex items-center gap-2"
                  title="В архив"
                >
                  <Archive size={16} />
                  В архив
                </button>
              </>
            )}
          </div>
        </div>
        <div className={`${MODULE_PAGE_GUTTER} py-6 flex-1 overflow-y-auto custom-scrollbar min-h-0`}>
        <fieldset disabled={isPlanDocArchived} className="border-0 p-0 m-0 min-w-0 space-y-6 flex flex-col">

        {/* Период + подразделение */}
        <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-xl p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">
                Подразделение
              </label>
              <EntitySearchSelect
                value={planDetailDepartmentId}
                onChange={setPlanDetailDepartmentId}
                options={departments.map((d) => ({ value: d.id, label: d.name, searchText: d.name }))}
                searchPlaceholder="Подразделение…"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">
                Период (месяц)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <DateInput value={planDetailPeriodStart} onChange={setPlanDetailPeriodStart} placeholder="Дата начала" />
                <DateInput value={planDetailPeriodEnd} onChange={setPlanDetailPeriodEnd} placeholder="Дата конца" />
              </div>
            </div>
          </div>
        </div>
        
        {/* Доход */}
        <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-xl p-6">
          <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">
            Доход (UZS)
          </label>
          <input
            type="number"
            value={planDetailIncome || ''}
            onChange={(e) => setPlanDetailIncome(parseFloat(e.target.value) || 0)}
            className="w-full bg-white dark:bg-[#333] border border-gray-300 dark:border-[#555] rounded-lg px-4 py-3 text-lg font-bold text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
            placeholder="0"
          />
        </div>
        
        {/* Расходы по статьям */}
        <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-xl overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-[#333] flex items-center justify-between">
            <h3 className="font-bold text-gray-800 dark:text-white">Расходы по статьям</h3>
            {availableCategories.length > 0 && (
              <div className="relative" ref={planDetailCategoryDropdownRef}>
                <button
                  onClick={() => setPlanDetailCategoryDropdownOpen(!planDetailCategoryDropdownOpen)}
                  className="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 rounded-lg flex items-center gap-2"
                >
                  <Plus size={14} />
                  Добавить статью
                  <ChevronDown size={14} className={`transition-transform ${planDetailCategoryDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                {planDetailCategoryDropdownOpen && (
                  <div className="absolute top-full right-0 mt-1 w-64 bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-lg shadow-xl z-50 max-h-64 overflow-y-auto custom-scrollbar">
                    {availableCategories.map(cat => (
                      <div
                        key={cat.id}
                        onClick={() => addCategory(cat.id)}
                        className="px-3 py-2 hover:bg-gray-100 dark:hover:bg-[#333] cursor-pointer text-sm text-gray-800 dark:text-gray-200"
                      >
                        {cat.name} ({cat.type === 'percent' ? 'Процентная' : 'Фиксированная'})
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="p-4 space-y-4">
            {planDetailSelectedCategories.length === 0 ? (
              <div className="text-center py-8 text-gray-400 dark:text-gray-500 text-sm">
                Нет выбранных статей расходов. Добавьте статьи через кнопку "Добавить статью".
              </div>
            ) : (
              <>
                {/* Процентные статьи */}
                {planDetailSelectedCategories.filter(catId => {
                  const cat = categories.find(c => c.id === catId);
                  return cat && cat.type === 'percent';
                }).length > 0 && (
                  <div>
                    <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">Процентные</div>
                    <div className="space-y-2">
                      {planDetailSelectedCategories.filter(catId => {
                        const cat = categories.find(c => c.id === catId);
                        return cat && cat.type === 'percent';
                      }).map(catId => {
                        const cat = categories.find(c => c.id === catId)!;
                        const percentAmount = calculatePlanDetailPercentAmount(catId);
                        return (
                          <div key={catId} className="flex items-center gap-3 p-3 rounded-lg border bg-gray-50 dark:bg-[#303030] border-gray-200 dark:border-[#444]">
                            <div className="flex-1 flex items-center gap-3">
                              <span className="font-medium text-gray-900 dark:text-white flex-shrink-0">{cat.name}</span>
                              <input
                                type="number"
                                value={planDetailExpenses[catId] || ''}
                                onChange={(e) => setPlanDetailExpenses({ ...planDetailExpenses, [catId]: parseFloat(e.target.value) || 0 })}
                                className="w-20 bg-white dark:bg-[#333] border border-gray-300 dark:border-[#555] rounded px-2 py-1 text-xs text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-right [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                                placeholder="0"
                                min="0"
                                max="100"
                                step="0.1"
                              />
                              <span className="text-xs text-gray-500 dark:text-gray-400">%</span>
                              {planDetailIncome > 0 && (
                                <>
                                  <span className="text-xs text-gray-400">=</span>
                                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{percentAmount.toLocaleString()} UZS</span>
                                </>
                              )}
                            </div>
                            <button
                              onClick={() => removeCategory(catId)}
                              className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-red-500 hover:text-red-700 dark:hover:text-red-400 transition-colors"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                
                {/* Фиксированные статьи */}
                {planDetailSelectedCategories.filter(catId => {
                  const cat = categories.find(c => c.id === catId);
                  return cat && cat.type === 'fixed';
                }).length > 0 && (
                  <div>
                    <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">Фиксированные</div>
                    {remainingForFixed < 0 && (
                      <div className="mb-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-xs text-red-700 dark:text-red-400">
                        Превышен лимит! Доступно для распределения: {remainingForFixed.toLocaleString()} UZS
                      </div>
                    )}
                    {remainingForFixed >= 0 && (
                      <div className="mb-2 p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded text-xs text-blue-700 dark:text-blue-400">
                        Доступно для распределения: {remainingForFixed.toLocaleString()} UZS
                      </div>
                    )}
                    <div className="space-y-2">
                      {planDetailSelectedCategories.filter(catId => {
                        const cat = categories.find(c => c.id === catId);
                        return cat && cat.type === 'fixed';
                      }).map(catId => {
                        const cat = categories.find(c => c.id === catId)!;
                        const fixedCap = sumMoney([remainingForFixed, planDetailExpenses[catId] || 0]);
                        return (
                          <div key={catId} className="flex items-center gap-3 p-3 rounded-lg border bg-gray-50 dark:bg-[#303030] border-gray-200 dark:border-[#444]">
                            <div className="flex-1 flex items-center gap-3">
                              <span className="font-medium text-gray-900 dark:text-white flex-shrink-0">{cat.name}</span>
                              <input
                                type="number"
                                value={planDetailExpenses[catId] || ''}
                                onChange={(e) => {
                                  const value = parseFloat(e.target.value) || 0;
                                  if (moneyToTiyin(value) <= moneyToTiyin(fixedCap)) {
                                    setPlanDetailExpenses({ ...planDetailExpenses, [catId]: value });
                                  }
                                }}
                                className="w-32 bg-white dark:bg-[#333] border border-gray-300 dark:border-[#555] rounded px-2 py-1 text-xs text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-right [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                                placeholder="0"
                                min="0"
                                max={fixedCap}
                              />
                              <span className="text-xs text-gray-500 dark:text-gray-400">UZS</span>
                            </div>
                            <button
                              onClick={() => removeCategory(catId)}
                              className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-red-500 hover:text-red-700 dark:hover:text-red-400 transition-colors"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
          <div className="p-4 border-t border-gray-200 dark:border-[#333] bg-gray-50 dark:bg-[#303030]">
            <div className="flex items-center justify-between">
              <span className="font-bold text-gray-900 dark:text-white">Итого расходов:</span>
              <span className="font-bold text-gray-900 dark:text-white">{planDetailTotalExpenses.toLocaleString()} UZS</span>
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="font-bold text-gray-900 dark:text-white">Остаток:</span>
              <span className={`font-bold ${balance >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {balance.toLocaleString()} UZS
              </span>
            </div>
          </div>
        </div>

        {planDetailWeekBreakdown.length > 0 && (
          <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-xl overflow-hidden">
            <div className="p-4 border-b border-gray-200 dark:border-[#333] flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-bold text-gray-800 dark:text-white">Разбиение по неделям</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Один документ плана: ниже — доли по календарным неделям месяца. Итог месяца задаётся полями «Доход» и статьи выше.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 print:hidden">
                <button
                  type="button"
                  onClick={handleRecalculateWeekBreakdown}
                  className="px-3 py-1.5 border border-gray-200 dark:border-[#444] text-gray-700 dark:text-gray-200 text-xs font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-[#303030]"
                >
                  Пересчитать доли
                </button>
                <button
                  type="button"
                  onClick={handleClearWeekBreakdown}
                  className="px-3 py-1.5 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-xs font-medium rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30"
                >
                  Убрать недели
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm min-w-[640px]">
                <thead className="bg-gray-50 dark:bg-[#202020] border-b border-gray-200 dark:border-[#333]">
                  <tr>
                    <th className="px-3 py-2 text-gray-600 dark:text-gray-400">Неделя</th>
                    <th className="px-3 py-2 text-gray-600 dark:text-gray-400">Даты</th>
                    <th className="px-3 py-2 text-gray-600 dark:text-gray-400 text-right">Доход</th>
                    {planDetailSelectedCategories.map((cid) => (
                      <th key={cid} className="px-3 py-2 text-gray-600 dark:text-gray-400 text-right whitespace-nowrap">
                        {categories.find((c) => c.id === cid)?.name || cid}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-[#333]">
                  {planDetailWeekBreakdown.map((row, ri) => (
                    <tr key={`${row.start}-${row.end}-${ri}`}>
                      <td className="px-3 py-2 text-gray-800 dark:text-gray-200">{row.label || `Неделя ${ri + 1}`}</td>
                      <td className="px-3 py-2 text-gray-600 dark:text-gray-400 text-xs whitespace-nowrap">
                        {row.start} — {row.end}
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums">{Number(row.income || 0).toLocaleString('ru-RU')}</td>
                      {planDetailSelectedCategories.map((cid) => (
                        <td key={cid} className="px-3 py-2 text-right font-mono tabular-nums text-xs">
                          {Number(row.expenses?.[cid] || 0).toLocaleString('ru-RU')}
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr className="bg-gray-50 dark:bg-[#282828] font-semibold">
                    <td className="px-3 py-2 text-gray-800 dark:text-gray-100" colSpan={2}>
                      Σ по неделям
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums">
                      {sumMoney(planDetailWeekBreakdown.map((w) => Number(w.income) || 0)).toLocaleString('ru-RU')}
                    </td>
                    {planDetailSelectedCategories.map((cid) => (
                      <td key={cid} className="px-3 py-2 text-right font-mono tabular-nums text-xs">
                        {sumMoney(
                          planDetailWeekBreakdown.map((w) => Number(w.expenses?.[cid]) || 0)
                        ).toLocaleString('ru-RU')}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
        
        {/* Статус */}
        <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-xl p-6">
          <div>
            <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Статус</div>
            <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase ${getStatusColor(selectedPlanDoc.status)}`}>
              {getStatusLabel(selectedPlanDoc.status)}
            </span>
          </div>
        </div>
        </fieldset>
        </div>
      </div>
    );
  };

  // --- Render Requests Tab ---
  const renderRequestsTab = () => {
      return (
      <div className="space-y-6">
          <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-xl overflow-hidden">
              <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 dark:bg-[#202020] border-b border-gray-200 dark:border-[#333]">
                      <tr>
                          <th className="px-4 py-3 text-gray-600 dark:text-gray-400">Дата</th>
                          <th className="px-4 py-3 text-gray-600 dark:text-gray-400">Сотрудник</th>
                          <th className="px-4 py-3 text-gray-600 dark:text-gray-400">Подразделение</th>
                          <th className="px-4 py-3 text-gray-600 dark:text-gray-400">Статья</th>
                          <th className="px-4 py-3 text-gray-600 dark:text-gray-400">Сумма</th>
                          <th className="px-4 py-3 text-gray-600 dark:text-gray-400">Описание</th>
                          <th className="px-4 py-3 text-gray-600 dark:text-gray-400">Статус</th>
                          <th className="px-4 py-3"></th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-[#333]">
                      {filteredFinanceRequests.map(req => {
                          const cat = categories.find(c => c.id === (req.categoryId || req.category));
                          const dep = departments.find(d => d.id === req.departmentId);
                          const user = users.find(u => u.id === (req.requesterId || req.requestedBy));
                          const descLine = (req.description ?? req.comment ?? '').replace(/\s*\[paymentDate:[0-9]{4}-[0-9]{2}-[0-9]{2}\]\s*/g, '').trim();
                          const payHint = req.paymentDate || ((req.description ?? req.comment ?? '').match(/\[paymentDate:([0-9]{4}-[0-9]{2}-[0-9]{2})\]/) || [])[1];
                          
                          return (
                              <tr key={req.id} className="hover:bg-gray-50 dark:hover:bg-[#303030]">
                                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">{req.date ? new Date(req.date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '.') : '—'}</td>
                                  <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-200">{user?.name}</td>
                                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400 text-xs">{dep?.name}</td>
                                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400 text-xs">{cat?.name}</td>
                                  <td className="px-4 py-3 font-bold text-gray-900 dark:text-gray-100">{requestAmountLabel(req.amount)}</td>
                                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400 truncate max-w-xs">
                                    <span className="font-medium text-gray-800 dark:text-gray-200">{req.title ? `${req.title} — ` : ''}</span>
                                    {descLine}
                                    {payHint && (
                                      <span className="ml-1 text-xs text-emerald-600 dark:text-emerald-400">
                                        • Оплата до {payHint}
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3">
                                      <div className="flex flex-col gap-1 items-start">
                                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                                            req.status === 'paid' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300' :
                                            req.status === 'approved' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                            req.status === 'rejected' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                            req.status === 'draft' || req.status === 'deferred' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                                            'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                                        }`}>
                                            {req.status === 'paid' ? 'Оплачено' : req.status === 'approved' ? 'Одобрено' : req.status === 'rejected' ? 'Отклонено' : req.status === 'draft' || req.status === 'deferred' ? 'Черновик' : 'Ожидание'}
                                        </span>
                                        {hasPermission(currentUser, 'finance.approve') && !req.isArchived && (
                                          <div className="flex flex-wrap gap-1">
                                            {req.status === 'draft' && (
                                              <button type="button" className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline" onClick={() => handleStatusChange(req, 'pending')}>На согласование</button>
                                            )}
                                            {req.status === 'pending' && (
                                              <>
                                                <button type="button" className="text-[10px] text-emerald-600 dark:text-emerald-400 hover:underline" onClick={() => handleStatusChange(req, 'approved')}>Одобрить</button>
                                                <button type="button" className="text-[10px] text-rose-600 dark:text-rose-400 hover:underline" onClick={() => handleStatusChange(req, 'rejected')}>Отклонить</button>
                                              </>
                                            )}
                                            {req.status === 'approved' && (
                                              <button type="button" className="text-[10px] text-emerald-700 dark:text-emerald-300 hover:underline" onClick={() => handleStatusChange(req, 'paid')}>Оплачено</button>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                      <div className="flex items-center justify-end gap-2">
                                          {financeArchiveScope === 'active' ? (
                                            <button
                                              type="button"
                                              onClick={(e) => archivePurchaseRequest(e, req)}
                                              className="text-gray-400 hover:text-amber-600 dark:hover:text-amber-400"
                                              title="В архив"
                                            >
                                              <Archive size={14} />
                                            </button>
                                          ) : (
                                            <button
                                              type="button"
                                              onClick={(e) => restorePurchaseRequest(e, req)}
                                              className="text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400"
                                              title="Восстановить"
                                            >
                                              <RotateCcw size={14} />
                                            </button>
                                          )}
                                          <button 
                                              type="button"
                                              onClick={() => handleOpenRequestEdit(req)} 
                                              className="text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                                              title="Редактировать"
                                              disabled={
                                                req.isArchived === true ||
                                                req.status === 'approved' ||
                                                req.status === 'paid'
                                              }
                                            >
                                              <Edit2 size={14}/>
                                          </button>
                                          {hasPermission(currentUser, 'finance.approve') && (
                                              <button type="button" onClick={() => { if(confirm('Удалить?')) onDeleteRequest(req.id) }} className="text-gray-400 hover:text-red-600"><Trash2 size={14}/></button>
                                          )}
                                      </div>
                                  </td>
                              </tr>
                          );
                      })}
                  </tbody>
              </table>
          </div>
      </div>
  );
  };

  const handleQuickCreatePlan = () => {
    if (!onSaveFinancialPlanDocument) {
      setAlertText('Функция сохранения недоступна');
      return;
    }
    if (departments.length === 0) {
      setAlertText('Сначала создайте подразделение в настройках');
      return;
    }
    const { start, end } = getDefaultRangeForMonth(currentPeriod);
    const planDoc: FinancialPlanDocument = {
      id: `fpd-${Date.now()}`,
      departmentId: departments[0].id,
      period: currentPeriod,
      periodStart: start,
      periodEnd: end,
      income: 0,
      expenses: {},
      status: 'created',
      createdAt: new Date().toISOString(),
    };
    onSaveFinancialPlanDocument(planDoc);
    setFinanceArchiveScope('active');
    setActiveTab('plan');
    setSelectedPlanDoc(planDoc);
    setPlanSubView('detail');
  };

  const handleQuickCreatePlanning = () => {
    if (!onSaveFinancialPlanning) {
      setAlertText('Функция сохранения недоступна');
      return;
    }
    if (departments.length === 0) {
      setAlertText('Сначала создайте подразделение в настройках');
      return;
    }
    const { start, end } = getDefaultRangeForMonth(currentPeriod);
    const planning: FinancialPlanning = {
      id: `fp-${Date.now()}`,
      departmentId: departments[0].id,
      period: currentPeriod,
      periodStart: start,
      periodEnd: end,
      income: 0,
      requestIds: [],
      status: 'created',
      createdAt: new Date().toISOString(),
    };
    onSaveFinancialPlanning(planning);
    setFinanceArchiveScope('active');
    setActiveTab('planning');
    setSelectedPlanning(planning);
    setPlanningSubView('detail');
  };

  const financeTabOptions = useMemo(
    () => [
      { value: 'planning' as const, label: 'Бюджет' },
      { value: 'bdr' as const, label: 'БДР' },
      { value: 'requests' as const, label: 'Заявки' },
      { value: 'statements' as const, label: 'Выписки и сверка' },
      ...(hasPermission(currentUser, 'finance.approve') ? [{ value: 'plan' as const, label: 'План' }] : []),
    ],
    [currentUser.permissions]
  );

  const handleFinanceTabChange = useCallback((tabId: string) => {
    setPlanningSubView('list');
    setPlanSubView('list');
    setSelectedPlanning(null);
    setSelectedPlanDoc(null);
    if (tabId === 'planning') {
      setActiveTab('planning');
    } else if (tabId === 'plan') {
      setActiveTab('plan');
    } else if (tabId === 'statements') {
      setActiveTab('statements');
    } else if (tabId === 'bdr') {
      setActiveTab('bdr');
    } else {
      setActiveTab('requests');
    }
  }, []);

  useLayoutEffect(() => {
    if (financeFullScreen) {
      setLeading(null);
      setModule(null);
      return;
    }
    const tabActive = MODULE_ACCENTS.emerald.navIconActive;
    const idle = MODULE_TOOLBAR_TAB_IDLE;
    setLeading(
      <div className="flex items-center gap-0.5 shrink-0 flex-wrap sm:flex-nowrap" role="tablist" aria-label="Финансы">
        {financeTabOptions.map((opt) => (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={activeTab === opt.value}
            onClick={() => handleFinanceTabChange(opt.value)}
            className={`px-2 sm:px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-medium whitespace-nowrap transition-colors ${
              activeTab === opt.value ? tabActive : idle
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    );
    setModule(
      <div className={APP_TOOLBAR_MODULE_CLUSTER}>
        {activeTab === 'planning' && planningSubView === 'list' && (
          <ModuleFilterIconButton
            accent="emerald"
            size="sm"
            active={showPlanningFilters || hasActivePlanningFilters}
            activeCount={planningFilters.filter((f) => f.value && f.value !== 'all' && f.value !== '' && f.value !== 'hide').length}
            onClick={() => setShowPlanningFilters(!showPlanningFilters)}
          />
        )}
        {activeTab === 'plan' && planSubView === 'list' && (
          <ModuleFilterIconButton
            accent="emerald"
            size="sm"
            active={showPlanFilters || hasActivePlanFilters}
            activeCount={planFilters.filter((f) => f.value && f.value !== 'all' && f.value !== '' && f.value !== 'hide').length}
            onClick={() => setShowPlanFilters(!showPlanFilters)}
          />
        )}
        {activeTab === 'requests' && (
          <ModuleFilterIconButton
            accent="emerald"
            size="sm"
            active={showRequestFilters || hasActiveRequestFilters}
            activeCount={requestFilters.filter((f) => f.value && f.value !== 'all' && f.value !== '' && f.value !== 'hide').length}
            onClick={() => setShowRequestFilters(!showRequestFilters)}
          />
        )}
        {activeTab === 'statements' && (
          <ModuleFilterIconButton
            accent="emerald"
            size="sm"
            active={statementFiltersOpen}
            label="Фильтры выписок"
            onClick={() => {
              bankStatementsRef.current?.toggleFilters();
              setStatementFiltersOpen((o) => !o);
            }}
          />
        )}
        <ModuleCreateDropdown
          accent="emerald"
          buttonSize="sm"
          label={activeTab === 'statements' ? 'Действия' : 'Создать'}
          items={[
            ...(activeTab === 'statements'
              ? [
                  {
                    id: 'upload-statement',
                    label: 'Загрузить выписку',
                    icon: Upload,
                    onClick: () => bankStatementsRef.current?.triggerUpload(),
                  },
                ]
              : []),
            {
              id: 'create-request',
              label: 'Заявка на приобретение',
              icon: DollarSign,
              onClick: handleOpenRequestCreate,
            },
            {
              id: 'create-fin-plan',
              label: 'План',
              icon: FileText,
              onClick: () => {
                handleQuickCreatePlan();
              },
            },
            {
              id: 'create-fin-planning',
              label: 'Бюджет',
              icon: PieChart,
              onClick: () => {
                handleQuickCreatePlanning();
              },
            },
          ]}
        />
      </div>
    );
    return () => {
      setLeading(null);
      setModule(null);
    };
  }, [
    financeFullScreen,
    financeTabOptions,
    activeTab,
    planningSubView,
    planSubView,
    financeArchiveScope,
    handleFinanceTabChange,
    showPlanningFilters,
    hasActivePlanningFilters,
    planningFilters,
    showPlanFilters,
    hasActivePlanFilters,
    planFilters,
    showRequestFilters,
    hasActiveRequestFilters,
    requestFilters,
    setLeading,
    setModule,
    statementFiltersOpen,
  ]);

  const hasFinanceFilterStrip =
    !financeFullScreen &&
    ((showPlanningFilters && activeTab === 'planning' && planningSubView === 'list') ||
      (showPlanFilters && activeTab === 'plan' && planSubView === 'list') ||
      (showRequestFilters && activeTab === 'requests'));

  return (
    <ModulePageShell className="finance-print-shell flex-1 min-h-0 flex flex-col overflow-hidden">
      <style>{`
        @media print {
          .finance-print-shell * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .finance-print-shell .custom-scrollbar { overflow: visible !important; height: auto !important; }
        }
      `}</style>
      {!financeFullScreen && showPlanningFilters && activeTab === 'planning' && planningSubView === 'list' && (
        <div className={`${MODULE_PAGE_GUTTER} ${MODULE_PAGE_TOP_PAD} pb-2 flex-shrink-0 border-b border-gray-200 dark:border-[#333]`}>
          <div className="p-4 bg-gray-50 dark:bg-[#252525] rounded-lg border border-gray-200 dark:border-[#333]">
            <div className="flex items-center justify-end mb-3">
              <ModuleSegmentedControl
                size="sm"
                variant="neutral"
                value={financeArchiveScope}
                onChange={(v) => setFinanceArchiveScope(v as 'active' | 'archived')}
                options={[
                  { value: 'active', label: 'Активные' },
                  { value: 'archived', label: 'Архив' },
                ]}
              />
            </div>
            <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(150px, 1fr))`, maxWidth: '100%' }}>
              {planningFilters.map((filter, index) => (
                <div key={index}>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">{filter.label}</label>
                  <EntitySearchSelect
                    value={filter.value}
                    onChange={filter.onChange}
                    options={filter.options.map((o) => ({ ...o, searchText: o.label }))}
                  />
                </div>
              ))}
            </div>
            {hasActivePlanningFilters && (
              <div className="mt-3 flex justify-end">
                <button onClick={clearPlanningFilters} className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 flex items-center gap-1">
                  <X size={14} /> Очистить фильтры
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      {!financeFullScreen && showPlanFilters && activeTab === 'plan' && planSubView === 'list' && (
        <div className={`${MODULE_PAGE_GUTTER} ${MODULE_PAGE_TOP_PAD} pb-2 flex-shrink-0 border-b border-gray-200 dark:border-[#333]`}>
          <div className="p-4 bg-gray-50 dark:bg-[#252525] rounded-lg border border-gray-200 dark:border-[#333]">
            <div className="flex items-center justify-end mb-3">
              <ModuleSegmentedControl
                size="sm"
                variant="neutral"
                value={financeArchiveScope}
                onChange={(v) => setFinanceArchiveScope(v as 'active' | 'archived')}
                options={[
                  { value: 'active', label: 'Активные' },
                  { value: 'archived', label: 'Архив' },
                ]}
              />
            </div>
            <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(150px, 1fr))`, maxWidth: '100%' }}>
              {planFilters.map((filter, index) => (
                <div key={index}>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">{filter.label}</label>
                  <EntitySearchSelect
                    value={filter.value}
                    onChange={filter.onChange}
                    options={filter.options.map((o) => ({ ...o, searchText: o.label }))}
                  />
                </div>
              ))}
            </div>
            {hasActivePlanFilters && (
              <div className="mt-3 flex justify-end">
                <button onClick={clearPlanFilters} className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 flex items-center gap-1">
                  <X size={14} /> Очистить фильтры
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      {!financeFullScreen && showRequestFilters && activeTab === 'requests' && (
        <div className={`${MODULE_PAGE_GUTTER} ${MODULE_PAGE_TOP_PAD} pb-2 flex-shrink-0 border-b border-gray-200 dark:border-[#333]`}>
          <div className="p-4 bg-gray-50 dark:bg-[#252525] rounded-lg border border-gray-200 dark:border-[#333]">
            <div className="flex items-center justify-end mb-3">
              <ModuleSegmentedControl
                size="sm"
                variant="neutral"
                value={financeArchiveScope}
                onChange={(v) => setFinanceArchiveScope(v as 'active' | 'archived')}
                options={[
                  { value: 'active', label: 'Активные' },
                  { value: 'archived', label: 'Архив' },
                ]}
              />
            </div>
            <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(150px, 1fr))`, maxWidth: '100%' }}>
              {requestFilters.map((filter, index) => (
                <div key={index}>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">{filter.label}</label>
                  <EntitySearchSelect
                    value={filter.value}
                    onChange={filter.onChange}
                    options={filter.options.map((o) => ({ ...o, searchText: o.label }))}
                  />
                </div>
              ))}
            </div>
            {hasActiveRequestFilters && (
              <div className="mt-3 flex justify-end">
                <button onClick={clearRequestFilters} className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 flex items-center gap-1">
                  <X size={14} /> Очистить фильтры
                </button>
              </div>
            )}
          </div>
        </div>
      )}
       <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
         <div
           className={`${MODULE_PAGE_GUTTER} ${
             hasFinanceFilterStrip ? 'pt-2 sm:pt-3' : MODULE_PAGE_TOP_PAD
           } pb-20 h-full overflow-y-auto custom-scrollbar flex-1 flex flex-col min-h-0`}
         >
           {activeTab === 'planning' && planningSubView === 'list' && renderPlanningList()}
           {/* creation planning moved to modal */}
           {activeTab === 'planning' && planningSubView === 'detail' && selectedPlanning && renderPlanningDetail()}
           {activeTab === 'bdr' && onLoadBdr && onSaveBdr && (
             <BdrView bdr={bdr ?? null} onLoadBdr={onLoadBdr} onSaveBdr={onSaveBdr} />
           )}
           {activeTab === 'requests' && renderRequestsTab()}
           {activeTab === 'statements' && (
             <BankStatementsView
               ref={bankStatementsRef}
               purchaseRequests={requests}
               financialPlannings={financialPlannings}
               onRefreshPurchaseRequests={onRefreshPurchaseRequests}
             />
           )}
           {activeTab === 'plan' && planSubView === 'list' && renderPlanList()}
           {activeTab === 'plan' && planSubView === 'detail' && selectedPlanDoc && renderPlanDetail()}
         </div>
       </div>

       {/* Request Modal */}
       {isRequestModalOpen && (
        <div className="fixed inset-0 bg-black/35 backdrop-blur-sm flex items-end md:items-center justify-center z-[220] animate-in fade-in duration-200" onClick={(e) => { if(e.target === e.currentTarget) setIsRequestModalOpen(false) }}>
            <div className="bg-white dark:bg-[#252525] rounded-t-2xl md:rounded-xl shadow-2xl w-full max-w-2xl max-h-[95vh] md:max-h-[90vh] overflow-hidden border border-gray-200 dark:border-[#333] flex flex-col">
                <div className="p-4 border-b border-gray-100 dark:border-[#333] flex justify-between items-center bg-white dark:bg-[#252525] shrink-0">
                    <h3 className="font-bold text-gray-800 dark:text-white">Заявка на приобретение</h3>
                    <button onClick={() => setIsRequestModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-[#333]"><X size={18} /></button>
                </div>
                {(() => {
                  const reqLocked = Boolean(
                    editingRequest && (editingRequest.status === 'approved' || editingRequest.status === 'paid')
                  );
                  return (
                <form onSubmit={handleRequestSubmit} className="p-6 space-y-4 overflow-y-auto flex-1 min-h-0 custom-scrollbar">
                    {reqLocked && (
                      <p className="text-xs text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 rounded-lg px-3 py-2">
                        Заявка одобрена или оплачена: сумму и описание менять нельзя. Ниже — реквизиты для сверки с банковской выпиской (ИНН, счёт, вложения).
                      </p>
                    )}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Название</label>
                        <input
                            type="text"
                            value={reqTitle}
                            readOnly={reqLocked}
                            onChange={(e) => setReqTitle(e.target.value)}
                            className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-[#333] text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                            placeholder="Кратко, для списка заявок"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Сумма (UZS)</label>
                        <input 
                            type="text" 
                            inputMode="decimal"
                            required={!reqLocked}
                            readOnly={reqLocked}
                            value={reqAmount} 
                            onChange={e => setReqAmount(e.target.value)} 
                            className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-[#333] text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 disabled:opacity-60"
                            placeholder="Например 1500000.50"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Подразделение</label>
                            <EntitySearchSelect
                                value={reqDep}
                                onChange={setReqDep}
                                disabled={reqLocked}
                                options={[
                                    { value: '', label: 'Выберите подразделение' },
                                    ...departments.map((d) => ({ value: d.id, label: d.name, searchText: d.name })),
                                ]}
                                searchPlaceholder="Подразделение…"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Статья расходов</label>
                            <EntitySearchSelect
                                value={reqCat}
                                onChange={setReqCat}
                                disabled={reqLocked}
                                options={[
                                    { value: '', label: 'Выберите статью' },
                                    ...categories.map((c) => ({ value: c.id, label: c.name, searchText: c.name })),
                                ]}
                                searchPlaceholder="Статья…"
                            />
                        </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Плановая дата оплаты</label>
                      <DateInput value={reqPaymentDate} onChange={setReqPaymentDate} placeholder="Выберите дату оплаты" disabled={reqLocked} />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Описание / Обоснование</label>
                        <textarea required={!reqLocked} readOnly={reqLocked} value={reqDesc} onChange={e => setReqDesc(e.target.value)} className="w-full h-24 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-[#333] text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 resize-none disabled:opacity-60" placeholder="Что покупаем и зачем?"/>
                    </div>
                    <div className="border-t border-gray-100 dark:border-[#333] pt-4 space-y-3">
                      <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Сверка с выпиской</p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">ИНН контрагента</label>
                          <input value={reqInn} onChange={(e) => setReqInn(e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-[#333]" placeholder="Необязательно" />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">№ счёта</label>
                          <input value={reqInvoiceNumber} onChange={(e) => setReqInvoiceNumber(e.target.value)} className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-[#333]" placeholder="Необязательно" />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Дата счёта</label>
                          <DateInput value={reqInvoiceDate} onChange={setReqInvoiceDate} placeholder="ГГГГ-ММ-ДД" />
                        </div>
                      </div>
                      <div>
                        <input ref={reqAttachInputRef} type="file" multiple accept="application/pdf,image/*" className="hidden" onChange={handleRequestAttachmentFiles} />
                        <Button type="button" variant="secondary" size="sm" onClick={() => reqAttachInputRef.current?.click()}>
                          Прикрепить PDF / изображение
                        </Button>
                        {reqAttachments.length > 0 && (
                          <ul className="mt-2 text-xs text-gray-600 dark:text-gray-400 space-y-1">
                            {reqAttachments.map((a) => (
                              <li key={a.id} className="flex justify-between gap-2">
                                <span className="truncate">{a.name}</span>
                                <button type="button" className="text-red-600 shrink-0" onClick={() => setReqAttachments((prev) => prev.filter((x) => x.id !== a.id))}>Убрать</button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-[#333]">
                        <Button type="button" variant="secondary" onClick={() => setIsRequestModalOpen(false)} size="md">Закрыть</Button>
                        {reqLocked ? (
                          <Button type="button" size="md" onClick={handleSaveRequestMetadata}>Сохранить реквизиты</Button>
                        ) : (
                          <Button type="submit" size="md">Отправить</Button>
                        )}
                    </div>
                </form>
                  );
                })()}
            </div>
        </div>
       )}

      {/* Creation: instant -> opens detail */}

       <SystemAlertDialog
         open={!!alertText}
         title="Финансы"
         message={alertText || ''}
         onClose={() => setAlertText(null)}
       />
    </ModulePageShell>
  );
};

export default FinanceView;


import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { TaskSelect } from './TaskSelect';
import { FinanceCategory, Fund, FinancePlan, PurchaseRequest, Department, User, Role, FinancialPlanDocument, FinancialPlanning, Bdr } from '../types';
import { Wallet, Plus, X, Edit2, Trash2, PieChart, TrendingUp, DollarSign, Check, AlertCircle, Calendar, Settings, ArrowLeft, ArrowRight, Save, FileText, Clock, CheckCircle2, ChevronDown, Upload } from 'lucide-react';
import { Button, Card, ModulePageShell, ModulePageHeader, MODULE_PAGE_GUTTER, ModuleCreateDropdown, ModuleFilterIconButton, DateInput, ModuleSegmentedControl, SystemAlertDialog } from './ui';
import { BankStatementsView, type BankStatementsViewHandle } from './finance/BankStatementsView';
import { BdrView } from './finance/BdrView';
import { FilterConfig } from './FiltersPanel';

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
  bdr?: Bdr | null;
  onLoadBdr?: (year?: string) => Promise<void>;
  onSaveBdr?: (payload: { year: string; rows: Bdr['rows'] }) => Promise<void>;
  onSaveRequest: (req: PurchaseRequest) => void;
  onDeleteRequest: (id: string) => void;
  onSaveFinancialPlanDocument?: (doc: FinancialPlanDocument) => void;
  onDeleteFinancialPlanDocument?: (id: string) => void;
  onSaveFinancialPlanning?: (planning: FinancialPlanning) => void;
  onDeleteFinancialPlanning?: (id: string) => void;
}

const FinanceView: React.FC<FinanceViewProps> = ({ 
    categories, funds = [], plan, requests, departments, users, currentUser,
    financialPlanDocuments = [], financialPlannings = [], bdr = null,
    onLoadBdr, onSaveBdr,
    onSaveRequest, onDeleteRequest,
    onSaveFinancialPlanDocument, onDeleteFinancialPlanDocument, onSaveFinancialPlanning, onDeleteFinancialPlanning
}) => {
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
  const [requestStatusFilter, setRequestStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected' | 'deferred'>('all');
  const [requestDepartmentFilter, setRequestDepartmentFilter] = useState<string>('all');
  const [requestCategoryFilter, setRequestCategoryFilter] = useState<string>('all');
  const [showRequestFilters, setShowRequestFilters] = useState(false);
  
  /** Список | полноэкранное создание | полноэкранная карточка сущности */
  const [planningSubView, setPlanningSubView] = useState<'list' | 'create' | 'detail'>('list');
  const [planSubView, setPlanSubView] = useState<'list' | 'create' | 'detail'>('list');

  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [editingRequest, setEditingRequest] = useState<PurchaseRequest | null>(null);
  const [alertText, setAlertText] = useState<string | null>(null);
  // Создание финансового планирования — без промежуточного full-screen экрана
  const [isPlanningCreateModalOpen, setIsPlanningCreateModalOpen] = useState(false);
  const bankStatementsRef = useRef<BankStatementsViewHandle>(null);

  // Формы
  const [reqAmount, setReqAmount] = useState('');
  const [reqDesc, setReqDesc] = useState('');
  const [reqDep, setReqDep] = useState('');
  const [reqCat, setReqCat] = useState('');
  const [reqPaymentDate, setReqPaymentDate] = useState('');
  
  // Получаем текущий период (месяц)
  const currentPeriod = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);
  
  // Формы для создания плана
  const [newPlanDepartment, setNewPlanDepartment] = useState('');
  const [newPlanPeriod, setNewPlanPeriod] = useState('');
  
  // Формы для создания планирования
  const [newPlanningDepartment, setNewPlanningDepartment] = useState('');
  const [newPlanningPeriod, setNewPlanningPeriod] = useState('');
  const [newPlanningIncome, setNewPlanningIncome] = useState<number>(0);
  
  // Инициализируем периоды после вычисления currentPeriod
  useEffect(() => {
    if (!newPlanPeriod) setNewPlanPeriod(currentPeriod);
    if (!newPlanningPeriod) setNewPlanningPeriod(currentPeriod);
  }, [currentPeriod, newPlanPeriod, newPlanningPeriod]);

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
    fundAllocations?: Record<string, number>;
    requestFundIds?: Record<string, string>;
  } | null>(null);
  const [planningDetailRequestIds, setPlanningDetailRequestIds] = useState<string[]>([]);
  const [planningDetailNotes, setPlanningDetailNotes] = useState('');
  const [planningDetailIncome, setPlanningDetailIncome] = useState<number>(0);
  const [planningDetailFundAllocations, setPlanningDetailFundAllocations] = useState<Record<string, number>>({});
  const [planningDetailRequestFundIds, setPlanningDetailRequestFundIds] = useState<Record<string, string>>({});
  
  // Состояния для детальной страницы плана
  const planDetailInitialValuesRef = useRef<{
    income: number;
    expenses: Record<string, number>;
    selectedCategories: string[];
  } | null>(null);
  const [planDetailIncome, setPlanDetailIncome] = useState(0);
  const [planDetailExpenses, setPlanDetailExpenses] = useState<Record<string, number>>({});
  const [planDetailSelectedCategories, setPlanDetailSelectedCategories] = useState<string[]>([]);
  /** Дропдаун «Добавить статью» на детальной странице плана — хуки на уровне FinanceView (нельзя в renderPlanDetail: React #310). */
  const [planDetailCategoryDropdownOpen, setPlanDetailCategoryDropdownOpen] = useState(false);
  const planDetailCategoryDropdownRef = useRef<HTMLDivElement>(null);
  
  // Синхронизация состояний детальных страниц при изменении выбранных элементов
  useEffect(() => {
    if (selectedPlanning) {
      planningDetailInitialValuesRef.current = {
        requestIds: selectedPlanning.requestIds,
        notes: selectedPlanning.notes,
        income: selectedPlanning.income ?? 0,
        fundAllocations: selectedPlanning.fundAllocations ?? {},
        requestFundIds: selectedPlanning.requestFundIds ?? {}
      };
      setPlanningDetailRequestIds(selectedPlanning.requestIds);
      setPlanningDetailNotes(selectedPlanning.notes || '');
      setPlanningDetailIncome(selectedPlanning.income ?? 0);
      setPlanningDetailFundAllocations(selectedPlanning.fundAllocations ?? {});
      setPlanningDetailRequestFundIds(selectedPlanning.requestFundIds ?? {});
    } else {
      planningDetailInitialValuesRef.current = null;
      setPlanningDetailRequestIds([]);
      setPlanningDetailNotes('');
      setPlanningDetailIncome(0);
      setPlanningDetailFundAllocations({});
      setPlanningDetailRequestFundIds({});
    }
  }, [selectedPlanning]);
  
  useEffect(() => {
    if (selectedPlanDoc) {
      const selectedCats = Object.keys(selectedPlanDoc.expenses || {});
      planDetailInitialValuesRef.current = {
        income: selectedPlanDoc.income || 0,
        expenses: selectedPlanDoc.expenses || {},
        selectedCategories: selectedCats
      };
      setPlanDetailIncome(selectedPlanDoc.income || 0);
      setPlanDetailExpenses(selectedPlanDoc.expenses || {});
      setPlanDetailSelectedCategories(selectedCats);
    } else {
      // Сбрасываем значения, если план не выбран
      planDetailInitialValuesRef.current = null;
      setPlanDetailIncome(0);
      setPlanDetailExpenses({});
      setPlanDetailSelectedCategories([]);
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
    return (planDetailIncome * percent) / 100;
  }, [categories, planDetailExpenses, planDetailIncome]);

  const planDetailTotalPercentExpenses = useMemo(() => {
    return planDetailSelectedCategories
      .filter(catId => {
        const cat = categories.find(c => c.id === catId);
        return cat && cat.type === 'percent';
      })
      .reduce((sum, catId) => sum + calculatePlanDetailPercentAmount(catId), 0);
  }, [planDetailSelectedCategories, planDetailExpenses, planDetailIncome, categories, calculatePlanDetailPercentAmount]);

  const planDetailTotalExpenses = useMemo(() => {
    const fixedTotal = planDetailSelectedCategories
      .filter(catId => {
        const cat = categories.find(c => c.id === catId);
        return cat && cat.type === 'fixed';
      })
      .reduce((sum, catId) => sum + (planDetailExpenses[catId] || 0), 0);
    return planDetailTotalPercentExpenses + fixedTotal;
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
    
    return result;
  }, [financialPlannings, planningStatusFilter, planningDepartmentFilter, showApprovedPlannings]);

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
    
    return result;
  }, [financialPlanDocuments, currentPeriod, planStatusFilter, planDepartmentFilter, showApprovedPlans]);

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
        { value: 'pending', label: 'Ожидание' },
        { value: 'approved', label: 'Одобрено' },
        { value: 'rejected', label: 'Отклонено' },
        { value: 'deferred', label: 'Перенесено' }
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

  // --- Handlers ---

  const handleOpenRequestCreate = () => {
      setEditingRequest(null);
      setReqAmount(''); setReqDesc(''); setReqDep(departments[0]?.id || ''); setReqCat(categories[0]?.id || '');
      setReqPaymentDate('');
      setIsRequestModalOpen(true);
  };
  
  const handleOpenRequestEdit = (req: PurchaseRequest) => {
      setEditingRequest(req);
      setReqAmount(req.amount.toString()); 
      const sourceDesc = req.description || '';
      const m = sourceDesc.match(/\[paymentDate:([0-9]{4}-[0-9]{2}-[0-9]{2})\]/);
      setReqPaymentDate(m?.[1] || '');
      setReqDesc(sourceDesc.replace(/\s*\[paymentDate:[0-9]{4}-[0-9]{2}-[0-9]{2}\]\s*/g, '').trim()); 
      setReqDep(req.departmentId || ''); 
      setReqCat(req.categoryId || '');
      setIsRequestModalOpen(true);
  };

  const handleRequestSubmit = (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      onSaveRequest({
          id: editingRequest ? editingRequest.id : `pr-${Date.now()}`,
          requesterId: editingRequest ? editingRequest.requesterId : currentUser.id,
          departmentId: reqDep,
          categoryId: reqCat,
          amount: parseFloat(reqAmount) || 0,
          description: `${reqDesc || ''}${reqPaymentDate ? ` [paymentDate:${reqPaymentDate}]` : ''}`.trim(),
          status: editingRequest ? editingRequest.status : 'pending',
          date: editingRequest ? editingRequest.date : new Date().toISOString()
      });
      setIsRequestModalOpen(false);
  };

  const handleStatusChange = (req: PurchaseRequest, status: PurchaseRequest['status']) => {
      onSaveRequest({ ...req, status, decisionDate: new Date().toISOString() });
  };

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
  const renderPlanningList = () => (
    <div className="space-y-6">

      {/* Список планирований */}
      <div className="space-y-3">
        {filteredPlannings.length === 0 ? (
          <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-xl p-12 text-center">
            <FileText size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
            <p className="text-gray-400 dark:text-gray-500 text-sm mb-2">Нет финансовых планирований</p>
            <p className="text-xs text-gray-400 dark:text-gray-500">Создайте первое планирование через кнопку с плюсом в шапке</p>
          </div>
        ) : (
          (() => {
            const groups = new Map<string, typeof filteredPlannings>();
            filteredPlannings.forEach((p) => {
              const key = p.departmentId || 'unknown';
              const arr = groups.get(key) || [];
              arr.push(p);
              groups.set(key, arr);
            });
            const ordered = Array.from(groups.entries()).sort((a, b) => {
              const da = departments.find(d => d.id === a[0])?.name || '—';
              const db = departments.find(d => d.id === b[0])?.name || '—';
              return da.localeCompare(db);
            });

            return ordered.map(([depId, items]) => {
              const dep = departments.find(d => d.id === depId);
              return (
                <div key={depId} className="space-y-3">
                  <div className="flex items-center justify-between gap-3 px-1">
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide truncate">
                        {dep?.name || 'Без подразделения'}
                      </div>
                      <div className="text-[11px] text-gray-400 dark:text-gray-500">
                        {items.length} {items.length === 1 ? 'документ' : items.length < 5 ? 'документа' : 'документов'}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {items.map(planning => {
                      const periodDate = new Date(planning.period + '-01');
                      const periodLabel = periodDate.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });

                      return (
                        <Card
                          key={planning.id}
                          onClick={() => {
                            setSelectedPlanning(planning);
                            setPlanningSubView('detail');
                          }}
                          padding="lg"
                          hover
                          className="group"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-lg text-blue-600 dark:text-blue-400">
                                  <FileText size={20} />
                                </div>
                                <div>
                                  <h3 className="font-bold text-gray-900 dark:text-white text-lg">
                                    {periodLabel}
                                  </h3>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                    Доход: {(planning.income || 0).toLocaleString()} UZS · Заявок: {planning.requestIds.length}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3 mt-3 flex-wrap">
                                <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase ${getStatusColor(planning.status)}`}>
                                  {getStatusLabel(planning.status)}
                                </span>
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  {new Date(planning.createdAt).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '.')}
                                </span>
                              </div>
                            </div>
                            <ArrowRight size={20} className="text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-200 shrink-0" />
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              );
            });
          })()
        )}
      </div>
    </div>
  );

  // --- Render Planning Detail ---
  const renderPlanningDetail = () => {
    if (!selectedPlanning) return null;
    
    const dep = departments.find(d => d.id === selectedPlanning.departmentId);
    const periodDate = new Date(selectedPlanning.period + '-01');
    const periodLabel = periodDate.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
    const planningRequests = requests.filter(r => selectedPlanning.requestIds.includes(r.id));
    
    const hasChanges = (): boolean => {
      if (!planningDetailInitialValuesRef.current) return false;
      const ref = planningDetailInitialValuesRef.current;
      return (
        JSON.stringify([...planningDetailRequestIds].sort()) !== JSON.stringify([...ref.requestIds].sort()) ||
        planningDetailNotes !== (ref.notes || '') ||
        planningDetailIncome !== (ref.income || 0) ||
        JSON.stringify(planningDetailFundAllocations) !== JSON.stringify(ref.fundAllocations || {}) ||
        JSON.stringify(planningDetailRequestFundIds) !== JSON.stringify(ref.requestFundIds || {})
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
      const updated: FinancialPlanning = {
        ...selectedPlanning,
        requestIds: planningDetailRequestIds,
        notes: planningDetailNotes,
        income: planningDetailIncome,
        fundAllocations: Object.keys(planningDetailFundAllocations).length ? planningDetailFundAllocations : undefined,
        requestFundIds: Object.keys(planningDetailRequestFundIds).length ? planningDetailRequestFundIds : undefined,
        updatedAt: new Date().toISOString()
      };
      onSaveFinancialPlanning(updated);
      planningDetailInitialValuesRef.current = {
        requestIds: planningDetailRequestIds,
        notes: planningDetailNotes,
        income: planningDetailIncome,
        fundAllocations: planningDetailFundAllocations,
        requestFundIds: planningDetailRequestFundIds
      };
    };
    
    const handleRefreshRequests = () => {
      if (!selectedPlanning) return;
      const periodDate = new Date(selectedPlanning.period + '-01');
      const periodStart = new Date(periodDate.getFullYear(), periodDate.getMonth(), 1);
      const periodEnd = new Date(periodDate.getFullYear(), periodDate.getMonth() + 1, 0, 23, 59, 59);
      
      // Находим заявки, которые подходят под период и подразделение
      const matchingRequests = requests.filter(req => {
        if (!req.date) return false;
        const reqDate = new Date(req.date);
        // Проверяем, что дата заявки попадает в период планирования
        const isInPeriod = reqDate >= periodStart && reqDate <= periodEnd;
        // Проверяем подразделение
        const isSameDepartment = req.departmentId === selectedPlanning.departmentId;
        // Проверяем статус (берем все, кроме отклоненных)
        const isValidStatus = req.status !== 'rejected';
        
        return isInPeriod && isSameDepartment && isValidStatus;
      });
      
      const newRequestIds = Array.from(new Set([...planningDetailRequestIds, ...matchingRequests.map(r => r.id)]));
      setPlanningDetailRequestIds(newRequestIds);
    };
    
    const handleApprove = () => {
      if (!onSaveFinancialPlanning || currentUser.role !== Role.ADMIN) return;
      if (confirm('Одобрить финансовое планирование?')) {
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
    
    return (
      <div className="flex flex-col flex-1 min-h-0 -mx-4 md:-mx-6">
        <div className="sticky top-0 z-20 flex flex-wrap items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-[#333] bg-white/95 dark:bg-[#191919]/95 backdrop-blur-md">
          <button
            type="button"
            onClick={handleBack}
            className="p-2 rounded-xl border border-gray-200 dark:border-[#333] hover:bg-gray-50 dark:hover:bg-[#252525] transition-colors"
          >
            <ArrowLeft size={20} className="text-gray-600 dark:text-gray-400" />
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white truncate">
              Финансовое планирование
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {dep?.name || '—'} · {periodLabel}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <button
              type="button"
              onClick={() => {
                if (selectedPlanning.status === 'created') return handleConduct();
                if (selectedPlanning.status === 'conducted' && currentUser.role === Role.ADMIN) return handleApprove();
              }}
              disabled={!(selectedPlanning.status === 'created' || (selectedPlanning.status === 'conducted' && currentUser.role === Role.ADMIN))}
              className={`px-3 py-2 rounded-xl text-sm font-bold uppercase border transition-colors ${
                (selectedPlanning.status === 'created' || (selectedPlanning.status === 'conducted' && currentUser.role === Role.ADMIN))
                  ? 'cursor-pointer hover:opacity-90'
                  : 'cursor-default opacity-70'
              } ${getStatusColor(selectedPlanning.status)} border-transparent`}
              title={
                selectedPlanning.status === 'created'
                  ? 'Нажмите, чтобы провести'
                  : selectedPlanning.status === 'conducted' && currentUser.role === Role.ADMIN
                  ? 'Нажмите, чтобы одобрить'
                  : 'Статус'
              }
            >
              {selectedPlanning.status === 'created'
                ? 'Провести'
                : selectedPlanning.status === 'conducted' && currentUser.role === Role.ADMIN
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
          </div>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0 px-4 md:px-6 py-6 space-y-6 max-w-5xl w-full mx-auto">
        
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
              const allocated = (Object.values(planningDetailFundAllocations) as number[]).reduce((a, b) => a + b, 0);
              const rest = planningDetailIncome - allocated;
              return (
                <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                  Распределено: {allocated.toLocaleString()} UZS · Остаток: {rest.toLocaleString()} UZS
                  {rest < 0 && <span className="text-red-600 dark:text-red-400 ml-2">(превышение)</span>}
                </div>
              );
            })()}
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
            <h3 className="font-bold text-gray-800 dark:text-white">Заявки в планировании ({planningRequests.length})</h3>
            <div className="flex items-center gap-4">
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Сумма: {planningRequests.reduce((sum, r) => sum + r.amount, 0).toLocaleString()} UZS
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
                Нет заявок в планировании
              </div>
            ) : (
              <div className="space-y-2">
                {planningRequests.map(req => {
                  const cat = categories.find(c => c.id === req.categoryId);
                  const user = users.find(u => u.id === req.requesterId);
                  const activeFundsList = funds.filter(f => !f.isArchived);
                  const requestFundId = planningDetailRequestFundIds[req.id] || '';
                  return (
                    <div
                      key={req.id}
                      className="flex items-center justify-between gap-4 p-3 bg-gray-50 dark:bg-[#303030] rounded-lg hover:bg-gray-100 dark:hover:bg-[#404040] transition-colors group"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 dark:text-white">{cat?.name || 'Без категории'}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {user?.name} • {req.amount.toLocaleString()} UZS
                          {req.date && (
                            <> • {new Date(req.date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '.')}</>
                          )}
                        </div>
                        {req.description && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-1">
                            {req.description}
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
                          req.status === 'approved' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                          req.status === 'rejected' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                          'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                        }`}>
                          {req.status === 'approved' ? 'Одобрено' : req.status === 'rejected' ? 'Отклонено' : 'Ожидание'}
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
        </div>
      </div>
    );
  };

  // --- Render Plan List ---
  const renderPlanList = () => (
    <div className="space-y-6">

      {/* Список планов */}
      <div className="space-y-3">
        {filteredPlanDocs.length === 0 ? (
          <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-xl p-12 text-center">
            <FileText size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
            <p className="text-gray-400 dark:text-gray-500 text-sm mb-2">Нет финансовых планов</p>
            <p className="text-xs text-gray-400 dark:text-gray-500">Создайте первый план через кнопку с плюсом в шапке</p>
          </div>
        ) : (
          (() => {
            const groups = new Map<string, typeof filteredPlanDocs>();
            filteredPlanDocs.forEach((p) => {
              const key = p.departmentId || 'unknown';
              const arr = groups.get(key) || [];
              arr.push(p);
              groups.set(key, arr);
            });
            const ordered = Array.from(groups.entries()).sort((a, b) => {
              const da = departments.find(d => d.id === a[0])?.name || '—';
              const db = departments.find(d => d.id === b[0])?.name || '—';
              return da.localeCompare(db);
            });

            return ordered.map(([depId, items]) => {
              const dep = departments.find(d => d.id === depId);
              return (
                <div key={depId} className="space-y-3">
                  <div className="flex items-center justify-between gap-3 px-1">
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide truncate">
                        {dep?.name || 'Без подразделения'}
                      </div>
                      <div className="text-[11px] text-gray-400 dark:text-gray-500">
                        {items.length} {items.length === 1 ? 'документ' : items.length < 5 ? 'документа' : 'документов'}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {items.map(planDoc => {
                      const periodDate = new Date(planDoc.period + '-01');
                      const periodLabel = periodDate.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
                      const totalExpenses = (Object.values(planDoc.expenses || {}) as number[]).reduce((sum, val) => sum + val, 0);

                      return (
                        <Card
                          key={planDoc.id}
                          onClick={() => {
                            setSelectedPlanDoc(planDoc);
                            setPlanSubView('detail');
                          }}
                          padding="lg"
                          hover
                          className="group"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <div className="bg-green-100 dark:bg-green-900/30 p-2 rounded-lg text-green-600 dark:text-green-400">
                                  <FileText size={20} />
                                </div>
                                <div>
                                  <h3 className="font-bold text-gray-900 dark:text-white text-lg">
                                    {periodLabel}
                                  </h3>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                    Доход: {planDoc.income?.toLocaleString() || 0} UZS · Расход: {totalExpenses.toLocaleString()} UZS
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3 mt-3 flex-wrap">
                                <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase ${getStatusColor(planDoc.status)}`}>
                                  {getStatusLabel(planDoc.status)}
                                </span>
                              </div>
                            </div>
                            <ArrowRight size={20} className="text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-200 shrink-0" />
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              );
            });
          })()
        )}
      </div>
    </div>
  );

  // --- Render Plan Detail ---
  const renderPlanDetail = () => {
    if (!selectedPlanDoc) return null;
    
    const dep = departments.find(d => d.id === selectedPlanDoc.departmentId);
    const periodDate = new Date(selectedPlanDoc.period + '-01');
    const periodLabel = periodDate.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
    
    const hasChanges = (): boolean => {
      if (!planDetailInitialValuesRef.current) return false;
      return (
        planDetailIncome !== planDetailInitialValuesRef.current.income ||
        JSON.stringify(planDetailExpenses) !== JSON.stringify(planDetailInitialValuesRef.current.expenses) ||
        JSON.stringify([...planDetailSelectedCategories].sort()) !== JSON.stringify([...planDetailInitialValuesRef.current.selectedCategories].sort())
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
      const updated: FinancialPlanDocument = {
        ...selectedPlanDoc,
        income: planDetailIncome,
        expenses: filteredExpenses,
        updatedAt: new Date().toISOString()
      };
      onSaveFinancialPlanDocument(updated);
      planDetailInitialValuesRef.current = {
        income: planDetailIncome,
        expenses: filteredExpenses,
        selectedCategories: planDetailSelectedCategories
      };
    };
    
    const remainingForFixed = planDetailIncome - planDetailTotalPercentExpenses;

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
      if (!onSaveFinancialPlanDocument || currentUser.role !== Role.ADMIN) return;
      if (confirm('Утвердить финансовый план?')) {
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
    
    const balance = planDetailIncome - planDetailTotalExpenses;
    
    return (
      <div className="flex flex-col flex-1 min-h-0 -mx-4 md:-mx-6">
        <div className="sticky top-0 z-20 flex flex-wrap items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-[#333] bg-white/95 dark:bg-[#191919]/95 backdrop-blur-md">
          <button
            type="button"
            onClick={handleBack}
            className="p-2 rounded-xl border border-gray-200 dark:border-[#333] hover:bg-gray-50 dark:hover:bg-[#252525] transition-colors"
          >
            <ArrowLeft size={20} className="text-gray-600 dark:text-gray-400" />
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white truncate">
              Финансовый план
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {dep?.name || '—'} · {periodLabel}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <button
              type="button"
              onClick={() => {
                if (selectedPlanDoc.status === 'created') return handleConduct();
                if (selectedPlanDoc.status === 'conducted' && currentUser.role === Role.ADMIN) return handleApprove();
              }}
              disabled={!(selectedPlanDoc.status === 'created' || (selectedPlanDoc.status === 'conducted' && currentUser.role === Role.ADMIN))}
              className={`px-3 py-2 rounded-xl text-sm font-bold uppercase border transition-colors ${
                (selectedPlanDoc.status === 'created' || (selectedPlanDoc.status === 'conducted' && currentUser.role === Role.ADMIN))
                  ? 'cursor-pointer hover:opacity-90'
                  : 'cursor-default opacity-70'
              } ${getStatusColor(selectedPlanDoc.status)} border-transparent`}
              title={
                selectedPlanDoc.status === 'created'
                  ? 'Нажмите, чтобы провести'
                  : selectedPlanDoc.status === 'conducted' && currentUser.role === Role.ADMIN
                  ? 'Нажмите, чтобы утвердить'
                  : 'Статус'
              }
            >
              {selectedPlanDoc.status === 'created'
                ? 'Провести'
                : selectedPlanDoc.status === 'conducted' && currentUser.role === Role.ADMIN
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
          </div>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0 px-4 md:px-6 py-6 space-y-6 max-w-5xl w-full mx-auto">
        
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
                        return (
                          <div key={catId} className="flex items-center gap-3 p-3 rounded-lg border bg-gray-50 dark:bg-[#303030] border-gray-200 dark:border-[#444]">
                            <div className="flex-1 flex items-center gap-3">
                              <span className="font-medium text-gray-900 dark:text-white flex-shrink-0">{cat.name}</span>
                              <input
                                type="number"
                                value={planDetailExpenses[catId] || ''}
                                onChange={(e) => {
                                  const value = parseFloat(e.target.value) || 0;
                                  if (value <= remainingForFixed + (planDetailExpenses[catId] || 0)) {
                                    setPlanDetailExpenses({ ...planDetailExpenses, [catId]: value });
                                  }
                                }}
                                className="w-32 bg-white dark:bg-[#333] border border-gray-300 dark:border-[#555] rounded px-2 py-1 text-xs text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-right [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                                placeholder="0"
                                min="0"
                                max={remainingForFixed + (planDetailExpenses[catId] || 0)}
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
        
        {/* Статус */}
        <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-xl p-6">
          <div>
            <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Статус</div>
            <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase ${getStatusColor(selectedPlanDoc.status)}`}>
              {getStatusLabel(selectedPlanDoc.status)}
            </span>
          </div>
        </div>
        </div>
      </div>
    );
  };

  // --- Render Requests Tab ---
  const renderRequestsTab = () => {
      const filteredRequests = requests.filter(req => {
          if (requestStatusFilter !== 'all' && req.status !== requestStatusFilter) return false;
          if (requestDepartmentFilter !== 'all' && req.departmentId !== requestDepartmentFilter) return false;
          if (requestCategoryFilter !== 'all' && req.categoryId !== requestCategoryFilter) return false;
          return true;
      });
      
      return (
      <div className="space-y-6">
          <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-800 dark:text-white">Реестр заявок</h3>
          </div>

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
                      {filteredRequests.map(req => {
                          const cat = categories.find(c => c.id === req.categoryId);
                          const dep = departments.find(d => d.id === req.departmentId);
                          const user = users.find(u => u.id === req.requesterId);
                          
                          return (
                              <tr key={req.id} className="hover:bg-gray-50 dark:hover:bg-[#303030]">
                                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">{new Date(req.date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '.')}</td>
                                  <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-200">{user?.name}</td>
                                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400 text-xs">{dep?.name}</td>
                                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400 text-xs">{cat?.name}</td>
                                  <td className="px-4 py-3 font-bold text-gray-900 dark:text-gray-100">{req.amount.toLocaleString()}</td>
                                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400 truncate max-w-xs">
                                    {(req.description || '').replace(/\s*\[paymentDate:[0-9]{4}-[0-9]{2}-[0-9]{2}\]\s*/g, '')}
                                    {/\[paymentDate:([0-9]{4}-[0-9]{2}-[0-9]{2})\]/.test(req.description || '') && (
                                      <span className="ml-1 text-xs text-emerald-600 dark:text-emerald-400">
                                        • Оплата до {((req.description || '').match(/\[paymentDate:([0-9]{4}-[0-9]{2}-[0-9]{2})\]/) || [])[1]}
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3">
                                      <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                                          req.status === 'approved' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                          req.status === 'rejected' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                          req.status === 'deferred' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                                          'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                                      }`}>
                                          {req.status === 'approved' ? 'Одобрено' : req.status === 'rejected' ? 'Отклонено' : req.status === 'deferred' ? 'Перенос' : 'Ожидание'}
                                      </span>
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                      <div className="flex items-center justify-end gap-2">
                                          <button 
                                              onClick={() => handleOpenRequestEdit(req)} 
                                              className="text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                                              title="Редактировать"
                                          >
                                              <Edit2 size={14}/>
                                          </button>
                                          {currentUser.role === Role.ADMIN && (
                                              <button onClick={() => { if(confirm('Удалить?')) onDeleteRequest(req.id) }} className="text-gray-400 hover:text-red-600"><Trash2 size={14}/></button>
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

  useEffect(() => {
    if (planSubView === 'create' && activeTab === 'plan' && departments.length > 0) {
      setNewPlanDepartment(departments[0].id);
      setNewPlanPeriod(currentPeriod);
    }
  }, [planSubView, activeTab, departments.length, currentPeriod]);

  const handlePlanSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!onSaveFinancialPlanDocument) {
      setAlertText('Функция сохранения недоступна');
      return;
    }
    if (!newPlanDepartment || newPlanDepartment === '' || newPlanDepartment === 'undefined') {
      setAlertText('Выберите подразделение');
      return;
    }
    
    if (!newPlanPeriod || newPlanPeriod === '') {
      setAlertText('Выберите период');
      return;
    }
    
    const planDoc: FinancialPlanDocument = {
      id: `fpd-${Date.now()}`,
      departmentId: newPlanDepartment,
      period: newPlanPeriod,
      income: 0,
      expenses: {},
      status: 'created',
      createdAt: new Date().toISOString()
    };
    
    try {
      onSaveFinancialPlanDocument(planDoc);
      setPlanSubView('detail');
      setNewPlanDepartment('');
      setNewPlanPeriod(currentPeriod);
      setActiveTab('plan');
      setSelectedPlanDoc(planDoc);
    } catch (error) {
      console.error('Ошибка при создании финансового плана:', error);
      setAlertText('Ошибка при создании финансового плана');
    }
  };

  useEffect(() => {
    if (isPlanningCreateModalOpen && activeTab === 'planning' && departments.length > 0) {
      setNewPlanningDepartment(departments[0].id);
      setNewPlanningPeriod(currentPeriod);
      setNewPlanningIncome(0);
    }
  }, [isPlanningCreateModalOpen, activeTab, departments.length, currentPeriod]);

  const handlePlanningSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!onSaveFinancialPlanning) {
      setAlertText('Функция сохранения недоступна');
      return;
    }
    if (!newPlanningDepartment || newPlanningDepartment === '') {
      setAlertText('Выберите подразделение');
      return;
    }
    const income = Number(newPlanningIncome) || 0;
    if (income <= 0) {
      setAlertText('Введите сумму дохода за период (по кассовому методу)');
      return;
    }

    const periodStart = new Date(newPlanningPeriod + '-01');
    const periodEnd = new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, 0);

    const relevantRequests = requests.filter(req => {
      if (req.departmentId !== newPlanningDepartment) return false;
      const reqDate = new Date(req.date);
      return reqDate >= periodStart && reqDate <= periodEnd;
    });

    const planning: FinancialPlanning = {
      id: `fp-${Date.now()}`,
      departmentId: newPlanningDepartment,
      period: newPlanningPeriod,
      income,
      requestIds: relevantRequests.map(r => r.id),
      status: 'created',
      createdAt: new Date().toISOString()
    };

    onSaveFinancialPlanning(planning);
    setPlanningSubView('detail');
    setActiveTab('planning');
    setSelectedPlanning(planning);
    setIsPlanningCreateModalOpen(false);
  };

  const renderPlanningCreate = () => (
    <div className="flex flex-col flex-1 min-h-0 -mx-4 md:-mx-6">
      <div className="sticky top-0 z-20 flex flex-wrap items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-[#333] bg-white/95 dark:bg-[#191919]/95 backdrop-blur-md">
        <button
          type="button"
          onClick={() => setPlanningSubView('list')}
          className="p-2 rounded-xl border border-gray-200 dark:border-[#333] hover:bg-gray-50 dark:hover:bg-[#252525] transition-colors"
        >
          <ArrowLeft size={20} className="text-gray-600 dark:text-gray-400" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Новое финансовое планирование</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">Подразделение, период и доход за месяц</p>
        </div>
      </div>
      <form
        onSubmit={handlePlanningSubmit}
        className="flex-1 overflow-y-auto custom-scrollbar min-h-0 px-4 md:px-6 py-6 max-w-xl w-full mx-auto space-y-5"
      >
        <div>
          <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase">Подразделение</label>
          <TaskSelect
            value={newPlanningDepartment}
            onChange={setNewPlanningDepartment}
            options={[
              { value: '', label: 'Выберите подразделение' },
              ...departments.map(d => ({ value: d.id, label: d.name })),
            ]}
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase">Период (месяц)</label>
          <DateInput value={newPlanningPeriod ? `${newPlanningPeriod}-01` : ''} onChange={(v) => setNewPlanningPeriod(v ? v.slice(0, 7) : '')} placeholder="Выберите месяц" />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase">Доход за период (UZS)</label>
          <input
            type="number"
            min={1}
            value={newPlanningIncome || ''}
            onChange={(e) => setNewPlanningIncome(parseFloat(e.target.value) || 0)}
            className="w-full bg-white dark:bg-[#333] border border-gray-200 dark:border-[#444] rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-emerald-500/40 outline-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            placeholder="0"
          />
        </div>
        <div className="flex flex-wrap justify-end gap-2 pt-4 border-t border-gray-200 dark:border-[#333]">
          <Button type="button" variant="secondary" onClick={() => setPlanningSubView('list')} size="md">
            Отмена
          </Button>
          <Button type="submit" size="md">
            Создать
          </Button>
        </div>
      </form>
    </div>
  );

  const renderPlanCreate = () => (
    <div className="flex flex-col flex-1 min-h-0 -mx-4 md:-mx-6">
      <div className="sticky top-0 z-20 flex flex-wrap items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-[#333] bg-white/95 dark:bg-[#191919]/95 backdrop-blur-md">
        <button
          type="button"
          onClick={() => setPlanSubView('list')}
          className="p-2 rounded-xl border border-gray-200 dark:border-[#333] hover:bg-gray-50 dark:hover:bg-[#252525] transition-colors"
        >
          <ArrowLeft size={20} className="text-gray-600 dark:text-gray-400" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Новый финансовый план</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">Документ на месяц по подразделению</p>
        </div>
      </div>
      <form onSubmit={handlePlanSubmit} className="flex-1 overflow-y-auto custom-scrollbar min-h-0 px-4 md:px-6 py-6 max-w-xl w-full mx-auto space-y-5">
        <div>
          <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase">Подразделение</label>
          <TaskSelect
            value={newPlanDepartment}
            onChange={setNewPlanDepartment}
            options={[
              { value: '', label: 'Выберите подразделение' },
              ...departments.map(d => ({ value: d.id, label: d.name })),
            ]}
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase">Период (месяц)</label>
          <DateInput value={newPlanPeriod ? `${newPlanPeriod}-01` : ''} onChange={(v) => setNewPlanPeriod(v ? v.slice(0, 7) : '')} placeholder="Выберите месяц" />
        </div>
        <div className="flex flex-wrap justify-end gap-2 pt-4 border-t border-gray-200 dark:border-[#333]">
          <Button type="button" variant="secondary" onClick={() => setPlanSubView('list')} size="md">
            Отмена
          </Button>
          <Button type="submit" size="md">
            Создать
          </Button>
        </div>
      </form>
    </div>
  );

  const financeTabOptions = useMemo(
    () => [
      { value: 'planning' as const, label: 'Планирование' },
      { value: 'bdr' as const, label: 'БДР' },
      { value: 'requests' as const, label: 'Заявки' },
      { value: 'statements' as const, label: 'Выписки и сверка' },
      ...(currentUser.role === Role.ADMIN ? [{ value: 'plan' as const, label: 'Финансовый план' }] : []),
    ],
    [currentUser.role]
  );

  const handleFinanceTabChange = (tabId: string) => {
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
  };

  return (
    <ModulePageShell>
      {!financeFullScreen && (
      <div className={`${MODULE_PAGE_GUTTER} pt-6 md:pt-8 pb-4 flex-shrink-0`}>
       <div className="mb-5 space-y-5">
            <ModulePageHeader
              icon={<Wallet size={24} strokeWidth={2} />}
              title="Финансы"
              description="Планирование, заявки, БДР и выписки"
              accent="emerald"
              tabs={
                <ModuleSegmentedControl
                  variant="neutral"
                  value={activeTab}
                  onChange={(v) => handleFinanceTabChange(String(v))}
                  options={financeTabOptions}
                />
              }
              controls={
                <div className="flex items-center gap-2 flex-wrap lg:justify-end">
                    {activeTab === 'planning' && planningSubView === 'list' && (
                      <ModuleFilterIconButton
                        accent="emerald"
                        active={showPlanningFilters || hasActivePlanningFilters}
                        activeCount={planningFilters.filter(f => f.value && f.value !== 'all' && f.value !== '' && f.value !== 'hide').length}
                        onClick={() => setShowPlanningFilters(!showPlanningFilters)}
                      />
                    )}
                    {activeTab === 'plan' && planSubView === 'list' && (
                      <ModuleFilterIconButton
                        accent="emerald"
                        active={showPlanFilters || hasActivePlanFilters}
                        activeCount={planFilters.filter(f => f.value && f.value !== 'all' && f.value !== '' && f.value !== 'hide').length}
                        onClick={() => setShowPlanFilters(!showPlanFilters)}
                      />
                    )}
                    {activeTab === 'requests' && (
                      <ModuleFilterIconButton
                        accent="emerald"
                        active={showRequestFilters || hasActiveRequestFilters}
                        activeCount={requestFilters.filter(f => f.value && f.value !== 'all' && f.value !== '' && f.value !== 'hide').length}
                        onClick={() => setShowRequestFilters(!showRequestFilters)}
                      />
                    )}
                    <ModuleCreateDropdown
                      accent="emerald"
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
                          label: 'Финансовый план',
                          icon: FileText,
                          onClick: () => {
                            if (departments.length === 0) {
                              setAlertText('Сначала создайте подразделение в настройках');
                              return;
                            }
                            setActiveTab('plan');
                            setSelectedPlanDoc(null);
                            setPlanSubView('create');
                          },
                        },
                        {
                          id: 'create-fin-planning',
                          label: 'Финансовое планирование',
                          icon: PieChart,
                          onClick: () => {
                            if (departments.length === 0) {
                              setAlertText('Сначала создайте подразделение в настройках');
                              return;
                            }
                            setActiveTab('planning');
                            setSelectedPlanning(null);
                            setPlanningSubView('list');
                            setIsPlanningCreateModalOpen(true);
                          },
                        },
                      ]}
                    />
                </div>
              }
            />
            
            <div className="mt-1">
                {showPlanningFilters && activeTab === 'planning' && planningSubView === 'list' && (
                    <div className="mt-4 p-4 bg-gray-50 dark:bg-[#252525] rounded-lg border border-gray-200 dark:border-[#333]">
                        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(150px, 1fr))`, maxWidth: '100%' }}>
                            {planningFilters.map((filter, index) => (
                                <div key={index}>
                                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">{filter.label}</label>
                                    <TaskSelect value={filter.value} onChange={filter.onChange} options={filter.options} />
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
                )}
                {showPlanFilters && activeTab === 'plan' && planSubView === 'list' && (
                    <div className="mt-4 p-4 bg-gray-50 dark:bg-[#252525] rounded-lg border border-gray-200 dark:border-[#333]">
                        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(150px, 1fr))`, maxWidth: '100%' }}>
                            {planFilters.map((filter, index) => (
                                <div key={index}>
                                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">{filter.label}</label>
                                    <TaskSelect value={filter.value} onChange={filter.onChange} options={filter.options} />
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
                )}
                {showRequestFilters && activeTab === 'requests' && (
                    <div className="mt-4 p-4 bg-gray-50 dark:bg-[#252525] rounded-lg border border-gray-200 dark:border-[#333]">
                        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(150px, 1fr))`, maxWidth: '100%' }}>
                            {requestFilters.map((filter, index) => (
                                <div key={index}>
                                    <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">{filter.label}</label>
                                    <TaskSelect value={filter.value} onChange={filter.onChange} options={filter.options} />
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
                )}
            </div>
       </div>
       </div>
      )}
       <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
         <div className={`${MODULE_PAGE_GUTTER} pb-20 h-full overflow-y-auto custom-scrollbar flex-1 flex flex-col min-h-0`}>
           {activeTab === 'planning' && planningSubView === 'list' && renderPlanningList()}
           {/* creation planning moved to modal */}
           {activeTab === 'planning' && planningSubView === 'detail' && selectedPlanning && renderPlanningDetail()}
           {activeTab === 'bdr' && onLoadBdr && onSaveBdr && (
             <BdrView bdr={bdr ?? null} onLoadBdr={onLoadBdr} onSaveBdr={onSaveBdr} />
           )}
           {activeTab === 'requests' && renderRequestsTab()}
           {activeTab === 'statements' && <BankStatementsView ref={bankStatementsRef} />}
           {activeTab === 'plan' && planSubView === 'list' && renderPlanList()}
           {activeTab === 'plan' && planSubView === 'create' && renderPlanCreate()}
           {activeTab === 'plan' && planSubView === 'detail' && selectedPlanDoc && renderPlanDetail()}
         </div>
       </div>

       {/* Request Modal */}
       {isRequestModalOpen && (
        <div className="fixed inset-0 bg-black/35 backdrop-blur-sm flex items-end md:items-center justify-center z-[220] animate-in fade-in duration-200" onClick={(e) => { if(e.target === e.currentTarget) setIsRequestModalOpen(false) }}>
            <div className="bg-white dark:bg-[#252525] rounded-t-2xl md:rounded-xl shadow-2xl w-full max-w-lg max-h-[95vh] md:max-h-[90vh] overflow-hidden border border-gray-200 dark:border-[#333]">
                <div className="p-4 border-b border-gray-100 dark:border-[#333] flex justify-between items-center bg-white dark:bg-[#252525]">
                    <h3 className="font-bold text-gray-800 dark:text-white">Заявка на приобретение</h3>
                    <button onClick={() => setIsRequestModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-[#333]"><X size={18} /></button>
                </div>
                <form onSubmit={handleRequestSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Сумма (UZS)</label>
                        <input 
                            type="number" 
                            required 
                            value={reqAmount} 
                            onChange={e => setReqAmount(e.target.value)} 
                            className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-[#333] text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Подразделение</label>
                            <TaskSelect
                                value={reqDep}
                                onChange={setReqDep}
                                options={[
                                    { value: '', label: 'Выберите подразделение' },
                                    ...departments.map(d => ({ value: d.id, label: d.name }))
                                ]}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Статья расходов</label>
                            <TaskSelect
                                value={reqCat}
                                onChange={setReqCat}
                                options={[
                                    { value: '', label: 'Выберите статью' },
                                    ...categories.map(c => ({ value: c.id, label: c.name }))
                                ]}
                            />
                        </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Плановая дата оплаты</label>
                      <DateInput value={reqPaymentDate} onChange={setReqPaymentDate} placeholder="Выберите дату оплаты" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1">Описание / Обоснование</label>
                        <textarea required value={reqDesc} onChange={e => setReqDesc(e.target.value)} className="w-full h-24 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm bg-white dark:bg-[#333] text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 resize-none" placeholder="Что покупаем и зачем?"/>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <Button type="button" variant="secondary" onClick={() => setIsRequestModalOpen(false)} size="md">Отмена</Button>
                        <Button type="submit" size="md">Отправить</Button>
                    </div>
                </form>
            </div>
        </div>
       )}

      {/* Create Financial Planning Modal */}
      {isPlanningCreateModalOpen && (
        <div
          className="fixed inset-0 bg-black/35 backdrop-blur-sm flex items-end md:items-center justify-center z-[220] animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsPlanningCreateModalOpen(false);
          }}
        >
          <div className="bg-white dark:bg-[#252525] rounded-t-2xl md:rounded-xl shadow-2xl w-full max-w-lg max-h-[95vh] md:max-h-[90vh] overflow-hidden border border-gray-200 dark:border-[#333]">
            <div className="p-4 border-b border-gray-100 dark:border-[#333] flex justify-between items-center bg-white dark:bg-[#252525]">
              <h3 className="font-bold text-gray-800 dark:text-white">Новое финансовое планирование</h3>
              <button
                onClick={() => setIsPlanningCreateModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-[#333]"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handlePlanningSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase">
                  Подразделение
                </label>
                <TaskSelect
                  value={newPlanningDepartment}
                  onChange={setNewPlanningDepartment}
                  options={[
                    { value: '', label: 'Выберите подразделение' },
                    ...departments.map(d => ({ value: d.id, label: d.name }))
                  ]}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase">
                  Период (месяц)
                </label>
                <DateInput
                  value={newPlanningPeriod ? `${newPlanningPeriod}-01` : ''}
                  onChange={(v) => setNewPlanningPeriod(v ? v.slice(0, 7) : '')}
                  placeholder="Выберите месяц"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase">
                  Доход за период (UZS)
                </label>
                <input
                  type="number"
                  min={1}
                  value={newPlanningIncome || ''}
                  onChange={(e) => setNewPlanningIncome(parseFloat(e.target.value) || 0)}
                  className="w-full bg-white dark:bg-[#333] border border-gray-200 dark:border-[#444] rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-emerald-500/40 outline-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  placeholder="0"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="secondary" onClick={() => setIsPlanningCreateModalOpen(false)} size="md">
                  Отмена
                </Button>
                <Button type="submit" size="md">
                  Создать
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

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

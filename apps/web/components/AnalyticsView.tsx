import React, { useState, useMemo, useEffect } from 'react';
import {
  Task,
  Deal,
  User,
  FinancePlan,
  Contract,
  AccountsReceivable,
  PurchaseRequest,
  FinancialPlanning,
  FinancialPlanDocument,
} from '../types';
import {
  TrendingUp,
  DollarSign,
  CheckCircle2,
  User as UserIcon,
  BarChart3,
  Wallet,
  FileText,
  Filter,
  Layers,
  X,
  Eye,
  Landmark,
  Receipt,
  ArrowDownRight,
  ArrowUpRight,
} from 'lucide-react';
import { ResponsiveTable } from './features/common/ResponsiveTable';
import { UserAvatar } from './features/common/UserAvatar';
import { ModulePageShell, ModulePageHeader, ModuleSegmentedControl, MODULE_PAGE_GUTTER } from './ui';
import { financeEndpoint, type BankStatementApi } from '../services/apiClient';
import { computeBankStatementTotals } from '../utils/bankStatementParser';

interface AnalyticsViewProps {
  tasks: Task[];
  deals: Deal[];
  users: User[];
  financePlan: FinancePlan | null;
  contracts: Contract[];
  accountsReceivable?: AccountsReceivable[];
  purchaseRequests?: PurchaseRequest[];
  financialPlannings?: FinancialPlanning[];
  financialPlanDocuments?: FinancialPlanDocument[];
}

function getAnalyticsPeriodBounds(period: 'month' | 'quarter' | 'year'): { start: string; end: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const pad = (n: number) => String(n).padStart(2, '0');
  if (period === 'month') {
    const start = `${y}-${pad(m + 1)}-01`;
    const lastDay = new Date(y, m + 1, 0).getDate();
    return { start, end: `${y}-${pad(m + 1)}-${pad(lastDay)}` };
  }
  if (period === 'quarter') {
    const qStart = Math.floor(m / 3) * 3;
    const start = `${y}-${pad(qStart + 1)}-01`;
    const endDate = new Date(y, qStart + 3, 0);
    return {
      start,
      end: `${endDate.getFullYear()}-${pad(endDate.getMonth() + 1)}-${pad(endDate.getDate())}`,
    };
  }
  return { start: `${y}-01-01`, end: `${y}-12-31` };
}

function planningOverlapsBounds(
  p: { period?: string; periodStart?: string; periodEnd?: string },
  bounds: { start: string; end: string }
): boolean {
  let ps = p.periodStart?.slice(0, 10);
  let pe = p.periodEnd?.slice(0, 10);
  if (p.period && /^\d{4}-\d{2}$/.test(p.period)) {
    if (!ps) ps = `${p.period}-01`;
    if (!pe) {
      const d = new Date(`${p.period}-01T12:00:00`);
      const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      pe = last.toISOString().slice(0, 10);
    }
  }
  if (!ps || !pe) return true;
  return pe >= bounds.start && ps <= bounds.end;
}

type EmployeeLeaderboardRow = {
  id: string;
  name: string;
  avatar?: string;
  completedTasks: number;
  totalTasks: number;
  revenue: number;
};

const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  tasks,
  deals,
  users,
  financePlan,
  contracts,
  accountsReceivable = [],
  purchaseRequests = [],
  financialPlannings = [],
  financialPlanDocuments = [],
}) => {
  const [period, setPeriod] = useState<'month' | 'quarter' | 'year'>('month');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'statistics' | 'reports'>('dashboard');
  const [openReport, setOpenReport] = useState<string | null>(null);
  const [bankStatements, setBankStatements] = useState<BankStatementApi[]>([]);
  const [bankLoadState, setBankLoadState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');

  useEffect(() => {
    let cancelled = false;
    setBankLoadState('loading');
    financeEndpoint
      .getBankStatements()
      .then((data) => {
        if (!cancelled) {
          setBankStatements(Array.isArray(data) ? data : []);
          setBankLoadState('done');
        }
      })
      .catch(() => {
        if (!cancelled) {
          setBankStatements([]);
          setBankLoadState('error');
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const periodBounds = useMemo(() => getAnalyticsPeriodBounds(period), [period]);

  const bankTotals = useMemo(
    () => computeBankStatementTotals(bankStatements, periodBounds),
    [bankStatements, periodBounds]
  );

  const requestById = useMemo(() => new Map(purchaseRequests.map((r) => [r.id, r])), [purchaseRequests]);

  const financePlanningConducted = useMemo(() => {
    const conducted = financialPlannings.filter(
      (p) => !p.isArchived && p.status === 'conducted' && planningOverlapsBounds(p, periodBounds)
    );
    let income = 0;
    let expensesApproved = 0;
    conducted.forEach((p) => {
      income += p.income ?? 0;
      p.requestIds.forEach((rid) => {
        const req = requestById.get(rid);
        if (!req || req.isArchived || req.status !== 'approved') return;
        expensesApproved += req.amount ?? 0;
      });
    });
    return { count: conducted.length, income, expensesApproved, net: income - expensesApproved };
  }, [financialPlannings, periodBounds, requestById]);

  const financePlanDocsConducted = useMemo(() => {
    const docs = financialPlanDocuments.filter(
      (d) => !d.isArchived && d.status === 'conducted' && planningOverlapsBounds(d, periodBounds)
    );
    let income = 0;
    let expenses = 0;
    docs.forEach((d) => {
      income += d.income ?? 0;
      const ex = d.expenses ?? {};
      for (const v of Object.values(ex)) {
        expenses += Number(v) || 0;
      }
    });
    return { count: docs.length, income, expenses, net: income - expenses };
  }, [financialPlanDocuments, periodBounds]);

  const outstandingReceivable = useMemo(() => {
    return accountsReceivable.reduce((sum, r) => {
      if (!r || r.isArchived || r.status === 'paid') return sum;
      return sum + Math.max(0, (r.amount || 0) - (r.paidAmount ?? 0));
    }, 0);
  }, [accountsReceivable]);

  // --- Calculations ---

  const activeTasks = tasks.filter((t) => !t.isArchived);
  const activeDeals = deals.filter((d) => !d.isArchived);
  const activeUsers = users.filter((u) => !u.isArchived);
  const activeContracts = contracts.filter((c) => !c.isArchived && c.status === 'active');

  const completedTasks = activeTasks.filter(
    (t) => t.status === 'Выполнено' || t.status === 'Done' || t.status === 'Завершено'
  ).length;
  const inProgressTasks = activeTasks.filter((t) => t.status === 'В работе' || t.status === 'In Progress').length;
  const totalTasks = activeTasks.length;
  const taskCompletionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const wonDeals = activeDeals.filter((d) => d.stage === 'won');
  const totalRevenue =
    wonDeals.reduce((sum, d) => sum + d.amount, 0) + activeContracts.reduce((sum, c) => sum + c.amount, 0);
  const pipelineValue = activeDeals.reduce((sum, d) => sum + d.amount, 0);

  const employeeStats: EmployeeLeaderboardRow[] = activeUsers.map((user) => {
      const userTasks = activeTasks.filter(t => t.assigneeId === user.id || (t.assigneeIds && t.assigneeIds.includes(user.id)));
      const userCompleted = userTasks.filter(t => t.status === 'Выполнено' || t.status === 'Done').length;
      const userDeals = activeDeals.filter(d => d.assigneeId === user.id && d.stage === 'won');
      const userRevenue = userDeals.reduce((sum, d) => sum + d.amount, 0);
      
      return {
          id: user.id,
          name: user.name,
          avatar: user.avatar,
          completedTasks: userCompleted,
          totalTasks: userTasks.length,
          revenue: userRevenue
      };
  }).sort((a, b) => b.completedTasks - a.completedTasks);

  // Sales Funnel Data
  const funnelStages = [
      { id: 'new', label: 'Новая заявка', count: activeDeals.filter(d => d.stage === 'new').length },
      { id: 'qualification', label: 'Квалификация', count: activeDeals.filter(d => d.stage === 'qualification').length },
      { id: 'proposal', label: 'КП', count: activeDeals.filter(d => d.stage === 'proposal').length },
      { id: 'negotiation', label: 'Переговоры', count: activeDeals.filter(d => d.stage === 'negotiation').length },
      { id: 'won', label: 'Успех', count: activeDeals.filter(d => d.stage === 'won').length },
  ];
  const maxStageCount = Math.max(...funnelStages.map(s => s.count), 1);

  // --- Render Tabs ---

  const periodHint =
    period === 'month' ? 'текущий месяц' : period === 'quarter' ? 'текущий квартал' : 'текущий год';

  const renderDashboard = () => (
      <div className="space-y-6">
           {/* KPI CARDS */}
           <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 md:gap-6">
                <div className="bg-white dark:bg-[#252525] p-6 rounded-xl border border-gray-200 dark:border-[#333] shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full"><DollarSign size={24}/></div>
                    <div>
                        <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Выручка (Факт)</div>
                        <div className="text-xl font-bold text-gray-900 dark:text-white">{totalRevenue.toLocaleString()} <span className="text-xs text-gray-400">UZS</span></div>
                        <div className="text-[11px] text-gray-400 mt-1">CRM + активные договоры</div>
                    </div>
                </div>
                <div className="bg-white dark:bg-[#252525] p-6 rounded-xl border border-gray-200 dark:border-[#333] shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full"><CheckCircle2 size={24}/></div>
                    <div>
                        <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Закрыто задач</div>
                        <div className="text-xl font-bold text-gray-900 dark:text-white">{completedTasks} <span className="text-xs text-green-500 font-medium">({taskCompletionRate}%)</span></div>
                    </div>
                </div>
                <div className="bg-white dark:bg-[#252525] p-6 rounded-xl border border-gray-200 dark:border-[#333] shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-full"><TrendingUp size={24}/></div>
                    <div>
                        <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">В воронке</div>
                        <div className="text-xl font-bold text-gray-900 dark:text-white">{pipelineValue.toLocaleString()} <span className="text-xs text-gray-400">UZS</span></div>
                    </div>
                </div>
                <div className="bg-white dark:bg-[#252525] p-6 rounded-xl border border-gray-200 dark:border-[#333] shadow-sm flex items-center gap-4">
                    <div className="p-3 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-full"><Receipt size={24}/></div>
                    <div>
                        <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Дебиторка (остаток)</div>
                        <div className="text-xl font-bold text-gray-900 dark:text-white">{outstandingReceivable.toLocaleString()} <span className="text-xs text-gray-400">UZS</span></div>
                        <div className="text-[11px] text-gray-400 mt-1">без архива и оплаченных</div>
                    </div>
                </div>
                <div className="bg-white dark:bg-[#252525] p-6 rounded-xl border border-gray-200 dark:border-[#333] shadow-sm flex items-center gap-4 sm:col-span-2 xl:col-span-1">
                    <div className="p-3 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-full"><UserIcon size={24}/></div>
                    <div>
                        <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">Команда</div>
                        <div className="text-xl font-bold text-gray-900 dark:text-white">{activeUsers.length} <span className="text-xs text-gray-400">чел.</span></div>
                    </div>
                </div>
           </div>

           {/* Финансы: выписки + проведённые планирования */}
           <div className="rounded-2xl border border-sky-200/80 dark:border-sky-800/50 bg-gradient-to-br from-sky-50/90 via-white to-white dark:from-sky-950/30 dark:via-[#252525] dark:to-[#252525] p-6 shadow-sm">
              <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white text-lg flex items-center gap-2">
                    <Landmark size={22} className="text-sky-600 dark:text-sky-400" />
                    Финансы по периоду
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Расчётный счёт (выписки) и модуль «Финансы» — проведённые планирования и план-документы. Период: {periodHint}.
                  </p>
                </div>
                {bankLoadState === 'loading' && (
                  <span className="text-xs text-gray-400">Загрузка выписок…</span>
                )}
                {bankLoadState === 'error' && (
                  <span className="text-xs text-amber-600 dark:text-amber-400">Выписки недоступны (офлайн или ошибка API)</span>
                )}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="rounded-xl border border-gray-200 dark:border-[#333] bg-white/80 dark:bg-[#1e1e1e] p-5">
                  <div className="flex items-center gap-2 mb-4 text-sm font-semibold text-gray-800 dark:text-gray-100">
                    <Wallet className="text-emerald-600 dark:text-emerald-400" size={18} />
                    Расчётный счёт (выписки)
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-emerald-50/80 dark:bg-emerald-950/30 px-3 py-3 border border-emerald-100 dark:border-emerald-900/40">
                      <div className="text-[11px] uppercase font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                        <ArrowDownRight size={14} /> Приход
                      </div>
                      <div className="text-lg font-bold text-emerald-800 dark:text-emerald-200 mt-1">{bankTotals.income.toLocaleString()} UZS</div>
                    </div>
                    <div className="rounded-lg bg-rose-50/80 dark:bg-rose-950/30 px-3 py-3 border border-rose-100 dark:border-rose-900/40">
                      <div className="text-[11px] uppercase font-bold text-rose-700 dark:text-rose-400 flex items-center gap-1">
                        <ArrowUpRight size={14} /> Расход
                      </div>
                      <div className="text-lg font-bold text-rose-800 dark:text-rose-200 mt-1">{bankTotals.expense.toLocaleString()} UZS</div>
                    </div>
                    <div className="rounded-lg bg-slate-50 dark:bg-[#2a2a2a] px-3 py-2 border border-slate-200 dark:border-[#444] col-span-2">
                      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                        <span>Комиссии банка (оценка)</span>
                        <span className="font-medium text-gray-800 dark:text-gray-200">{bankTotals.commission.toLocaleString()} UZS</span>
                      </div>
                      <div className="flex justify-between items-center mt-2 pt-2 border-t border-slate-200 dark:border-[#444]">
                        <span className="text-sm font-semibold text-gray-800 dark:text-white">Чистое движение</span>
                        <span className={`text-lg font-bold ${bankTotals.balance >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                          {bankTotals.balance.toLocaleString()} UZS
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-gray-200 dark:border-[#333] bg-white/80 dark:bg-[#1e1e1e] p-5">
                  <div className="flex items-center gap-2 mb-4 text-sm font-semibold text-gray-800 dark:text-gray-100">
                    <FileText className="text-sky-600 dark:text-sky-400" size={18} />
                    Проведённые планирования (касса)
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">Документов проведено</span>
                      <span className="font-bold text-gray-900 dark:text-white">{financePlanningConducted.count}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">Доход (кассовый метод)</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">{financePlanningConducted.income.toLocaleString()} UZS</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">Расходы по одобренным заявкам</span>
                      <span className="font-bold text-rose-600 dark:text-rose-400">{financePlanningConducted.expensesApproved.toLocaleString()} UZS</span>
                    </div>
                    <div className="rounded-lg bg-sky-50/90 dark:bg-sky-950/25 px-3 py-3 border border-sky-100 dark:border-sky-900/40 flex justify-between items-center">
                      <span className="text-sm font-semibold text-gray-800 dark:text-white">Итог</span>
                      <span className={`text-lg font-bold ${financePlanningConducted.net >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {financePlanningConducted.net.toLocaleString()} UZS
                      </span>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-gray-200 dark:border-[#333] bg-white/80 dark:bg-[#1e1e1e] p-5 lg:col-span-2">
                  <div className="flex items-center gap-2 mb-4 text-sm font-semibold text-gray-800 dark:text-gray-100">
                    <BarChart3 className="text-violet-600 dark:text-violet-400" size={18} />
                    Проведённые финансовые план-документы (по статьям)
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Документов</div>
                      <div className="text-xl font-bold text-gray-900 dark:text-white">{financePlanDocsConducted.count}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">План дохода</div>
                      <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{financePlanDocsConducted.income.toLocaleString()} UZS</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">План расходов (статьи)</div>
                      <div className="text-xl font-bold text-rose-600 dark:text-rose-400">{financePlanDocsConducted.expenses.toLocaleString()} UZS</div>
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-gray-100 dark:border-[#333] flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-gray-300">Сальдо по план-документам</span>
                    <span className={`font-bold ${financePlanDocsConducted.net >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {financePlanDocsConducted.net.toLocaleString()} UZS
                    </span>
                  </div>
                </div>
              </div>
           </div>

           <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Task Efficiency Chart */}
                <div className="lg:col-span-2 bg-white dark:bg-[#252525] p-6 rounded-xl border border-gray-200 dark:border-[#333] shadow-sm">
                    <h3 className="font-bold text-gray-800 dark:text-white mb-6 flex items-center gap-2"><BarChart3 size={20}/> Общая эффективность</h3>
                    
                    <div className="flex items-end gap-8 h-48 border-b border-gray-100 dark:border-[#444] pb-2">
                        <div className="flex-1 flex flex-col items-center gap-2 group">
                            <div className="text-xs font-bold text-gray-900 dark:text-white opacity-0 group-hover:opacity-100 transition-opacity mb-auto">{completedTasks}</div>
                            <div className="w-full bg-green-500 dark:bg-green-600 rounded-t hover:opacity-80 transition-opacity" style={{ height: `${totalTasks ? (completedTasks/totalTasks)*100 : 0}%`, minHeight: '4px' }}></div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">Готово</div>
                        </div>
                        <div className="flex-1 flex flex-col items-center gap-2 group">
                            <div className="text-xs font-bold text-gray-900 dark:text-white opacity-0 group-hover:opacity-100 transition-opacity mb-auto">{inProgressTasks}</div>
                            <div className="w-full bg-blue-500 dark:bg-blue-600 rounded-t hover:opacity-80 transition-opacity" style={{ height: `${totalTasks ? (inProgressTasks/totalTasks)*100 : 0}%`, minHeight: '4px' }}></div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">В работе</div>
                        </div>
                        <div className="flex-1 flex flex-col items-center gap-2 group">
                            <div className="text-xs font-bold text-gray-900 dark:text-white opacity-0 group-hover:opacity-100 transition-opacity mb-auto">{totalTasks - completedTasks - inProgressTasks}</div>
                            <div className="w-full bg-gray-300 dark:bg-gray-600 rounded-t hover:opacity-80 transition-opacity" style={{ height: `${totalTasks ? ((totalTasks - completedTasks - inProgressTasks)/totalTasks)*100 : 0}%`, minHeight: '4px' }}></div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">Очередь</div>
                        </div>
                    </div>
                </div>

                {/* Finance Mini */}
                <div className="bg-white dark:bg-[#252525] p-6 rounded-xl border border-gray-200 dark:border-[#333] shadow-sm flex flex-col">
                    <h3 className="font-bold text-gray-800 dark:text-white mb-6 flex items-center gap-2"><Wallet size={20}/> Финансы</h3>
                    
                    <div className="space-y-6 flex-1">
                        <div>
                            <div className="flex justify-between text-sm mb-1">
                                <span className="text-gray-500 dark:text-gray-400">План продаж</span>
                                <span className="font-bold text-gray-900 dark:text-white">{financePlan?.salesPlan.toLocaleString()}</span>
                            </div>
                            <div className="w-full bg-gray-100 dark:bg-[#333] h-2 rounded-full overflow-hidden">
                                <div className="bg-blue-600 h-full rounded-full" style={{ width: `${Math.min(100, (totalRevenue / (financePlan?.salesPlan || 1)) * 100)}%` }}></div>
                            </div>
                            <div className="text-right text-xs text-blue-600 dark:text-blue-400 mt-1 font-medium">{Math.round((totalRevenue / (financePlan?.salesPlan || 1)) * 100)}% выполнено</div>
                        </div>

                        <div>
                            <div className="flex justify-between text-sm mb-1">
                                <span className="text-gray-500 dark:text-gray-400">Факт Доход</span>
                                <span className="font-bold text-green-600 dark:text-green-400">{financePlan?.currentIncome.toLocaleString()}</span>
                            </div>
                            <div className="w-full bg-gray-100 dark:bg-[#333] h-2 rounded-full overflow-hidden">
                                <div className="bg-green-500 h-full rounded-full" style={{ width: '100%' }}></div>
                            </div>
                        </div>
                    </div>
                </div>
           </div>
      </div>
  );

  const renderStatistics = () => (
      <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Sales Funnel Chart */}
              <div className="bg-white dark:bg-[#252525] p-6 rounded-xl border border-gray-200 dark:border-[#333] shadow-sm">
                  <h3 className="font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2"><Filter size={20}/> Воронка продаж</h3>
                  <div className="space-y-3">
                      {funnelStages.map(stage => (
                          <div key={stage.id} className="relative">
                              <div className="flex justify-between text-xs font-medium text-gray-600 dark:text-gray-300 mb-1 z-10 relative">
                                  <span>{stage.label}</span>
                                  <span>{stage.count}</span>
                              </div>
                              <div className="w-full bg-gray-100 dark:bg-[#333] h-6 rounded overflow-hidden">
                                  <div 
                                    className="bg-blue-500/80 dark:bg-blue-600/80 h-full rounded transition-all duration-500" 
                                    style={{ width: `${(stage.count / maxStageCount) * 100}%` }}
                                  ></div>
                              </div>
                          </div>
                      ))}
                  </div>
              </div>

              {/* Tasks by Module */}
              <div className="bg-white dark:bg-[#252525] p-6 rounded-xl border border-gray-200 dark:border-[#333] shadow-sm">
                  <h3 className="font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2"><Layers size={20}/> Задачи по модулям</h3>
                  <div className="space-y-3">
                      {/* Simple list stats */}
                      <div className="space-y-2">
                          {/* We'd need to group tasks by project here, doing simplified version */}
                          <div className="flex justify-between items-center p-2 border-b border-gray-100 dark:border-[#333]">
                              <span className="text-sm text-gray-600 dark:text-gray-400">Всего задач</span>
                              <span className="font-bold text-gray-800 dark:text-white">{activeTasks.length}</span>
                          </div>
                          <div className="flex justify-between items-center p-2 border-b border-gray-100 dark:border-[#333]">
                              <span className="text-sm text-gray-600 dark:text-gray-400">Просрочено</span>
                              <span className="font-bold text-red-500">{activeTasks.filter(t => new Date(t.endDate) < new Date() && t.status !== 'Выполнено').length}</span>
                          </div>
                      </div>
                  </div>
              </div>
          </div>

          {/* Employee Leaderboard */}
          <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-xl shadow-sm overflow-hidden">
               <div className="p-6 border-b border-gray-200 dark:border-[#333]">
                   <h3 className="font-bold text-gray-800 dark:text-white">Рейтинг сотрудников</h3>
               </div>
               <ResponsiveTable<EmployeeLeaderboardRow>
                   data={employeeStats}
                   columns={[
                       {
                           key: 'rank',
                           label: '#',
                           render: (emp, idx) => <span className="text-gray-400 font-medium">{idx + 1}</span>,
                           className: 'w-16'
                       },
                       {
                           key: 'name',
                           label: 'Сотрудник',
                           render: (emp) => (
                               <div className="flex items-center gap-3">
                                   <UserAvatar user={{ id: emp.id, name: emp.name, avatar: emp.avatar } as User} size="sm" />
                                   <span className="font-bold text-gray-800 dark:text-gray-200">{emp.name}</span>
                               </div>
                           )
                       },
                       {
                           key: 'completedTasks',
                           label: 'Закрыто задач',
                           render: (emp) => (
                               <span className="text-right font-medium text-gray-700 dark:text-gray-300">
                                   {emp.completedTasks}
                               </span>
                           ),
                           className: 'text-right'
                       },
                       {
                           key: 'efficiency',
                           label: 'Эффективность',
                           render: (emp) => (
                               <span className="text-right font-medium text-gray-700 dark:text-gray-300">
                                   {emp.totalTasks > 0 ? Math.round((emp.completedTasks / emp.totalTasks) * 100) : 0}%
                               </span>
                           ),
                           className: 'text-right'
                       },
                       {
                           key: 'revenue',
                           label: 'Продажи (UZS)',
                           render: (emp) => (
                               <span className="text-right font-bold text-green-600 dark:text-green-400">
                                   {emp.revenue.toLocaleString()}
                               </span>
                           ),
                           className: 'text-right'
                       }
                   ]}
                   keyExtractor={(emp) => emp.id}
                   emptyMessage="Нет данных о сотрудниках"
                   className="p-0"
               />
           </div>
      </div>
  );

  const renderReportContent = (reportType: string) => {
    switch(reportType) {
      case 'Финансовый отчет':
        const totalRevenue = activeDeals.filter(d => d.stage === 'won').reduce((sum, d) => sum + d.amount, 0) + activeContracts.reduce((sum, c) => sum + c.amount, 0);
        const totalBudget = financePlan ? (financePlan.salesPlan || 0) : 0;
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                <div className="text-xs font-bold text-green-600 dark:text-green-400 uppercase mb-1">Выручка</div>
                <div className="text-2xl font-bold text-green-700 dark:text-green-300">{totalRevenue.toLocaleString()} UZS</div>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase mb-1">План продаж</div>
                <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{totalBudget.toLocaleString()} UZS</div>
              </div>
              <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border border-purple-200 dark:border-purple-800">
                <div className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase mb-1">Выполнение</div>
                <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                  {totalBudget > 0 ? Math.round((totalRevenue / totalBudget) * 100) : 0}%
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-lg p-4">
              <h4 className="font-bold text-gray-800 dark:text-white mb-3">Активные договоры</h4>
              <div className="space-y-2">
                {activeContracts.slice(0, 10).map(c => (
                  <div key={c.id} className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-[#333] last:border-0">
                    <span className="text-sm text-gray-700 dark:text-gray-300">{c.number}</span>
                    <span className="font-bold text-gray-900 dark:text-white">{c.amount.toLocaleString()} UZS</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      
      case 'Отчет по продажам':
        const wonDeals = activeDeals.filter(d => d.stage === 'won');
        const lostDeals = activeDeals.filter(d => d.stage === 'lost');
        const conversionRate = activeDeals.length > 0 ? Math.round((wonDeals.length / activeDeals.length) * 100) : 0;
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                <div className="text-xs font-bold text-green-600 dark:text-green-400 uppercase mb-1">Успешные</div>
                <div className="text-2xl font-bold text-green-700 dark:text-green-300">{wonDeals.length}</div>
              </div>
              <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-800">
                <div className="text-xs font-bold text-red-600 dark:text-red-400 uppercase mb-1">Отказы</div>
                <div className="text-2xl font-bold text-red-700 dark:text-red-300">{lostDeals.length}</div>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase mb-1">В работе</div>
                <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{activeDeals.filter(d => d.stage !== 'won' && d.stage !== 'lost').length}</div>
              </div>
              <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border border-purple-200 dark:border-purple-800">
                <div className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase mb-1">Конверсия</div>
                <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">{conversionRate}%</div>
              </div>
            </div>
            <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-lg p-4">
              <h4 className="font-bold text-gray-800 dark:text-white mb-3">Воронка продаж</h4>
              <div className="space-y-2">
                {[
                  { stage: 'new', label: 'Новая заявка', count: activeDeals.filter(d => d.stage === 'new').length },
                  { stage: 'qualification', label: 'Квалификация', count: activeDeals.filter(d => d.stage === 'qualification').length },
                  { stage: 'proposal', label: 'Предложение (КП)', count: activeDeals.filter(d => d.stage === 'proposal').length },
                  { stage: 'negotiation', label: 'Переговоры', count: activeDeals.filter(d => d.stage === 'negotiation').length },
                ].map(s => (
                  <div key={s.stage} className="flex items-center gap-3">
                    <div className="w-32 text-sm text-gray-600 dark:text-gray-400">{s.label}</div>
                    <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-6 relative">
                      <div 
                        className="bg-blue-500 h-6 rounded-full flex items-center justify-end pr-2"
                        style={{ width: `${activeDeals.length > 0 ? (s.count / activeDeals.length) * 100 : 0}%` }}
                      >
                        <span className="text-xs font-bold text-white">{s.count}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      
      case 'Отчет по кадрам':
        return (
          <div className="space-y-6">
            <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-lg p-4">
              <h4 className="font-bold text-gray-800 dark:text-white mb-3">Команда</h4>
              <div className="space-y-2">
                {activeUsers.map(u => (
                  <div key={u.id} className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-[#333] last:border-0">
                    <div className="flex items-center gap-3">
                      <img src={u.avatar} className="w-8 h-8 rounded-full object-cover object-center" alt="" />
                      <span className="text-sm font-medium text-gray-800 dark:text-white">{u.name}</span>
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{u.role}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      
      case 'Лог задач':
        const completedTasks = activeTasks.filter(t => t.status === 'Выполнено' || t.status === 'Done');
        const overdueTasks = activeTasks.filter(t => {
          const endDate = new Date(t.endDate);
          const today = new Date();
          return endDate < today && !completedTasks.find(ct => ct.id === t.id);
        });
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                <div className="text-xs font-bold text-green-600 dark:text-green-400 uppercase mb-1">Выполнено</div>
                <div className="text-2xl font-bold text-green-700 dark:text-green-300">{completedTasks.length}</div>
              </div>
              <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-800">
                <div className="text-xs font-bold text-red-600 dark:text-red-400 uppercase mb-1">Просрочено</div>
                <div className="text-2xl font-bold text-red-700 dark:text-red-300">{overdueTasks.length}</div>
              </div>
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase mb-1">Всего</div>
                <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{activeTasks.length}</div>
              </div>
            </div>
            <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-lg p-4">
              <h4 className="font-bold text-gray-800 dark:text-white mb-3">Последние выполненные задачи</h4>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {completedTasks.slice(0, 20).map(t => (
                  <div key={t.id} className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-[#333] last:border-0">
                    <span className="text-sm text-gray-700 dark:text-gray-300">{t.title}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{new Date(t.endDate).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      
      default:
        return <div className="text-gray-500 dark:text-gray-400">Отчет в разработке</div>;
    }
  };

  const renderReports = () => (
      <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                  { title: 'Финансовый отчет', icon: <Wallet size={24}/>, desc: 'Доходы, расходы, прибыль и P&L', color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900/30' },
                  { title: 'Отчет по продажам', icon: <TrendingUp size={24}/>, desc: 'Воронка, конверсия, менеджеры', color: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-900/30' },
                  { title: 'Отчет по кадрам', icon: <UserIcon size={24}/>, desc: 'Зарплатная ведомость, KPI, найм', color: 'text-purple-600', bg: 'bg-purple-100 dark:bg-purple-900/30' },
                  { title: 'Лог задач', icon: <FileText size={24}/>, desc: 'Все выполненные и просроченные задачи', color: 'text-orange-600', bg: 'bg-orange-100 dark:bg-orange-900/30' },
              ].map(report => (
                  <div key={report.title} className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-xl p-6 hover:shadow-md transition-shadow flex justify-between items-center group">
                      <div className="flex items-center gap-4">
                          <div className={`p-3 rounded-full ${report.bg} ${report.color}`}>{report.icon}</div>
                          <div>
                              <h3 className="font-bold text-gray-800 dark:text-white text-lg">{report.title}</h3>
                              <p className="text-sm text-gray-500 dark:text-gray-400">{report.desc}</p>
                          </div>
                      </div>
                      <button onClick={() => setOpenReport(report.title)} className="p-2 bg-gray-50 dark:bg-[#303030] rounded-lg text-gray-400 group-hover:text-blue-600 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/30 transition-colors">
                          <Eye size={20} />
                      </button>
                  </div>
              ))}
          </div>
      </div>
  );

  return (
    <ModulePageShell>
      <div className={`${MODULE_PAGE_GUTTER} pt-6 md:pt-8 flex-shrink-0`}>
        <div className="mb-6 space-y-5">
          <ModulePageHeader
            accent="sky"
            icon={<BarChart3 size={24} strokeWidth={2} />}
            title="Аналитика и отчёты"
            description="Аналитика и отчётность"
            tabs={
              <ModuleSegmentedControl
                variant="neutral"
                value={activeTab}
                onChange={(v) => setActiveTab(v as 'dashboard' | 'statistics' | 'reports')}
                options={[
                  { value: 'dashboard', label: 'Дашборд' },
                  { value: 'statistics', label: 'Статистика' },
                  { value: 'reports', label: 'Отчёты' },
                ]}
              />
            }
            controls={
              <ModuleSegmentedControl
                variant="accent"
                accent="sky"
                value={period}
                onChange={(v) => setPeriod(v as 'month' | 'quarter' | 'year')}
                options={[
                  { value: 'month', label: 'Месяц' },
                  { value: 'quarter', label: 'Квартал' },
                  { value: 'year', label: 'Год' },
                ]}
              />
            }
          />
        </div>
      </div>
       <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0">
         <div className={`${MODULE_PAGE_GUTTER} pb-20`}>
       {activeTab === 'dashboard' && renderDashboard()}
       {activeTab === 'statistics' && renderStatistics()}
       {activeTab === 'reports' && renderReports()}
         </div>
       </div>
       
       {/* Report Modal */}
       {openReport && (
         <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[80]" onClick={() => setOpenReport(null)}>
           <div className="bg-white dark:bg-[#252525] w-full max-w-4xl max-h-[90vh] rounded-xl flex flex-col overflow-hidden border border-gray-200 dark:border-[#333]" onClick={e => e.stopPropagation()}>
             <div className="p-4 border-b border-gray-100 dark:border-[#333] flex justify-between items-center bg-white dark:bg-[#252525] shrink-0">
               <h3 className="font-bold text-gray-800 dark:text-white text-xl">{openReport}</h3>
               <button onClick={() => setOpenReport(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-[#333]">
                 <X size={20} />
               </button>
             </div>
             <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
               {renderReportContent(openReport)}
             </div>
           </div>
         </div>
       )}
    </ModulePageShell>
  );
};

export default AnalyticsView;

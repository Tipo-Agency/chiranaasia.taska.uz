
import React, { useState, useEffect } from 'react';
import { Task, User, ActivityLog, Meeting, FinancePlan, PurchaseRequest, Deal, ContentPost, Role, EmployeeInfo } from '../types';
import { CheckCircle2, Clock, Calendar, ArrowRight, Wallet, TrendingUp, Briefcase, Zap, Plus, X, LayoutGrid } from 'lucide-react';
import { Button, ModulePageShell, ModulePageHeader, MODULE_PAGE_GUTTER } from './ui';
import { getTodayLocalDate, parseLocalDate, isOverdue } from '../utils/dateUtils';

interface HomeViewProps {
  currentUser: User;
  tasks: Task[];
  recentActivity: ActivityLog[];
  meetings?: Meeting[];
  financePlan?: FinancePlan | null;
  purchaseRequests?: PurchaseRequest[];
  deals?: Deal[];
  contentPosts?: ContentPost[];
  employeeInfos?: EmployeeInfo[];
  accountsReceivable?: { amount: number }[];
  onOpenTask: (task: Task) => void;
  onNavigateToInbox: () => void;
  onQuickCreateTask: () => void;
  onQuickCreateProcess: () => void;
  onQuickCreateDeal: () => void;
}

interface ActionItem {
    id: string;
    type: 'task' | 'meeting' | 'request' | 'deal' | 'content';
    title: string;
    subtitle?: string;
    time?: string;
    priority?: 'high' | 'medium' | 'low';
    status: string;
    onClick?: () => void;
}

const HomeView: React.FC<HomeViewProps> = ({ 
    currentUser, tasks, recentActivity, meetings = [], financePlan, purchaseRequests = [], deals = [], contentPosts = [],
    employeeInfos = [], accountsReceivable = [], onOpenTask, onNavigateToInbox, onQuickCreateTask, onQuickCreateProcess, onQuickCreateDeal
}) => {
  const [showBirthdayModal, setShowBirthdayModal] = useState(false);
  
  // Приветствие в зависимости от времени суток (локальное время устройства)
  const hour = new Date().getHours();
  let greeting: string;
  if (hour >= 6 && hour < 12) {
    greeting = 'Доброе утро';
  } else if (hour >= 12 && hour < 18) {
    greeting = 'Добрый день';
  } else if (hour >= 18 && hour < 23) {
    greeting = 'Добрый вечер';
  } else {
    greeting = 'Доброй ночи';
  }
  
  // Форматирование даты: "Понедельник, 29 декабря 2025"
  const today = new Date();
  const dayOfWeek = today.toLocaleDateString('ru-RU', { weekday: 'long' });
  const dayOfMonth = today.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  const formattedDate = `${dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1)}, ${dayOfMonth}`;
  
  const todayStr = getTodayLocalDate();
  
  // Проверка дня рождения (локальное время устройства)
  useEffect(() => {
    const employeeInfo = employeeInfos.find(e => e.userId === currentUser?.id);
    if (employeeInfo?.birthDate) {
      const birthDate = new Date(employeeInfo.birthDate);
      const today = new Date();
      const isBirthday = birthDate.getMonth() === today.getMonth() && birthDate.getDate() === today.getDate();
      
      if (isBirthday) {
        // Проверяем, показывали ли уже сегодня (через localStorage)
        const lastShown = localStorage.getItem(`birthday_${currentUser.id}_${todayStr}`);
        if (!lastShown) {
          setShowBirthdayModal(true);
          localStorage.setItem(`birthday_${currentUser.id}_${todayStr}`, 'true');
        }
      }
    }
  }, [currentUser?.id, employeeInfos, todayStr]);

  const actionItems: ActionItem[] = [];

  if (currentUser?.role === Role.ADMIN) {
      purchaseRequests.filter(r => r && r.status === 'pending').forEach(r => {
          actionItems.push({ id: r.id, type: 'request', title: `Заявка: ${r.amount.toLocaleString()} UZS`, subtitle: r.description, priority: 'high', status: 'На согласовании', time: new Date(r.date).toLocaleDateString() });
      });
  }

  // Задачи пользователя - исключаем идеи и функции, архивные и выполненные
  // Показываем задачи назначенные на текущего пользователя (assigneeId или assigneeIds)
  const myTasks = (tasks || []).filter(t => 
    t && 
    t.entityType !== 'idea' && 
    t.entityType !== 'feature' &&
    !t.isArchived &&
    !['Выполнено', 'Done', 'Завершено'].includes(t.status) && 
    (t.assigneeId === currentUser?.id || t.assigneeIds?.includes(currentUser?.id))
  );
  
  // Задачи на сегодня и просроченные - фильтруем по назначенным на текущего пользователя
  const todayLocal = getTodayLocalDate();
  
  const todayTasks = myTasks.filter(t => {
    if (!t || !t.endDate) return false;
    
    // Включаем задачи на сегодня и просроченные (дата <= сегодня)
    return t.endDate <= todayLocal;
  }).sort((a, b) => {
    // Сортировка: сначала просроченные, потом по приоритету, потом по дате
    const aOverdue = isOverdue(a.endDate || '') && !['Выполнено', 'Done', 'Завершено'].includes(a.status);
    const bOverdue = isOverdue(b.endDate || '') && !['Выполнено', 'Done', 'Завершено'].includes(b.status);

    if (aOverdue && !bOverdue) return -1;
    if (!aOverdue && bOverdue) return 1;

    const priorityOrder = { 'Высокий': 1, 'Средний': 2, 'Низкий': 3 };
    const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder] || 4;
    const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder] || 4;

    if (aPriority !== bPriority) return aPriority - bPriority;

    const aDate = parseLocalDate(a.endDate || '');
    const bDate = parseLocalDate(b.endDate || '');
    return aDate.getTime() - bDate.getTime();
  });
  
  // Сортируем: сначала задачи на сегодня, потом остальные
  const sortedTasks = myTasks.sort((a, b) => {
    const aIsToday = a.endDate === todayStr;
    const bIsToday = b.endDate === todayStr;
    if (aIsToday && !bIsToday) return -1;
    if (!aIsToday && bIsToday) return 1;
    return 0;
  });
  
  sortedTasks.forEach(t => {
    const isToday = t.endDate === todayStr;
    actionItems.push({ 
      id: t.id, 
      type: 'task', 
      title: t.title, 
      subtitle: t.projectId ? 'Проектная задача' : undefined, 
      priority: t.priority === 'Высокий' ? 'high' : 'medium', 
      status: t.status, 
      time: isToday ? 'Сегодня' : (t.endDate ? new Date(t.endDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) : 'Без срока'), 
      onClick: () => onOpenTask(t) 
    });
  });

  const todayMeetings = meetings.filter(m => m && m.date === todayStr && (m.participantIds?.includes(currentUser?.id) || !m.participantIds || m.participantIds.length === 0));
  todayMeetings.forEach(m => {
      actionItems.push({ id: m.id, type: 'meeting', title: `Встреча: ${m.title}`, subtitle: m.time, time: m.time, status: 'Запланировано', priority: 'medium' });
  });

  actionItems.sort((a, b) => { if (a.priority === 'high' && b.priority !== 'high') return -1; if (b.priority === 'high' && a.priority !== 'high') return 1; return 0; });

  const totalRevenue = (deals || []).filter(d => d && d.stage === 'won').reduce((sum, d) => sum + d.amount, 0);
  const totalReceivable = (accountsReceivable || []).reduce((sum, r) => sum + (r?.amount || 0), 0);
  const planPercent = financePlan && financePlan.salesPlan > 0 ? Math.round((totalRevenue / financePlan.salesPlan) * 100) : 0;
  const myDeals = (deals || []).filter(d => d && d.assigneeId === currentUser?.id && d.stage !== 'won' && d.stage !== 'lost');

  // Проверка на наличие currentUser
  if (!currentUser) {
    return (
      <div className="h-full flex items-center justify-center bg-white dark:bg-[#191919]">
        <div className="p-10 text-center text-gray-500 dark:text-gray-400">Пользователь не найден</div>
      </div>
    );
  }

  return (
    <>
      {/* Модалка поздравления с днем рождения */}
      {showBirthdayModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowBirthdayModal(false)}>
          <div className="bg-white dark:bg-[#1e1e1e] rounded-xl p-6 max-w-md w-full mx-4 border border-gray-200 dark:border-[#333] shadow-lg" onClick={(e) => e.stopPropagation()}>
            <div className="text-center">
              <div className="text-6xl mb-4">🎉</div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Поздравляем с днем рождения, {currentUser?.name || 'Пользователь'}!
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Желаем успехов, здоровья и счастья!
              </p>
              <Button onClick={() => setShowBirthdayModal(false)}>
                Закрыть
              </Button>
            </div>
          </div>
        </div>
      )}

      <ModulePageShell className="h-full">
      <div className={`${MODULE_PAGE_GUTTER} pb-20 pt-8 h-full flex flex-col overflow-hidden`}>
        <ModulePageHeader
          icon={<LayoutGrid size={24} strokeWidth={2} />}
          title={`${greeting}, ${currentUser?.name || 'Пользователь'}`}
          description={`${formattedDate} · Командный центр`}
          accent="indigo"
          actions={
            <div className="flex flex-wrap items-center gap-2">
            <button onClick={onQuickCreateTask} className="p-2.5 bg-white dark:bg-[#252525] text-blue-600 dark:text-blue-400 rounded-xl text-xs font-bold hover:shadow-md transition-all flex items-center gap-1.5 shadow-sm border border-blue-100 dark:border-blue-900/30">
              <CheckCircle2 size={18}/> Задача
            </button>
            <button onClick={onQuickCreateDeal} className="p-2.5 bg-white dark:bg-[#252525] text-green-600 dark:text-green-400 rounded-xl text-xs font-bold hover:shadow-md transition-all flex items-center gap-1.5 shadow-sm border border-green-100 dark:border-green-900/30">
              <Briefcase size={18}/> Сделка
            </button>
            <button onClick={onQuickCreateProcess} className="p-2.5 bg-white dark:bg-[#252525] text-purple-600 dark:text-purple-400 rounded-xl text-xs font-bold hover:shadow-md transition-all flex items-center gap-1.5 shadow-sm border border-purple-100 dark:border-purple-900/30">
              <Zap size={18}/> Процесс
            </button>
            </div>
          }
        />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 flex-1 min-h-0 mt-4">
        <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-4 h-full min-h-0">
            {/* ЗАДАЧИ НА СЕГОДНЯ */}
            <div className="bg-white dark:bg-[#1e1e1e] rounded-xl border border-gray-200 dark:border-[#333] shadow-sm p-4 flex flex-col h-full overflow-hidden">
                <h3 className="font-bold text-sm text-gray-800 dark:text-white mb-4 flex items-center gap-2 shrink-0"><CheckCircle2 size={16} className="text-blue-500"/> Задачи на сегодня</h3>
                <div className="space-y-2 overflow-y-auto custom-scrollbar">
                    {todayTasks.length === 0 ? (
                        <div className="p-8 text-center text-xs text-gray-400">Нет задач на сегодня</div>
                    ) : (
                        todayTasks.map(task => {
                            const taskOverdue = isOverdue(task.endDate || '') && !['Выполнено', 'Done', 'Завершено'].includes(task.status);
                            
                            const priorityColor = task.priority === 'Высокий' ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' : 
                                                 task.priority === 'Средний' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400' : 
                                                 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400';
                            
                            return (
                                <div key={task.id} onClick={() => onOpenTask(task)} className={`p-3 rounded-lg border ${taskOverdue ? 'border-red-300 dark:border-red-700 bg-red-50/50 dark:bg-red-900/10' : 'border-gray-200 dark:border-[#333]'} hover:border-blue-300 dark:hover:border-blue-700 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-all cursor-pointer`}>
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white flex-1">
                                            {taskOverdue && <span className="text-red-600 dark:text-red-400 mr-1">⚠️</span>}
                                            {task.title}
                                        </h4>
                                        {task.priority && (
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${priorityColor}`}>
                                                {task.priority}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                        <span>{task.status}</span>
                                        {taskOverdue && <span className="text-red-600 dark:text-red-400 font-semibold">• Просрочено</span>}
                                        {task.projectId && <span>• Проект</span>}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-4 h-full flex flex-col overflow-y-auto custom-scrollbar">
            {/* ВЫРУЧКА И ЗАДОЛЖЕННОСТИ */}
            {(currentUser.role === Role.ADMIN && (financePlan || totalRevenue > 0 || totalReceivable > 0)) && (
                <>
                    <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-xl p-4 shadow-sm shrink-0">
                        <div className="flex justify-between items-start mb-3">
                            <div className="bg-gray-100 dark:bg-[#333] p-1.5 rounded-lg text-gray-500 dark:text-gray-400"><TrendingUp size={16}/></div>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">ВЫРУЧКА</span>
                        </div>
                        <div className="mb-2">
                            <div className="text-xl font-bold text-gray-900 dark:text-white">{totalRevenue.toLocaleString()}</div>
                            <div className="text-[10px] text-gray-500 dark:text-gray-400">Успешные сделки (UZS)</div>
                        </div>
                        {financePlan && financePlan.salesPlan > 0 && (
                            <>
                                <div className="w-full bg-gray-100 dark:bg-[#333] h-1 rounded-full overflow-hidden mb-1">
                                    <div className="bg-[#267022] h-full rounded-full" style={{ width: `${Math.min(100, planPercent)}%` }}></div>
                                </div>
                                <div className="flex justify-between text-[10px] text-gray-500 dark:text-gray-400">
                                    <span>{planPercent}% от плана</span>
                                    <span>План: {financePlan.salesPlan.toLocaleString()}</span>
                                </div>
                            </>
                        )}
                    </div>
                    {totalReceivable > 0 && (
                        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 shadow-sm shrink-0">
                            <div className="flex justify-between items-start mb-1">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">ЗАДОЛЖЕННОСТИ</span>
                            </div>
                            <div className="text-lg font-bold text-amber-800 dark:text-amber-200">{totalReceivable.toLocaleString()} UZS</div>
                            <div className="text-[10px] text-amber-600 dark:text-amber-500">Ожидают оплаты</div>
                        </div>
                    )}
                </>
            )}
        </div>
      </div>
      </div>
    </ModulePageShell>
    </>
  );
};

export default HomeView;

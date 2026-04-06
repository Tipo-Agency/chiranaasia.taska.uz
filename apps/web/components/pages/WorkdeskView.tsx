import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Tabs } from '../ui/Tabs';
import { WeeklyPlansView, type WeeklyPlansViewHandle } from '../documents/WeeklyPlansView';
import { StatsCards } from '../features/home/StatsCards';
import {
  Calendar,
  CheckSquare,
  Briefcase,
  FileText,
  Network,
  X,
  Save,
  AlertCircle,
  CalendarClock,
  Layers,
  Megaphone,
  Zap,
} from 'lucide-react';
import { Deal, FinancePlan, Meeting, Task, User, Doc, BusinessProcess, SalesFunnel } from '../../types';
import { getDealDisplayTitle, isFunnelDeal } from '../../utils/dealModel';
import { ModuleCreateDropdown } from '../ui/ModuleCreateDropdown';
import { ModulePageHeader, ModulePageShell, MODULE_PAGE_GUTTER } from '../ui';
import { DateInput } from '../ui/DateInput';
import { normalizeDateForInput, parseLocalDate } from '../../utils/dateUtils';

type WorkdeskTab = 'dashboard' | 'weekly' | 'tasks' | 'deals' | 'meetings' | 'documents';

const TASK_DONE_STATUSES = ['Выполнено', 'Done', 'Завершено'];

const SOURCE_LABEL: Record<string, string> = {
  instagram: 'Instagram',
  telegram: 'Telegram',
  site: 'Сайт',
  manual: 'Вручную',
  recommendation: 'Рекомендация',
  vk: 'VK',
  unknown: 'Не указан',
};

function sourceLabel(s?: string): string {
  if (!s) return SOURCE_LABEL.unknown;
  return SOURCE_LABEL[s] || s;
}

function taskOverdue(t: Task): boolean {
  if (!t.endDate) return false;
  const end = new Date(t.endDate.length <= 10 ? `${t.endDate}T23:59:59` : t.endDate);
  return end < new Date();
}

/** Цвет воронки в настройках — Tailwind-классы вида bg-* dark:bg-* */
function FunnelDotLabel({ funnel, funnelId }: { funnel: SalesFunnel | undefined; funnelId?: string }) {
  const colorClass = funnel?.color?.trim() || 'bg-slate-400 dark:bg-slate-500';
  const name =
    funnel?.name?.trim() || (funnelId ? 'Воронка не найдена' : 'Без воронки');
  return (
    <div className="flex items-center gap-2 min-w-0 max-w-[200px]">
      <span
        className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 shadow-sm ring-1 ring-black/10 dark:ring-white/15 ${colorClass}`}
        title={name}
        aria-hidden
      />
      <span className="truncate text-gray-700 dark:text-gray-200" title={name}>
        {name}
      </span>
    </div>
  );
}

interface WorkdeskViewProps {
  currentUser: User;
  users: User[];
  tasks: Task[];
  deals: Deal[];
  meetings: Meeting[];
  docs: Doc[];
  financePlan?: FinancePlan | null;
  accountsReceivable?: { amount: number }[];
  /** Для названия и цвета воронки в таблице недавних сделок */
  salesFunnels?: SalesFunnel[];
  onOpenTask: (task: Task) => void;
  onNavigateToTasks: () => void;
  onNavigateToDeals: () => void;
  onNavigateToMeetings: () => void;
  onNavigateToDocuments?: () => void;
  workdeskTab: WorkdeskTab;
  onWorkdeskTabChange: (tab: WorkdeskTab) => void;
  meetingsSlot?: React.ReactNode;
  documentsSlot?: React.ReactNode;
  onOpenDocument?: (doc: Doc) => void;
  processTemplates?: BusinessProcess[];
  onStartProcessTemplate?: (processId: string) => Promise<{ id: string; label: string } | null> | { id: string; label: string } | null;
  onCreateEntity?: (type: 'task' | 'deal' | 'meeting' | 'doc', title: string) => Promise<{ id: string; label: string } | null> | { id: string; label: string } | null;
  onUpdateEntity?: (
    type: 'task' | 'deal' | 'meeting' | 'doc',
    id: string,
    patch: Record<string, unknown>
  ) => Promise<boolean> | boolean;
}

export const WorkdeskView: React.FC<WorkdeskViewProps> = ({
  currentUser,
  users,
  tasks,
  deals,
  meetings,
  docs,
  financePlan,
  accountsReceivable = [],
  salesFunnels = [],
  onOpenTask,
  onNavigateToTasks,
  onNavigateToDeals,
  onNavigateToMeetings,
  onNavigateToDocuments,
  workdeskTab,
  onWorkdeskTabChange,
  meetingsSlot,
  documentsSlot,
  onOpenDocument,
  processTemplates = [],
  onStartProcessTemplate,
  onCreateEntity,
  onUpdateEntity,
}) => {
  const activeTab = workdeskTab;
  const setActiveTab = onWorkdeskTabChange;
  const weeklyPlansRef = useRef<WeeklyPlansViewHandle>(null);
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);
  const [processPickerOpen, setProcessPickerOpen] = useState(false);

  const myTasks = useMemo(
    () =>
      tasks
        .filter(
          (t) =>
            !t.isArchived &&
            t.entityType !== 'idea' &&
            t.entityType !== 'feature' &&
            (t.assigneeId === currentUser.id || t.assigneeIds?.includes(currentUser.id))
        )
        .slice(0, 30),
    [tasks, currentUser.id]
  );

  const myDeals = useMemo(
    () => deals.filter((d) => !d.isArchived && d.assigneeId === currentUser.id).slice(0, 30),
    [deals, currentUser.id]
  );

  const myMeetings = useMemo(
    () => meetings.filter((m) => !m.isArchived && (m.participantIds || []).includes(currentUser.id)).slice(0, 30),
    [meetings, currentUser.id]
  );

  const tasksDone = useMemo(
    () =>
      tasks.filter(
        (t) =>
          !t.isArchived &&
          (t.assigneeId === currentUser.id || t.assigneeIds?.includes(currentUser.id)) &&
          TASK_DONE_STATUSES.includes(t.status)
      ).length,
    [tasks, currentUser.id]
  );
  const myOpenTasksCount = useMemo(
    () =>
      tasks.filter(
        (t) =>
          !t.isArchived &&
          t.entityType !== 'idea' &&
          t.entityType !== 'feature' &&
          (t.assigneeId === currentUser.id || t.assigneeIds?.includes(currentUser.id)) &&
          !TASK_DONE_STATUSES.includes(t.status)
      ).length,
    [tasks, currentUser.id]
  );
  const wonDealsAmount = useMemo(
    () =>
      deals
        .filter((d) => d.assigneeId === currentUser.id && d.stage === 'won')
        .reduce((sum, d) => sum + (d.amount || 0), 0),
    [deals, currentUser.id]
  );
  const meetingsThisWeek = useMemo(() => {
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    return myMeetings.filter((m) => {
      const key = m.date ? normalizeDateForInput(m.date) : '';
      if (!key) return false;
      const d = parseLocalDate(key);
      return d >= start && d < end;
    }).length;
  }, [myMeetings]);
  const tasksByDealId = useMemo(() => {
    const map = new Map<string, Task[]>();
    tasks
      .filter((t) => !t.isArchived && !!t.dealId)
      .forEach((t) => {
        const key = String(t.dealId);
        const arr = map.get(key) || [];
        arr.push(t);
        map.set(key, arr);
      });
    return map;
  }, [tasks]);
  const availableProcessTemplates = useMemo(
    () => processTemplates.filter((process) => !process.isArchived && !process.systemKey),
    [processTemplates]
  );

  const myFunnelDeals = useMemo(
    () =>
      deals.filter((d) => !d.isArchived && d.assigneeId === currentUser.id && isFunnelDeal(d)),
    [deals, currentUser.id]
  );

  const myPipelineDeals = useMemo(
    () => myFunnelDeals.filter((d) => d.stage !== 'won' && d.stage !== 'lost'),
    [myFunnelDeals]
  );

  const pipelineAmountSum = useMemo(
    () => myPipelineDeals.reduce((s, d) => s + (Number(d.amount) || 0), 0),
    [myPipelineDeals]
  );

  const stageBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    myPipelineDeals.forEach((d) => {
      const k = String(d.stage || '—');
      map.set(k, (map.get(k) || 0) + 1);
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [myPipelineDeals]);

  const sourceBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    myPipelineDeals.forEach((d) => {
      const k = d.source || 'unknown';
      map.set(k, (map.get(k) || 0) + 1);
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [myPipelineDeals]);

  const urgentTasks = useMemo(() => {
    const mine = tasks.filter(
      (t) =>
        !t.isArchived &&
        t.entityType !== 'idea' &&
        t.entityType !== 'feature' &&
        (t.assigneeId === currentUser.id || t.assigneeIds?.includes(currentUser.id)) &&
        !TASK_DONE_STATUSES.includes(t.status)
    );
    return [...mine]
      .sort((a, b) => {
        const ao = a.endDate ? new Date(a.endDate.length <= 10 ? `${a.endDate}T00:00:00` : a.endDate).getTime() : Number.POSITIVE_INFINITY;
        const bo = b.endDate ? new Date(b.endDate.length <= 10 ? `${b.endDate}T00:00:00` : b.endDate).getTime() : Number.POSITIVE_INFINITY;
        return ao - bo;
      })
      .slice(0, 6);
  }, [tasks, currentUser.id]);

  const recentFunnelDeals = useMemo(
    () =>
      [...myFunnelDeals]
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
        .slice(0, 8),
    [myFunnelDeals]
  );

  const upcomingMeetingsBoard = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const horizon = new Date(today);
    horizon.setDate(horizon.getDate() + 14);
    return myMeetings
      .filter((m) => {
        if (!m.date) return false;
        const d = new Date(`${m.date}T12:00:00`);
        return d >= today && d <= horizon;
      })
      .sort((a, b) => `${a.date}T${a.time || '00:00'}`.localeCompare(`${b.date}T${b.time || '00:00'}`))
      .slice(0, 6);
  }, [myMeetings]);

  const funnelById = useMemo(() => {
    const m = new Map<string, SalesFunnel>();
    (salesFunnels || []).forEach((f) => {
      if (f?.id) m.set(f.id, f);
    });
    return m;
  }, [salesFunnels]);


  return (
    <ModulePageShell>
      <div className={`${MODULE_PAGE_GUTTER} pt-6 md:pt-8 flex-shrink-0`}>
        <div className="mb-6">
          <ModulePageHeader
            accent="indigo"
            icon={<div />}
            title="Рабочий стол"
                tabs={
              <Tabs
                tabs={[
                  { id: 'dashboard', label: 'Дашборд' },
                  { id: 'weekly', label: 'Планы' },
                  { id: 'tasks', label: 'Задачи' },
                  { id: 'deals', label: 'Сделки' },
                  { id: 'meetings', label: 'Календарь' },
                  { id: 'documents', label: 'Документы' },
                ]}
                activeTab={activeTab}
                onChange={(id) => setActiveTab(id as WorkdeskTab)}
              />
            }
            controls={
              <ModuleCreateDropdown
                accent="indigo"
                label="Создать"
                items={[
                  {
                    id: 'create-task',
                    label: 'Новая задача',
                    icon: CheckSquare,
                    onClick: () => { void onCreateEntity?.('task', `Задача ${new Date().toLocaleTimeString('ru-RU')}`); },
                  },
                  {
                    id: 'create-deal',
                    label: 'Новая сделка',
                    icon: Briefcase,
                    onClick: () => { void onCreateEntity?.('deal', `Сделка ${new Date().toLocaleTimeString('ru-RU')}`); },
                  },
                  {
                    id: 'create-weekly-plan',
                    label: 'Недельный план',
                    icon: Calendar,
                    onClick: () => {
                      setActiveTab('weekly');
                      window.setTimeout(() => weeklyPlansRef.current?.openCreateModal(), 0);
                    },
                  },
                  {
                    id: 'create-meeting',
                    label: 'Новая встреча',
                    icon: Calendar,
                    onClick: () => { void onCreateEntity?.('meeting', `Встреча ${new Date().toLocaleTimeString('ru-RU')}`); },
                  },
                  {
                    id: 'create-doc',
                    label: 'Новый документ',
                    icon: FileText,
                    onClick: () => { void onCreateEntity?.('doc', `Документ ${new Date().toLocaleTimeString('ru-RU')}`); },
                  },
                  ...(availableProcessTemplates.length
                    ? [{
                        id: 'start-process',
                        label: 'Запустить бизнес-процесс',
                        icon: Network,
                        onClick: () => setProcessPickerOpen(true),
                      }]
                    : []),
                ]}
              />
            }
          />
          </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        <div className={`${MODULE_PAGE_GUTTER} mt-3 pb-24 md:pb-32 h-full overflow-y-auto overflow-x-hidden custom-scrollbar space-y-4`}>
          {activeTab === 'dashboard' && (
            <div className="space-y-4">
              <StatsCards
                deals={deals}
                financePlan={financePlan || null}
                tasks={tasks}
                currentUser={currentUser}
                accountsReceivable={accountsReceivable}
              />
              <div className="bg-white dark:bg-[#252525] rounded-2xl border border-gray-200 dark:border-[#333] p-4 space-y-3">
                <h3 className="font-semibold text-gray-900 dark:text-white">Сводка</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  <div className="rounded-xl border border-gray-200 dark:border-[#333] p-3">
                    <p className="text-gray-500">Открытые задачи</p>
                    <p className="font-semibold text-gray-900 dark:text-white">{myOpenTasksCount}</p>
                  </div>
                  <div className="rounded-xl border border-gray-200 dark:border-[#333] p-3">
                    <p className="text-gray-500">Закрытые задачи</p>
                    <p className="font-semibold text-gray-900 dark:text-white">{tasksDone}</p>
                  </div>
                  <div className="rounded-xl border border-gray-200 dark:border-[#333] p-3">
                    <p className="text-gray-500">Сделок в работе (CRM)</p>
                    <p className="font-semibold text-gray-900 dark:text-white">{myPipelineDeals.length}</p>
                  </div>
                  <div className="rounded-xl border border-gray-200 dark:border-[#333] p-3">
                    <p className="text-gray-500">Событий в календаре на неделе</p>
                    <p className="font-semibold text-gray-900 dark:text-white">{meetingsThisWeek}</p>
                  </div>
                </div>
                <div className="rounded-xl border border-indigo-200/60 dark:border-indigo-800/40 bg-indigo-50/50 dark:bg-indigo-950/20 px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="text-gray-600 dark:text-gray-300">
                    Сумма активных сделок в воронке (на вас)
                  </span>
                  <span className="font-semibold text-indigo-800 dark:text-indigo-200 tabular-nums">
                    {pipelineAmountSum.toLocaleString('ru-RU')} UZS
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Чат с коллегами и системная лента — кнопка «Чат» внизу справа на экране.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-white dark:bg-[#252525] rounded-2xl border border-gray-200 dark:border-[#333] p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <h3 className="font-semibold text-gray-900 dark:text-white">Воронка по этапам</h3>
                    <span className="text-xs text-gray-400 dark:text-gray-500">({myPipelineDeals.length} шт.)</span>
                  </div>
                  {stageBreakdown.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">Нет активных CRM-сделок на вас.</p>
                  ) : (
                    <ul className="space-y-2">
                      {stageBreakdown.map(([stage, n]) => (
                        <li key={stage} className="flex items-center justify-between gap-2 text-sm">
                          <span className="text-gray-700 dark:text-gray-200 truncate">{stage}</span>
                          <span className="shrink-0 font-semibold tabular-nums text-gray-900 dark:text-white">{n}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="bg-white dark:bg-[#252525] rounded-2xl border border-gray-200 dark:border-[#333] p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Megaphone className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <h3 className="font-semibold text-gray-900 dark:text-white">Источники лидов</h3>
                    <span className="text-xs text-gray-400 dark:text-gray-500">(активные сделки)</span>
                  </div>
                  {sourceBreakdown.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">Нет данных по источникам.</p>
                  ) : (
                    <ul className="space-y-2">
                      {sourceBreakdown.map(([src, n]) => (
                        <li key={src} className="flex items-center justify-between gap-2 text-sm">
                          <span className="text-gray-700 dark:text-gray-200">{sourceLabel(src)}</span>
                          <span className="shrink-0 font-semibold tabular-nums text-gray-900 dark:text-white">{n}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-white dark:bg-[#252525] rounded-2xl border border-gray-200 dark:border-[#333] p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      <h3 className="font-semibold text-gray-900 dark:text-white">Ближайшие дедлайны задач</h3>
                    </div>
                    <button
                      type="button"
                      onClick={onNavigateToTasks}
                      className="text-xs text-[#3337AD] hover:underline shrink-0"
                    >
                      Все задачи
                    </button>
                  </div>
                  {urgentTasks.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">Открытых задач нет.</p>
                  ) : (
                    <ul className="space-y-2">
                      {urgentTasks.map((t) => (
                        <li key={t.id}>
                          <button
                            type="button"
                            onClick={() => onOpenTask(t)}
                            className="w-full text-left rounded-xl border border-gray-200 dark:border-[#333] px-3 py-2 hover:bg-gray-50 dark:hover:bg-[#2a2a2a] transition-colors"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span className="text-sm font-medium text-gray-900 dark:text-white line-clamp-2">
                                {t.title || 'Без названия'}
                              </span>
                              {taskOverdue(t) ? (
                                <AlertCircle className="w-4 h-4 shrink-0 text-red-500" aria-hidden />
                              ) : null}
                            </div>
                            <div className="mt-1 text-[11px] text-gray-500 dark:text-gray-400 flex flex-wrap gap-x-2 gap-y-0.5">
                              <span>{t.priority || '—'}</span>
                              <span>·</span>
                              <span className={taskOverdue(t) ? 'text-red-600 dark:text-red-400 font-medium' : ''}>
                                до {t.endDate || '—'}
                              </span>
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="bg-white dark:bg-[#252525] rounded-2xl border border-gray-200 dark:border-[#333] p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <CalendarClock className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                      <h3 className="font-semibold text-gray-900 dark:text-white">Ближайшие события</h3>
                    </div>
                    <button
                      type="button"
                      onClick={onNavigateToMeetings}
                      className="text-xs text-[#3337AD] hover:underline shrink-0"
                    >
                      Календарь
                    </button>
                  </div>
                  {upcomingMeetingsBoard.length === 0 ? (
                    <p className="text-sm text-gray-500 dark:text-gray-400">Нет событий на ближайшие 2 недели.</p>
                  ) : (
                    <ul className="space-y-2">
                      {upcomingMeetingsBoard.map((m) => (
                        <li
                          key={m.id}
                          className="rounded-xl border border-gray-200 dark:border-[#333] px-3 py-2 text-sm"
                        >
                          <div className="font-medium text-gray-900 dark:text-white">{m.title || 'Встреча'}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {m.date || '—'} {m.time ? `· ${m.time}` : ''}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div className="bg-white dark:bg-[#252525] rounded-2xl border border-gray-200 dark:border-[#333] p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-green-600 dark:text-green-400" />
                    <h3 className="font-semibold text-gray-900 dark:text-white">Недавние сделки (CRM)</h3>
                  </div>
                  <button
                    type="button"
                    onClick={onNavigateToDeals}
                    className="text-xs text-[#3337AD] hover:underline"
                  >
                    Воронка
                  </button>
                </div>
                {recentFunnelDeals.length === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400">Нет сделок в воронке на вас.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead>
                        <tr className="text-[11px] uppercase text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-[#333]">
                          <th className="py-2 pr-2 font-medium">Сделка</th>
                          <th className="py-2 pr-2 font-medium">Воронка</th>
                          <th className="py-2 pr-2 font-medium">Этап</th>
                          <th className="py-2 pr-2 font-medium">Источник</th>
                          <th className="py-2 pr-2 font-medium text-right">Сумма</th>
                          <th className="py-2 font-medium">Создана</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentFunnelDeals.map((d) => (
                          <tr key={d.id} className="border-b border-gray-100 dark:border-[#333]/60">
                            <td className="py-2 pr-2 text-gray-900 dark:text-white max-w-[200px] truncate">
                              {getDealDisplayTitle(d)}
                            </td>
                            <td className="py-2 pr-2">
                              <FunnelDotLabel
                                funnelId={d.funnelId}
                                funnel={d.funnelId ? funnelById.get(d.funnelId) : undefined}
                              />
                            </td>
                            <td className="py-2 pr-2 text-gray-600 dark:text-gray-300">{d.stage || '—'}</td>
                            <td className="py-2 pr-2 text-gray-600 dark:text-gray-300">{sourceLabel(d.source)}</td>
                            <td className="py-2 pr-2 text-right tabular-nums text-gray-900 dark:text-white">
                              {(Number(d.amount) || 0).toLocaleString('ru-RU')} {d.currency || ''}
                            </td>
                            <td className="py-2 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                              {d.createdAt
                                ? new Date(d.createdAt).toLocaleDateString('ru-RU')
                                : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'weekly' && (
            <div className="bg-white dark:bg-[#252525] rounded-2xl border border-gray-200 dark:border-[#333] p-4">
              <WeeklyPlansView
                ref={weeklyPlansRef}
                currentUser={currentUser}
                tasks={tasks}
                onOpenTask={onOpenTask}
                onCreateTask={(title) => onCreateEntity ? onCreateEntity('task', title) : null}
                onUpdateTask={(taskId, updates) => {
                  void onUpdateEntity?.('task', taskId, updates as unknown as Record<string, unknown>);
                }}
                layout="embedded"
                hideEmbeddedToolbar
              />
            </div>
          )}

          {activeTab === 'tasks' && (
            <div className="bg-white dark:bg-[#252525] rounded-2xl border border-gray-200 dark:border-[#333] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 dark:text-white">Мои активные задачи</h3>
                <button type="button" onClick={onNavigateToTasks} className="text-sm text-[#3337AD] hover:underline">
                  Открыть модуль
                </button>
              </div>
              {myTasks.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">Нет задач.</p>
              ) : (
                <div className="space-y-3">
                  {myTasks.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => onOpenTask(t)}
                      className="w-full text-left rounded-xl border border-gray-200 dark:border-[#333] p-4 bg-white dark:bg-[#252525] hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-700 transition-all"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-sm text-gray-900 dark:text-white">{t.title || 'Без названия'}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {(t.priority || 'Средний')} · {(t.status || 'Без статуса')}
                          </div>
                          {t.description ? <div className="text-xs text-gray-500 dark:text-gray-400 mt-2 line-clamp-2">{t.description}</div> : null}
                        </div>
                        <div className="shrink-0 text-right">
                          <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 dark:bg-[#333] text-gray-700 dark:text-gray-300">
                            {t.status || 'Без статуса'}
                          </span>
                        </div>
                      </div>
                      <div className="mt-3 pt-2 border-t border-gray-100 dark:border-[#333] text-[11px] text-gray-500 dark:text-gray-400 flex items-center justify-between">
                        <span>{t.startDate || '—'} — {t.endDate || '—'}</span>
                        <span>{(t.assigneeIds && t.assigneeIds.length) || (t.assigneeId ? 1 : 0)} исп.</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'deals' && (
            <div className="bg-white dark:bg-[#252525] rounded-2xl border border-gray-200 dark:border-[#333] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 dark:text-white">Сделки</h3>
                <button type="button" onClick={onNavigateToDeals} className="text-sm text-[#3337AD] hover:underline">
                  Открыть модуль
                </button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                <div className="rounded-xl border border-gray-200 dark:border-[#333] p-2">
                  <p className="text-gray-500">Активные</p>
                  <p className="font-semibold text-gray-900 dark:text-white">{myDeals.filter((d) => d.stage !== 'won' && d.stage !== 'lost').length}</p>
                </div>
                <div className="rounded-xl border border-gray-200 dark:border-[#333] p-2">
                  <p className="text-gray-500">Won</p>
                  <p className="font-semibold text-gray-900 dark:text-white">{myDeals.filter((d) => d.stage === 'won').length}</p>
                </div>
                <div className="rounded-xl border border-gray-200 dark:border-[#333] p-2 col-span-2">
                  <p className="text-gray-500">Сумма выигранных</p>
                  <p className="font-semibold text-gray-900 dark:text-white">{wonDealsAmount.toLocaleString('ru-RU')} UZS</p>
                </div>
              </div>
              {myDeals.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">Нет сделок.</p>
              ) : (
                <div className="space-y-3">
                  {myDeals.map((d) => (
                    <div key={d.id} className="rounded-xl border border-gray-200 dark:border-[#333] p-4">
                      <div className="font-semibold text-sm text-gray-900 dark:text-white">{d.title || 'Сделка'}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {d.stage || 'Без этапа'} · {(d.amount || 0).toLocaleString('ru-RU')} {d.currency || ''}
                      </div>
                      <div className="mt-2">
                        <button
                          type="button"
                          onClick={() => setEditingDeal(d)}
                          className="text-xs text-[#3337AD] hover:underline"
                        >
                          Открыть карточку сделки
                        </button>
                      </div>
                      <div className="mt-3">
                        <div className="text-[11px] font-semibold uppercase text-gray-500 dark:text-gray-400 mb-1">Задачи по сделке</div>
                        {(tasksByDealId.get(d.id) || []).length === 0 ? (
                          <div className="text-xs text-gray-400">Нет задач по сделке</div>
                        ) : (
                          <div className="space-y-1">
                            {(tasksByDealId.get(d.id) || []).slice(0, 5).map((t) => (
                              <button key={t.id} type="button" onClick={() => onOpenTask(t)} className="w-full text-left text-xs rounded-lg border border-gray-100 dark:border-[#333] px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-[#2a2a2a]">
                                <span className="text-gray-800 dark:text-gray-200">{t.title || 'Без названия'}</span>
                                <span className="text-gray-500 dark:text-gray-400"> · {t.status || 'Без статуса'}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'meetings' && (
            <div className="rounded-2xl border border-gray-200 dark:border-[#333] overflow-hidden bg-white dark:bg-[#191919] min-h-[min(70vh,720px)] flex flex-col">
              {meetingsSlot ?? (
                <div className="p-4 text-sm text-gray-500 dark:text-gray-400">Календарь недоступен.</div>
              )}
            </div>
          )}

          {activeTab === 'documents' && (
            <div className="rounded-2xl border border-gray-200 dark:border-[#333] overflow-hidden bg-white dark:bg-[#191919] min-h-[min(70vh,720px)] flex flex-col">
              {documentsSlot ?? (
                <div className="p-4 text-sm text-gray-500 dark:text-gray-400">Документы недоступны.</div>
              )}
            </div>
          )}
        </div>
      </div>
      {editingDeal && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/50 dark:bg-black/70 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-gray-200 dark:border-[#333] bg-white dark:bg-[#1f1f1f] shadow-2xl">
            <div className="p-4 border-b border-gray-200 dark:border-[#333] flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-white">Сделка</h3>
              <button type="button" onClick={() => setEditingDeal(null)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-[#333]"><X size={18} /></button>
            </div>
            <div className="p-4 space-y-3">
              <input
                value={editingDeal.title || ''}
                onChange={(e) => setEditingDeal({ ...editingDeal, title: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-[#333] bg-white dark:bg-[#252525]"
                placeholder="Название сделки"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={String(editingDeal.amount || 0)}
                  onChange={(e) => setEditingDeal({ ...editingDeal, amount: Number(e.target.value || 0) })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-[#333] bg-white dark:bg-[#252525]"
                  placeholder="Сумма"
                />
                <input
                  value={editingDeal.currency || 'UZS'}
                  onChange={(e) => setEditingDeal({ ...editingDeal, currency: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-[#333] bg-white dark:bg-[#252525]"
                  placeholder="Валюта"
                />
              </div>
              <input
                value={editingDeal.stage || ''}
                onChange={(e) => setEditingDeal({ ...editingDeal, stage: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-[#333] bg-white dark:bg-[#252525]"
                placeholder="Этап"
              />
            </div>
            <div className="p-4 border-t border-gray-200 dark:border-[#333] flex justify-end gap-2">
              <button type="button" onClick={() => setEditingDeal(null)} className="px-4 py-2 rounded-lg border border-gray-200 dark:border-[#333] text-sm">Отмена</button>
              <button
                type="button"
                onClick={async () => {
                  const id = editingDeal.id;
                  const next = editingDeal;
                  setEditingDeal(null);
                  await onUpdateEntity?.('deal', id, next as unknown as Record<string, unknown>);
                }}
                className="px-4 py-2 rounded-lg bg-[#3337AD] text-white text-sm inline-flex items-center gap-2"
              >
                <Save size={14} /> Сохранить
              </button>
            </div>
          </div>
        </div>
      )}
      {editingMeeting && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/50 dark:bg-black/70 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-gray-200 dark:border-[#333] bg-white dark:bg-[#1f1f1f] shadow-2xl">
            <div className="p-4 border-b border-gray-200 dark:border-[#333] flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-white">Встреча</h3>
              <button type="button" onClick={() => setEditingMeeting(null)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-[#333]"><X size={18} /></button>
            </div>
            <div className="p-4 space-y-3">
              <input
                value={editingMeeting.title || ''}
                onChange={(e) => setEditingMeeting({ ...editingMeeting, title: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-[#333] bg-white dark:bg-[#252525]"
                placeholder="Название встречи"
              />
              <div className="grid grid-cols-2 gap-2">
                <DateInput value={editingMeeting.date || ''} onChange={(v) => setEditingMeeting({ ...editingMeeting, date: v })} />
                <input
                  value={editingMeeting.time || ''}
                  onChange={(e) => setEditingMeeting({ ...editingMeeting, time: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-[#333] bg-white dark:bg-[#252525]"
                  placeholder="10:00"
                />
              </div>
              <textarea
                value={editingMeeting.summary || ''}
                onChange={(e) => setEditingMeeting({ ...editingMeeting, summary: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-[#333] bg-white dark:bg-[#252525]"
                rows={3}
                placeholder="Описание"
              />
            </div>
            <div className="p-4 border-t border-gray-200 dark:border-[#333] flex justify-end gap-2">
              <button type="button" onClick={() => setEditingMeeting(null)} className="px-4 py-2 rounded-lg border border-gray-200 dark:border-[#333] text-sm">Отмена</button>
              <button
                type="button"
                onClick={async () => {
                  const id = editingMeeting.id;
                  const next = editingMeeting;
                  setEditingMeeting(null);
                  await onUpdateEntity?.('meeting', id, next as unknown as Record<string, unknown>);
                }}
                className="px-4 py-2 rounded-lg bg-[#3337AD] text-white text-sm inline-flex items-center gap-2"
              >
                <Save size={14} /> Сохранить
              </button>
            </div>
          </div>
        </div>
      )}
      {processPickerOpen && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/50 dark:bg-black/70 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-gray-200 dark:border-[#333] bg-white dark:bg-[#1f1f1f] shadow-2xl">
            <div className="p-4 border-b border-gray-200 dark:border-[#333] flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-white">Запуск бизнес-процесса</h3>
              <button type="button" onClick={() => setProcessPickerOpen(false)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-[#333]"><X size={18} /></button>
            </div>
            <div className="p-4 space-y-2 max-h-[60vh] overflow-y-auto custom-scrollbar">
              {availableProcessTemplates.map((process) => (
                <button
                  key={process.id}
                  type="button"
                  className="w-full text-left rounded-xl border border-gray-200 dark:border-[#333] px-3 py-2 hover:bg-gray-50 dark:hover:bg-[#252525]"
                  onClick={async () => {
                    await onStartProcessTemplate?.(process.id);
                    setProcessPickerOpen(false);
                  }}
                >
                  <div className="text-sm font-medium text-gray-900 dark:text-white">{process.name || 'Без названия'}</div>
                  {!!process.description && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{process.description}</div>
                  )}
                </button>
              ))}
              {!availableProcessTemplates.length && (
                <div className="text-sm text-gray-500 dark:text-gray-400">Нет доступных шаблонов бизнес-процессов.</div>
              )}
            </div>
            <div className="p-4 border-t border-gray-200 dark:border-[#333] flex justify-end">
              <button type="button" onClick={() => setProcessPickerOpen(false)} className="px-4 py-2 rounded-lg border border-gray-200 dark:border-[#333] text-sm">Закрыть</button>
            </div>
          </div>
        </div>
      )}
    </ModulePageShell>
  );
};


import React, { useMemo, useRef, useState } from 'react';
import { Tabs } from '../ui/Tabs';
import { MiniMessenger } from '../features/chat/MiniMessenger';
import { WeeklyPlansView, type WeeklyPlansViewHandle } from '../documents/WeeklyPlansView';
import { StatsCards } from '../features/home/StatsCards';
import { Calendar, CheckSquare, Briefcase, FileText, Network, X, Save } from 'lucide-react';
import { Deal, FinancePlan, Meeting, Task, User, Doc, BusinessProcess } from '../../types';
import { ModuleCreateDropdown } from '../ui/ModuleCreateDropdown';
import { ModulePageShell, MODULE_PAGE_GUTTER } from '../ui';
import { DateInput } from '../ui/DateInput';

type WorkdeskTab = 'chat' | 'weekly' | 'tasks' | 'deals' | 'meetings' | 'analytics';

interface WorkdeskViewProps {
  currentUser: User;
  users: User[];
  tasks: Task[];
  deals: Deal[];
  meetings: Meeting[];
  docs: Doc[];
  financePlan?: FinancePlan | null;
  accountsReceivable?: { amount: number }[];
  onOpenTask: (task: Task) => void;
  onNavigateToTasks: () => void;
  onNavigateToDeals: () => void;
  onNavigateToMeetings: () => void;
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
  onOpenTask,
  onNavigateToTasks,
  onNavigateToDeals,
  onNavigateToMeetings,
  onOpenDocument,
  processTemplates = [],
  onStartProcessTemplate,
  onCreateEntity,
  onUpdateEntity,
}) => {
  const [activeTab, setActiveTab] = useState<WorkdeskTab>('chat');
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
          ['Выполнено', 'Done', 'Завершено'].includes(t.status)
      ).length,
    [tasks, currentUser.id]
  );
  const tasksOpen = Math.max(myTasks.length - tasksDone, 0);
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
      const d = m.date ? new Date(`${m.date}T00:00:00`) : null;
      return d && d >= start && d < end;
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
  const meetingsByDate = useMemo(() => {
    const groups = new Map<string, Meeting[]>();
    myMeetings.forEach((m) => {
      const key = m.date || 'Без даты';
      const arr = groups.get(key) || [];
      arr.push(m);
      groups.set(key, arr);
    });
    return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [myMeetings]);
  const availableProcessTemplates = useMemo(
    () => processTemplates.filter((process) => !process.isArchived && !process.systemKey),
    [processTemplates]
  );

  return (
    <ModulePageShell>
      <div className={`${MODULE_PAGE_GUTTER} pt-6 md:pt-8 flex-shrink-0`}>
        <div className="mb-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Tabs
                tabs={[
                  { id: 'chat', label: 'Чат' },
                  { id: 'weekly', label: 'Недельные планы' },
                  { id: 'tasks', label: 'Задачи' },
                  { id: 'deals', label: 'Сделки' },
                  { id: 'meetings', label: 'Встречи' },
                  { id: 'analytics', label: 'Аналитика' },
                ]}
                activeTab={activeTab}
                onChange={(id) => setActiveTab(id as WorkdeskTab)}
              />
              <div className="flex items-center gap-2">
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
              </div>
            </div>
          </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        <div className={`${MODULE_PAGE_GUTTER} mt-3 pb-24 md:pb-32 h-full overflow-y-auto overflow-x-hidden custom-scrollbar space-y-4`}>
          {activeTab === 'chat' && (
            <div className="h-[min(74vh,780px)]">
              <MiniMessenger
                users={users}
                currentUser={currentUser}
                docs={docs}
                tasks={tasks}
                deals={deals}
                meetings={meetings}
                onOpenTask={onOpenTask}
                onOpenDeal={(deal) => setEditingDeal(deal)}
                onOpenMeeting={(meeting) => setEditingMeeting(meeting)}
                onOpenDeals={onNavigateToDeals}
                onOpenMeetings={onNavigateToMeetings}
                onOpenDocument={onOpenDocument}
                onCreateEntity={onCreateEntity}
                onUpdateEntity={onUpdateEntity}
                processTemplates={processTemplates}
                onStartProcessTemplate={onStartProcessTemplate}
              />
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
            <div className="bg-white dark:bg-[#252525] rounded-2xl border border-gray-200 dark:border-[#333] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 dark:text-white">Встречи</h3>
                <button type="button" onClick={onNavigateToMeetings} className="text-sm text-[#3337AD] hover:underline">
                  Открыть модуль
                </button>
              </div>
              <div className="rounded-xl border border-gray-200 dark:border-[#333] p-2 text-xs">
                <p className="text-gray-500">Встреч на этой неделе</p>
                <p className="font-semibold text-gray-900 dark:text-white">{meetingsThisWeek}</p>
              </div>
              {myMeetings.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">Нет встреч.</p>
              ) : (
                <div className="space-y-3">
                  {meetingsByDate.map(([date, list]) => (
                    <div key={date} className="rounded-xl border border-gray-200 dark:border-[#333]">
                      <div className="px-3 py-2 text-xs font-semibold bg-gray-50 dark:bg-[#2a2a2a] text-gray-700 dark:text-gray-300">{date}</div>
                      <div className="divide-y divide-gray-100 dark:divide-[#333]">
                        {list
                          .sort((a, b) => (a.time || '').localeCompare(b.time || ''))
                          .map((m) => (
                            <div key={m.id} className="px-3 py-2.5">
                              <div className="font-medium text-sm text-gray-900 dark:text-white">{m.title || 'Встреча'}</div>
                              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{m.time || '—'} · {(m.participantIds || []).length} участ.</div>
                              <button
                                type="button"
                                onClick={() => setEditingMeeting(m)}
                                className="mt-1 text-xs text-[#3337AD] hover:underline"
                              >
                                Открыть карточку встречи
                              </button>
                            </div>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'analytics' && (
            <div className="bg-white dark:bg-[#252525] rounded-2xl border border-gray-200 dark:border-[#333] p-4 space-y-4">
              <StatsCards
                deals={deals}
                financePlan={financePlan || null}
                tasks={tasks}
                currentUser={currentUser}
                accountsReceivable={accountsReceivable}
              />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                <div className="rounded-xl border border-gray-200 dark:border-[#333] p-3">
                  <p className="text-gray-500">Открытые задачи</p>
                  <p className="font-semibold text-gray-900 dark:text-white">{tasksOpen}</p>
                </div>
                <div className="rounded-xl border border-gray-200 dark:border-[#333] p-3">
                  <p className="text-gray-500">Закрытые задачи</p>
                  <p className="font-semibold text-gray-900 dark:text-white">{tasksDone}</p>
                </div>
                <div className="rounded-xl border border-gray-200 dark:border-[#333] p-3">
                  <p className="text-gray-500">Сделок в работе</p>
                  <p className="font-semibold text-gray-900 dark:text-white">{myDeals.filter((d) => d.stage !== 'won' && d.stage !== 'lost').length}</p>
                </div>
                <div className="rounded-xl border border-gray-200 dark:border-[#333] p-3">
                  <p className="text-gray-500">Встреч на неделе</p>
                  <p className="font-semibold text-gray-900 dark:text-white">{meetingsThisWeek}</p>
                </div>
              </div>
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


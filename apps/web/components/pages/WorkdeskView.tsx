import React, { useEffect, useMemo, useState } from 'react';
import { Tabs } from '../ui/Tabs';
import { PageLayout } from '../ui/PageLayout';
import { Container } from '../ui/Container';
import { MiniMessenger } from '../features/chat/MiniMessenger';
import { WeeklyPlansView } from '../documents/WeeklyPlansView';
import { StatsCards } from '../features/home/StatsCards';
import { Calendar, CheckSquare, Briefcase, BarChart3, MessageCircle } from 'lucide-react';
import { Deal, FinancePlan, Meeting, Task, User, Doc, BusinessProcess } from '../../types';

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

  useEffect(() => {
    const id = window.requestAnimationFrame(() => {
      const main = document.querySelector('main');
      if (main && 'scrollTop' in main) {
        (main as HTMLElement).scrollTop = 0;
      }
      window.scrollTo({ top: 0, behavior: 'auto' });
    });
    return () => window.cancelAnimationFrame(id);
  }, []);

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

  return (
    <PageLayout>
      {/* Внешний scroll дает `PageLayout` (main overflow-auto), поэтому не делаем вложенный scroll тут. */}
      <Container safeArea className="py-4">
        <div className="max-w-6xl mx-auto space-y-4">
          <div className="sticky top-0 z-20 py-1 bg-white/95 dark:bg-[#191919]/95 backdrop-blur">
            <Tabs
              tabs={[
                { id: 'chat', label: 'Чат', icon: <MessageCircle size={14} /> },
                { id: 'weekly', label: 'Недельные планы', icon: <Calendar size={14} /> },
                { id: 'tasks', label: 'Задачи', icon: <CheckSquare size={14} /> },
                { id: 'deals', label: 'Сделки', icon: <Briefcase size={14} /> },
                { id: 'meetings', label: 'Встречи', icon: <Calendar size={14} /> },
                { id: 'analytics', label: 'Аналитика', icon: <BarChart3 size={14} /> },
              ]}
              activeTab={activeTab}
              onChange={(id) => setActiveTab(id as WorkdeskTab)}
            />
          </div>

          {activeTab === 'chat' && (
            <div className="h-[min(74vh,780px)]">
              <MiniMessenger
                users={users}
                currentUser={currentUser}
                docs={docs}
                tasks={myTasks}
                deals={myDeals}
                meetings={myMeetings}
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
              <WeeklyPlansView currentUser={currentUser} tasks={tasks} onOpenTask={onOpenTask} layout="embedded" />
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {myTasks.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => onOpenTask(t)}
                      className="text-left rounded-xl border border-gray-200 dark:border-[#333] p-3 hover:bg-gray-50 dark:hover:bg-[#2a2a2a]"
                    >
                      <div className="font-medium text-sm text-gray-900 dark:text-white truncate">{t.title || 'Без названия'}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{t.status || 'Без статуса'}</div>
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {myDeals.map((d) => (
                    <div key={d.id} className="rounded-xl border border-gray-200 dark:border-[#333] p-3">
                      <div className="font-medium text-sm text-gray-900 dark:text-white truncate">{d.title || 'Сделка'}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {d.stage || 'Без этапа'} · {(d.amount || 0).toLocaleString('ru-RU')} {d.currency || ''}
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {myMeetings.map((m) => (
                    <div key={m.id} className="rounded-xl border border-gray-200 dark:border-[#333] p-3">
                      <div className="font-medium text-sm text-gray-900 dark:text-white truncate">{m.title || 'Встреча'}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {m.date || ''} {m.time || ''}
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
      </Container>
    </PageLayout>
  );
};


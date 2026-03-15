/**
 * HomePage — «Рабочий стол»:
 * приветствие, Входящие/Исходящие/Сообщения (табы как в других модулях), контент в табах, метрики, недельный план.
 */
import React, { useState, useMemo } from 'react';
import {
  Task,
  User,
  Meeting,
  FinancePlan,
  PurchaseRequest,
  Deal,
  Client,
  EmployeeInfo,
  Project,
  StatusOption,
  PriorityOption,
  InboxMessage,
  MessageAttachment,
  Doc,
  Department,
} from '../../types';
import {
  HomeHeader,
  StatsCards,
  BirthdayModal,
} from '../features/home';
import { TaskCard } from '../features/tasks/TaskCard';
import { Card } from '../ui/Card';
import { Container } from '../ui/Container';
import { PageLayout } from '../ui/PageLayout';
import { Tabs } from '../ui/Tabs';
import { MiniMessenger } from '../features/chat/MiniMessenger';
import { getTodayLocalDate } from '../../utils/dateUtils';
import { CheckSquare, Briefcase, ArrowRight } from 'lucide-react';

type InboxTab = 'incoming' | 'outgoing' | 'messages';

function formatWeekLabel(weekStart: string): string {
  const d = new Date(weekStart + 'T12:00:00');
  const end = new Date(d);
  end.setDate(end.getDate() + 6);
  return `${d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} – ${end.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

interface HomePageProps {
  currentUser: User;
  tasks: Task[];
  recentActivity: unknown[];
  meetings?: Meeting[];
  financePlan?: FinancePlan | null;
  purchaseRequests?: PurchaseRequest[];
  deals?: Deal[];
  clients?: Client[];
  employeeInfos?: EmployeeInfo[];
  accountsReceivable?: { amount: number }[];
  users: User[];
  projects: Project[];
  statuses: StatusOption[];
  priorities: PriorityOption[];
  docs?: Doc[];
  departments?: Department[];
  inboxMessages?: InboxMessage[];
  outboxMessages?: InboxMessage[];
  onOpenTask: (task: Task) => void;
  onNavigateToInbox: () => void;
  onQuickCreateTask: () => void;
  onQuickCreateProcess: () => void;
  onQuickCreateDeal: () => void;
  onNavigateToTasks: () => void;
  onNavigateToMeetings: () => void;
  onNavigateToDeals?: () => void;
  onNavigateToDocs?: () => void;
  onSendMessage?: (payload: { text: string; attachments?: MessageAttachment[]; recipientId?: string | null }) => void;
  onLoadMessages?: () => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  currentUser,
  tasks,
  meetings = [],
  financePlan,
  purchaseRequests = [],
  deals = [],
  clients = [],
  employeeInfos = [],
  accountsReceivable = [],
  users,
  projects,
  statuses,
  priorities,
  docs = [],
  departments = [],
  inboxMessages = [],
  outboxMessages = [],
  onOpenTask,
  onNavigateToInbox,
  onQuickCreateTask,
  onQuickCreateProcess,
  onQuickCreateDeal,
  onNavigateToTasks,
  onNavigateToMeetings,
  onNavigateToDeals,
  onNavigateToDocs,
  onSendMessage,
}) => {
  const [showBirthdayModal, setShowBirthdayModal] = useState(false);
  const [inboxTab, setInboxTab] = useState<InboxTab>('incoming');
  const [latestWeeklyPlan, setLatestWeeklyPlan] = useState<{ weekStart: string; taskCount: number } | null>(null);

  React.useEffect(() => {
    if (!currentUser?.id) return;
    import('../../backend/api').then(({ api }) => {
      api.weeklyPlans.getMyLatest(currentUser.id).then((plan) => {
        if (plan) setLatestWeeklyPlan({ weekStart: plan.weekStart, taskCount: (plan.taskIds || []).length });
        else setLatestWeeklyPlan(null);
      }).catch(() => setLatestWeeklyPlan(null));
    });
  }, [currentUser?.id]);

  React.useEffect(() => {
    const info = employeeInfos.find((e) => e.userId === currentUser?.id);
    if (info?.birthDate) {
      const birthDate = new Date(info.birthDate);
      const today = new Date();
      if (birthDate.getMonth() === today.getMonth() && birthDate.getDate() === today.getDate()) {
        const todayStr = getTodayLocalDate();
        if (!localStorage.getItem(`birthday_${currentUser.id}_${todayStr}`)) {
          setShowBirthdayModal(true);
          localStorage.setItem(`birthday_${currentUser.id}_${todayStr}`, 'true');
        }
      }
    }
  }, [currentUser?.id, employeeInfos]);

  const myTasks = useMemo(() => {
    const list = (tasks || []).filter(
      (t) =>
        t &&
        t.entityType !== 'idea' &&
        t.entityType !== 'feature' &&
        !t.isArchived &&
        !['Выполнено', 'Done', 'Завершено'].includes(t.status) &&
        (t.assigneeId === currentUser?.id || t.assigneeIds?.includes(currentUser?.id))
    );
    return [...list].sort((a, b) => {
      const da = (a.updatedAt || a.createdAt || '').replace('Z', '');
      const db = (b.updatedAt || b.createdAt || '').replace('Z', '');
      return db.localeCompare(da);
    });
  }, [tasks, currentUser?.id]);

  const myDeals = useMemo(() => {
    const list = (deals || []).filter((d) => d && !d.isArchived && d.assigneeId === currentUser?.id);
    return [...list].sort((a, b) => {
      const da = (a.updatedAt || a.createdAt || '').replace('Z', '');
      const db = (b.updatedAt || b.createdAt || '').replace('Z', '');
      return db.localeCompare(da);
    });
  }, [deals, currentUser?.id]);

  const outgoingTasks = useMemo(() => {
    const list = (tasks || []).filter(
      (t) =>
        t &&
        t.createdByUserId === currentUser?.id &&
        !t.isArchived &&
        t.assigneeId &&
        t.assigneeId !== currentUser?.id
    );
    return [...list].sort((a, b) => {
      const da = (a.updatedAt || a.createdAt || '').replace('Z', '');
      const db = (b.updatedAt || b.createdAt || '').replace('Z', '');
      return db.localeCompare(da);
    });
  }, [tasks, currentUser?.id]);

  if (!currentUser) {
    return (
      <PageLayout>
        <Container>
          <div className="p-10 text-center text-gray-500 dark:text-gray-400">Пользователь не найден</div>
        </Container>
      </PageLayout>
    );
  }

  return (
    <>
      <BirthdayModal isOpen={showBirthdayModal} onClose={() => setShowBirthdayModal(false)} user={currentUser} />

      <PageLayout>
        <Container safeArea className="py-4 pb-24 md:pb-32 overflow-y-auto">
          <div className="max-w-5xl mx-auto space-y-4">
            <HomeHeader
              user={currentUser}
              onQuickCreateTask={onQuickCreateTask}
              onQuickCreateDeal={onQuickCreateDeal}
              onQuickCreateProcess={onQuickCreateProcess}
            />

            {/* Входящие / Исходящие / Сообщения — табы как в других модулях */}
            <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-2xl shadow-sm overflow-hidden">
              <div className="px-4 pt-4 pb-2">
                <Tabs
                  tabs={[
                    { id: 'incoming', label: `Входящие${myTasks.length + myDeals.length > 0 ? ` (${myTasks.length + myDeals.length})` : ''}` },
                    { id: 'outgoing', label: `Исходящие${outgoingTasks.length > 0 ? ` (${outgoingTasks.length})` : ''}` },
                    { id: 'messages', label: 'Сообщения' },
                  ]}
                  activeTab={inboxTab}
                  onChange={(id) => setInboxTab(id as InboxTab)}
                />
              </div>
              <div className="px-4 pb-4 min-h-[200px]">
                {inboxTab === 'incoming' && (
                  <div className="space-y-4">
                    {myTasks.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                            <CheckSquare size={16} /> Задачи мне
                          </h3>
                          {onNavigateToTasks && (
                            <button type="button" onClick={onNavigateToTasks} className="text-xs text-[#3337AD] hover:underline flex items-center gap-0.5">
                              Все <ArrowRight size={12} />
                            </button>
                          )}
                        </div>
                        <div className="space-y-2">
                          {myTasks.slice(0, 5).map((t) => (
                            <div key={t.id} onClick={() => onOpenTask(t)} className="cursor-pointer">
                              <TaskCard task={t} users={users} projects={projects} statuses={statuses} priorities={priorities} onClick={() => onOpenTask(t)} />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {myDeals.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                            <Briefcase size={16} /> Сделки мне
                          </h3>
                          {onNavigateToDeals && (
                            <button type="button" onClick={onNavigateToDeals} className="text-xs text-[#3337AD] hover:underline flex items-center gap-0.5">
                              Все <ArrowRight size={12} />
                            </button>
                          )}
                        </div>
                        <div className="space-y-2">
                          {myDeals.slice(0, 5).map((d) => {
                            const client = clients.find((c) => c.id === d.clientId);
                            const title = d.title || client?.name || d.contactName || 'Сделка';
                            return (
                              <Card
                                key={d.id}
                                className="p-4 cursor-pointer hover:shadow-md active:scale-[0.98] transition-all min-h-[72px]"
                                onClick={() => onNavigateToDeals?.()}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <h3 className="font-semibold text-gray-900 dark:text-white text-sm truncate">
                                      {title}
                                    </h3>
                                    <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                                      <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-[#333] text-gray-700 dark:text-gray-300">
                                        {d.stage}
                                      </span>
                                      {d.amount != null && (
                                        <span>{d.amount.toLocaleString('ru-RU')} {d.currency || ''}</span>
                                      )}
                                    </div>
                                  </div>
                                  <Briefcase className="shrink-0 w-4 h-4 text-gray-400 dark:text-gray-500" />
                                </div>
                              </Card>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {myTasks.length === 0 && myDeals.length === 0 && (
                      <p className="text-sm text-gray-500 dark:text-gray-400">Нет входящих задач и сделок.</p>
                    )}
                  </div>
                )}
                {inboxTab === 'outgoing' && (
                  <div className="space-y-4">
                    {outgoingTasks.length > 0 ? (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                            <CheckSquare size={16} /> Задачи, которые я поставил
                          </h3>
                          {onNavigateToTasks && (
                            <button type="button" onClick={onNavigateToTasks} className="text-xs text-[#3337AD] hover:underline flex items-center gap-0.5">
                              Все <ArrowRight size={12} />
                            </button>
                          )}
                        </div>
                        <div className="space-y-2">
                          {outgoingTasks.slice(0, 5).map((t) => (
                            <div key={t.id} onClick={() => onOpenTask(t)} className="cursor-pointer">
                              <TaskCard task={t} users={users} projects={projects} statuses={statuses} priorities={priorities} onClick={() => onOpenTask(t)} />
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 dark:text-gray-400">Нет исходящих задач.</p>
                    )}
                  </div>
                )}
                {inboxTab === 'messages' && (
                  <div className="h-[320px] -mx-4">
                    <MiniMessenger users={users} currentUser={currentUser} />
                  </div>
                )}
              </div>
            </div>

            {/* Последний недельный план */}
            {onNavigateToDocs && (
              <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-2xl shadow-sm p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">Мой недельный план</h3>
                    {latestWeeklyPlan ? (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                        {formatWeekLabel(latestWeeklyPlan.weekStart)} · {latestWeeklyPlan.taskCount} задач
                      </p>
                    ) : (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">План на неделю не создан</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={onNavigateToDocs}
                    className="px-4 py-2 rounded-lg bg-[#3337AD] text-white text-sm font-medium hover:bg-[#292b8a]"
                  >
                    {latestWeeklyPlan ? 'Открыть' : 'Создать'}
                  </button>
                </div>
              </div>
            )}

            {/* Метрики */}
            <StatsCards
              deals={deals}
              financePlan={financePlan}
              tasks={tasks}
              currentUser={currentUser}
              accountsReceivable={accountsReceivable}
            />
          </div>
        </Container>
      </PageLayout>
    </>
  );
};


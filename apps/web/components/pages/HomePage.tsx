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
import { Card } from '../ui/Card';
import { Container } from '../ui/Container';
import { PageLayout } from '../ui/PageLayout';
import { Tabs } from '../ui/Tabs';
import { MiniMessenger } from '../features/chat/MiniMessenger';
import { getTodayLocalDate, formatDate } from '../../utils/dateUtils';
import { CheckSquare, Briefcase, ArrowRight, Calendar, User as UserIcon, FileText } from 'lucide-react';
import { WeeklyPlansModal, ProtocolsModal } from '../documents/PlanningModals';

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
  /** Открыть документ из чата (редактор / ссылка) */
  onOpenDocument?: (doc: Doc) => void;
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
  onOpenDocument,
  onSendMessage,
}) => {
  const [showBirthdayModal, setShowBirthdayModal] = useState(false);
  const [inboxTab, setInboxTab] = useState<InboxTab>('incoming');
  const [latestWeeklyPlan, setLatestWeeklyPlan] = useState<{ weekStart: string; taskCount: number } | null>(null);
  const [weeklyPlansModalOpen, setWeeklyPlansModalOpen] = useState(false);
  const [protocolsModalOpen, setProtocolsModalOpen] = useState(false);

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

            {/* Табы над «рабочим пространством» (карточка только контент) */}
            <div className="mb-2">
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

            <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-2xl shadow-sm overflow-hidden">
              <div className="px-4 py-4 min-h-[200px]">
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
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {myTasks.slice(0, 10).map((t) => {
                            const project = projects.find((p) => p.id === t.projectId);
                            const assignee = users.find((u) => u.id === t.assigneeId);
                            const status = statuses.find((s) => s.value === t.status);
                            const priority = priorities.find((p) => p.value === t.priority);
                            const isOverdue = t.endDate && new Date(t.endDate) < new Date() && t.status !== 'Выполнено';
                            return (
                              <Card
                                key={t.id}
                                className={`p-2.5 cursor-pointer hover:shadow-md active:scale-[0.99] transition-all border-l-2 ${isOverdue ? 'border-l-red-500' : 'border-l-transparent'}`}
                                onClick={() => onOpenTask(t)}
                              >
                                <div className="font-medium text-gray-900 dark:text-white text-sm truncate">{t.title || 'Без названия'}</div>
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-xs text-gray-500 dark:text-gray-400">
                                  {status && <span className="truncate">{status.name}</span>}
                                  {project && <span className="truncate max-w-[100px]" title={project.name}>{project.name}</span>}
                                  {t.endDate && (
                                    <span className={`flex items-center gap-0.5 ${isOverdue ? 'text-red-600 dark:text-red-400' : ''}`}>
                                      <Calendar size={10} /> {formatDate(t.endDate)}
                                    </span>
                                  )}
                                  {priority && <span>{priority.name}</span>}
                                  {assignee && <span className="flex items-center gap-0.5 truncate max-w-[80px]" title={assignee.name}><UserIcon size={10} /> {assignee.name.split(' ')[0]}</span>}
                                </div>
                              </Card>
                            );
                          })}
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
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {myDeals.slice(0, 10).map((d) => {
                            const client = clients.find((c) => c.id === d.clientId);
                            const title = d.title || client?.name || d.contactName || 'Сделка';
                            return (
                              <Card
                                key={d.id}
                                className="p-2.5 cursor-pointer hover:shadow-md active:scale-[0.99] transition-all"
                                onClick={() => onNavigateToDeals?.()}
                              >
                                <div className="font-medium text-gray-900 dark:text-white text-sm truncate">{title}</div>
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-xs text-gray-500 dark:text-gray-400">
                                  <span className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-[#333] text-gray-700 dark:text-gray-300 truncate max-w-[120px]" title={d.stage}>{d.stage}</span>
                                  {d.amount != null && <span>{d.amount.toLocaleString('ru-RU')} {d.currency || ''}</span>}
                                  {client?.name && <span className="truncate max-w-[90px]" title={client.name}>{client.name}</span>}
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
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {outgoingTasks.slice(0, 10).map((t) => {
                            const project = projects.find((p) => p.id === t.projectId);
                            const assignee = users.find((u) => u.id === t.assigneeId);
                            const status = statuses.find((s) => s.value === t.status);
                            const isOverdue = t.endDate && new Date(t.endDate) < new Date() && t.status !== 'Выполнено';
                            return (
                              <Card
                                key={t.id}
                                className={`p-2.5 cursor-pointer hover:shadow-md active:scale-[0.99] transition-all border-l-2 ${isOverdue ? 'border-l-red-500' : 'border-l-transparent'}`}
                                onClick={() => onOpenTask(t)}
                              >
                                <div className="font-medium text-gray-900 dark:text-white text-sm truncate">{t.title || 'Без названия'}</div>
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-xs text-gray-500 dark:text-gray-400">
                                  {status && <span className="truncate">{status.name}</span>}
                                  {project && <span className="truncate max-w-[100px]" title={project.name}>{project.name}</span>}
                                  {t.endDate && (
                                    <span className={`flex items-center gap-0.5 ${isOverdue ? 'text-red-600 dark:text-red-400' : ''}`}>
                                      <Calendar size={10} /> {formatDate(t.endDate)}
                                    </span>
                                  )}
                                  {assignee && <span className="truncate max-w-[80px]" title={assignee.name}>→ {assignee.name.split(' ')[0]}</span>}
                                </div>
                              </Card>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 dark:text-gray-400">Нет исходящих задач.</p>
                    )}
                  </div>
                )}
                {inboxTab === 'messages' && (
                  <div className="h-[320px] -mx-4">
                    <MiniMessenger
                      users={users}
                      currentUser={currentUser}
                      docs={docs}
                      onOpenDocument={onOpenDocument}
                      onOpenDocumentsModule={onNavigateToDocs}
                      onCreateTask={onQuickCreateTask}
                      onStartProcess={onQuickCreateProcess}
                      onOpenDeals={onNavigateToDeals}
                      onOpenMeetings={onNavigateToMeetings}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Недельный план и протоколы — в тех же модалках, что в «Документах» */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-2xl shadow-sm p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#3337AD]/10 text-[#3337AD]">
                    <Calendar size={20} strokeWidth={2} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-gray-900 dark:text-white">Мой недельный план</h3>
                    {latestWeeklyPlan ? (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                        {formatWeekLabel(latestWeeklyPlan.weekStart)} · {latestWeeklyPlan.taskCount} задач
                      </p>
                    ) : (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">План на неделю не создан</p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setWeeklyPlansModalOpen(true)}
                  className="shrink-0 px-4 py-2.5 rounded-xl bg-[#3337AD] text-white text-sm font-semibold hover:bg-[#292b8a] transition-colors w-full sm:w-auto"
                >
                  {latestWeeklyPlan ? 'Открыть план' : 'Создать план'}
                </button>
              </div>
              <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-2xl shadow-sm p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-950/50 text-violet-700 dark:text-violet-300">
                    <FileText size={20} strokeWidth={2} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-gray-900 dark:text-white">Протоколы</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                      Итоги по неделям и задачи из протоколов
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setProtocolsModalOpen(true)}
                  className="shrink-0 px-4 py-2.5 rounded-xl border border-violet-300/70 dark:border-violet-700 dark:bg-violet-950/30 text-violet-800 dark:text-violet-200 text-sm font-semibold hover:bg-violet-50 dark:hover:bg-violet-950/50 transition-colors w-full sm:w-auto"
                >
                  Открыть
                </button>
              </div>
            </div>

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
      <WeeklyPlansModal
        isOpen={weeklyPlansModalOpen}
        onClose={() => setWeeklyPlansModalOpen(false)}
        currentUser={currentUser}
        tasks={tasks}
        onOpenTask={onOpenTask}
      />
      <ProtocolsModal
        isOpen={protocolsModalOpen}
        onClose={() => setProtocolsModalOpen(false)}
        users={users}
        tasks={tasks}
        onOpenTask={onOpenTask}
      />
    </>
  );
};


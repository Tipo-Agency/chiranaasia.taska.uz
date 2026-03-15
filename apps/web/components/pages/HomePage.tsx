/**
 * HomePage — «Рабочий стол»:
 * приветствие, кнопка «Создать» и блок «Входящие / Исходящие / Сообщения» + обзор задач/сделок/встреч.
 */
import React, { useState } from 'react';
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
  MyTasksSection,
  UpcomingMeetings,
  NewDealsSection,
  StatsCards,
  BirthdayModal,
} from '../features/home';
import { Container } from '../ui/Container';
import { PageLayout } from '../ui/PageLayout';
import { getTodayLocalDate } from '../../utils/dateUtils';

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

  const myTasks = (tasks || []).filter(
    (t) =>
      t &&
      t.entityType !== 'idea' &&
      t.entityType !== 'feature' &&
      !t.isArchived &&
      !['Выполнено', 'Done', 'Завершено'].includes(t.status) &&
      (t.assigneeId === currentUser?.id || t.assigneeIds?.includes(currentUser?.id))
  );

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

            {/* Карточка «Входящие / Исходящие / Сообщения» */}
            <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-2xl shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 px-4 pt-4 border-b border-gray-100 dark:border-[#333]">
                <button
                  type="button"
                  onClick={() => setInboxTab('incoming')}
                  className={`px-4 py-2 rounded-full text-sm font-medium ${
                    inboxTab === 'incoming'
                      ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                      : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  Входящие
                </button>
                <button
                  type="button"
                  onClick={() => setInboxTab('outgoing')}
                  className={`px-4 py-2 rounded-full text-sm font-medium ${
                    inboxTab === 'outgoing'
                      ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                      : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  Исходящие
                </button>
                <button
                  type="button"
                  onClick={() => setInboxTab('messages')}
                  className={`px-4 py-2 rounded-full text-sm font-medium ${
                    inboxTab === 'messages'
                      ? 'bg-gray-900 text-white dark:bg.white dark:text-gray-900'
                      : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  Сообщения
                </button>
              </div>
              <div className="px-4 py-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text.white mb-2">
                  {inboxTab === 'incoming'
                    ? 'Входящие'
                    : inboxTab === 'outgoing'
                    ? 'Исходящие'
                    : 'Сообщения'}
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {inboxTab === 'incoming'
                    ? 'Нет входящих сущностей'
                    : inboxTab === 'outgoing'
                    ? 'Нет исходящих сущностей'
                    : 'Нет сообщений'}
                </p>
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

            {/* Обзор: метрики, задачи, сделки, встречи */}
            <StatsCards
              deals={deals}
              financePlan={financePlan}
              tasks={tasks}
              currentUser={currentUser}
              accountsReceivable={accountsReceivable}
            />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <MyTasksSection
                tasks={myTasks}
                users={users}
                projects={projects}
                statuses={statuses}
                priorities={priorities}
                onOpenTask={onOpenTask}
                onViewAll={onNavigateToTasks}
              />
              <div className="space-y-4">
                <NewDealsSection
                  deals={deals}
                  clients={clients}
                  users={users}
                  onViewAll={onNavigateToDeals || (() => {})}
                />
                <UpcomingMeetings meetings={meetings} users={users} onViewAll={onNavigateToMeetings} />
              </div>
            </div>
          </div>
        </Container>
      </PageLayout>
    </>
  );
};


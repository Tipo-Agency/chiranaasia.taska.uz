/**
 * HomePage - главная страница (рефакторенная версия)
 * 
 * Зачем отдельно:
 * - Только композиция компонентов
 * - Не содержит бизнес-логику
 * - Использует переиспользуемые компоненты
 */
import React, { useState, useEffect } from 'react';
import {
  Task,
  User,
  ActivityLog,
  Meeting,
  FinancePlan,
  PurchaseRequest,
  Deal,
  Client,
  ContentPost,
  EmployeeInfo,
  Project,
  StatusOption,
  PriorityOption,
  Role,
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

interface HomePageProps {
  currentUser: User;
  tasks: Task[];
  recentActivity: ActivityLog[];
  meetings?: Meeting[];
  financePlan?: FinancePlan | null;
  purchaseRequests?: PurchaseRequest[];
  deals?: Deal[];
  clients?: Client[];
  contentPosts?: ContentPost[];
  employeeInfos?: EmployeeInfo[];
  accountsReceivable?: { amount: number }[];
  users: User[];
  projects: Project[];
  statuses: StatusOption[];
  priorities: PriorityOption[];
  onOpenTask: (task: Task) => void;
  onNavigateToInbox: () => void;
  onQuickCreateTask: () => void;
  onQuickCreateProcess: () => void;
  onQuickCreateDeal: () => void;
  onNavigateToTasks: () => void;
  onNavigateToMeetings: () => void;
  onNavigateToDeals?: () => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  currentUser,
  tasks,
  recentActivity,
  meetings = [],
  financePlan,
  purchaseRequests = [],
  deals = [],
  clients = [],
  contentPosts = [],
  employeeInfos = [],
  accountsReceivable = [],
  users,
  projects,
  statuses,
  priorities,
  onOpenTask,
  onNavigateToInbox,
  onQuickCreateTask,
  onQuickCreateProcess,
  onQuickCreateDeal,
  onNavigateToTasks,
  onNavigateToMeetings,
  onNavigateToDeals,
}) => {
  const [showBirthdayModal, setShowBirthdayModal] = useState(false);

  // Проверка дня рождения
  useEffect(() => {
    const employeeInfo = employeeInfos.find(e => e.userId === currentUser?.id);
    if (employeeInfo?.birthDate) {
      const birthDate = new Date(employeeInfo.birthDate);
      const today = new Date();
      const isBirthday =
        birthDate.getMonth() === today.getMonth() &&
        birthDate.getDate() === today.getDate();

      if (isBirthday) {
        const todayStr = getTodayLocalDate();
        const lastShown = localStorage.getItem(`birthday_${currentUser.id}_${todayStr}`);
        if (!lastShown) {
          setShowBirthdayModal(true);
          localStorage.setItem(`birthday_${currentUser.id}_${todayStr}`, 'true');
        }
      }
    }
  }, [currentUser?.id, employeeInfos]);

  // Фильтрация задач пользователя
  const myTasks = (tasks || []).filter(
    t =>
      t &&
      t.entityType !== 'idea' &&
      t.entityType !== 'feature' &&
      !t.isArchived &&
      !['Выполнено', 'Done', 'Завершено'].includes(t.status) &&
      (t.assigneeId === currentUser?.id || t.assigneeIds?.includes(currentUser?.id))
  );

  // Агрегированные счётчики для центра коммуникаций
  const incomingRequests =
    currentUser.role === Role.ADMIN
      ? (purchaseRequests || []).filter(r => r && r.status === 'pending').length
      : 0;

  const incomingDeals = (deals || []).filter(
    d => d && d.assigneeId === currentUser.id && !d.isArchived
  ).length;

  const outgoingTasks = (tasks || []).filter(
    t =>
      t &&
      t.createdByUserId === currentUser.id &&
      !t.isArchived &&
      t.assigneeId &&
      t.assigneeId !== currentUser.id
  ).length;

  const outgoingRequests = (purchaseRequests || []).filter(
    r => r && r.requesterId === currentUser.id
  ).length;

  const unreadNotifications = (recentActivity || []).filter(a => !a.read).length;
  const incomingTotal = myTasks.length + incomingRequests + incomingDeals;
  const outgoingTotal = outgoingTasks + outgoingRequests;

  if (!currentUser) {
    return (
      <PageLayout>
        <Container>
          <div className="p-10 text-center text-gray-500 dark:text-gray-400">
            Пользователь не найден
          </div>
        </Container>
      </PageLayout>
    );
  }

  return (
    <>
      <BirthdayModal
        isOpen={showBirthdayModal}
        onClose={() => setShowBirthdayModal(false)}
        user={currentUser}
      />

      <PageLayout>
        <Container safeArea className="py-6 overflow-y-auto">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Header: приветствие слева, быстрые действия справа */}
            <HomeHeader
              user={currentUser}
              onQuickCreateTask={onQuickCreateTask}
              onQuickCreateDeal={onQuickCreateDeal}
              onQuickCreateProcess={onQuickCreateProcess}
            />

            {/* Stats Cards: задачи, сделки, выручка, план, задолженности */}
            <StatsCards
              deals={deals}
              financePlan={financePlan}
              tasks={tasks}
              currentUser={currentUser}
              accountsReceivable={accountsReceivable}
            />

            {/* Мини-дашборд по коммуникациям + переход в центр коммуникаций */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-xl p-4 flex flex-col justify-between">
                <div>
                  <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">
                    Входящие
                  </div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                    {incomingTotal}
                  </div>
                  <div className="text-[11px] text-gray-500 dark:text-gray-400">
                    Задачи, заявки и сделки, где ты ответственный
                  </div>
                </div>
              </div>
              <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-xl p-4 flex flex-col justify-between">
                <div>
                  <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">
                    Исходящие
                  </div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                    {outgoingTotal}
                  </div>
                  <div className="text-[11px] text-gray-500 dark:text-gray-400">
                    То, что ты создал для других (задачи и заявки)
                  </div>
                </div>
              </div>
              <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-xl p-4 flex flex-col justify-between">
                <div>
                  <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">
                    Уведомления
                  </div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                    {unreadNotifications}
                  </div>
                  <div className="text-[11px] text-gray-500 dark:text-gray-400 mb-2">
                    События по связанным с тобой сущностям
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={onNavigateToInbox}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                  >
                    Открыть центр коммуникаций
                  </button>
                </div>
              </div>
            </div>

            {/* Основной контент: задачи и сделки/встречи */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
              <div className="flex flex-col">
                <MyTasksSection
                  tasks={myTasks}
                  users={users}
                  projects={projects}
                  statuses={statuses}
                  priorities={priorities}
                  onOpenTask={onOpenTask}
                  onViewAll={onNavigateToTasks}
                />
              </div>
              <div className="flex flex-col space-y-4">
                <NewDealsSection
                  deals={deals}
                  clients={clients}
                  users={users}
                  onViewAll={onNavigateToDeals || (() => {})}
                />
                <UpcomingMeetings
                  meetings={meetings}
                  users={users}
                  onViewAll={onNavigateToMeetings}
                />
              </div>
            </div>
          </div>
        </Container>
      </PageLayout>
    </>
  );
};

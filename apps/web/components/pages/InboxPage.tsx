import React, { useMemo, useState } from 'react';
import { ActivityLog, User, Task, Deal, PurchaseRequest } from '../../types';
import { hasPermission } from '../../utils/permissions';
import { PageLayout } from '../ui/PageLayout';
import { Container } from '../ui/Container';
import { Button } from '../ui/Button';
import { CheckCircle2, Bell, Inbox, Send, MessageCircle } from 'lucide-react';
import { useNotificationCenter } from '../../frontend/contexts/NotificationCenterContext';
import { getDealDisplayTitle, isFunnelDeal } from '../../utils/dealModel';

type TabId = 'inbox' | 'outbox' | 'notifications';

interface InboxCard {
  id: string;
  kind: 'task' | 'deal' | 'request';
  title: string;
  subtitle?: string;
  status?: string;
  amount?: number;
  dateLabel?: string;
}

interface InboxPageProps {
  activities: ActivityLog[];
  currentUser: User;
  tasks: Task[];
  deals: Deal[];
  purchaseRequests: PurchaseRequest[];
  onMarkAllRead: () => void;
}

export const InboxPage: React.FC<InboxPageProps> = ({
  activities,
  currentUser,
  tasks,
  deals,
  purchaseRequests,
  onMarkAllRead,
}) => {
  const activityUnreadCount = activities.filter(a => !a.read).length;
  const {
    notifications: systemNotifications,
    unreadCount: notificationUnreadCount,
    markOneRead,
    markAllRead: markAllNotificationsRead,
  } = useNotificationCenter();

  const [activeTab, setActiveTab] = useState<TabId>('inbox');

  // --- ВХОДЯЩИЕ / ИСХОДЯЩИЕ ---

  const incomingCards: InboxCard[] = useMemo(() => {
    const cards: InboxCard[] = [];

    // Входящие задачи: я исполнитель
    const myTasks = (tasks || []).filter(t =>
      t &&
      !t.isArchived &&
      !['Выполнено', 'Done', 'Завершено'].includes(t.status) &&
      (t.assigneeId === currentUser.id || t.assigneeIds?.includes(currentUser.id))
    );
    myTasks.forEach(t => {
      cards.push({
        id: `task-${t.id}`,
        kind: 'task',
        title: t.title,
        subtitle: t.projectId ? 'Проектная задача' : undefined,
        status: t.status,
        dateLabel: t.endDate ? new Date(t.endDate).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' }) : undefined,
      });
    });

    // Входящие заявки: админ, заявки на согласование
    if (hasPermission(currentUser, 'finance.approve')) {
      purchaseRequests
        .filter(r => r && r.status === 'pending')
        .forEach(r => {
          cards.push({
            id: `req-${r.id}`,
            kind: 'request',
            title: `Заявка на ${r.amount?.toLocaleString() || 0} UZS`,
            subtitle: r.description,
            status: 'На согласовании',
            amount: r.amount,
            dateLabel: r.date ? new Date(r.date).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' }) : undefined,
          });
        });
    }

    // Входящие сделки: я ответственный по CRM-сделке (не договор из фин. блока)
    (deals || [])
      .filter(d => d && d.assigneeId === currentUser.id && !d.isArchived && isFunnelDeal(d))
      .forEach(d => {
        cards.push({
          id: `deal-${d.id}`,
          kind: 'deal',
          title: getDealDisplayTitle(d),
          subtitle: d.stage,
          status: d.stage,
          amount: d.amount,
          dateLabel: d.createdAt ? new Date(d.createdAt).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' }) : undefined,
        });
      });

    return cards;
  }, [tasks, purchaseRequests, deals, currentUser]);

  const outboxCards: InboxCard[] = useMemo(() => {
    const cards: InboxCard[] = [];

    // Исходящие задачи: я постановщик, а исполнитель — не я
    (tasks || [])
      .filter(t =>
        t &&
        t.createdByUserId === currentUser.id &&
        !t.isArchived &&
        t.assigneeId &&
        t.assigneeId !== currentUser.id
      )
      .forEach(t => {
        cards.push({
          id: `task-${t.id}`,
          kind: 'task',
          title: t.title,
          subtitle: 'Я поставил задачу',
          status: t.status,
          dateLabel: t.createdAt ? new Date(t.createdAt).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' }) : undefined,
        });
      });

    // Исходящие заявки: я инициатор
    purchaseRequests
      .filter(r => r && r.requesterId === currentUser.id)
      .forEach(r => {
        cards.push({
          id: `req-${r.id}`,
          kind: 'request',
          title: `Моя заявка на ${r.amount?.toLocaleString() || 0} UZS`,
          subtitle: r.description,
          status: r.status,
          amount: r.amount,
          dateLabel: r.date ? new Date(r.date).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' }) : undefined,
        });
      });

    return cards;
  }, [tasks, purchaseRequests, currentUser]);

  const handleMarkEverythingRead = () => {
    onMarkAllRead();
    void markAllNotificationsRead();
  };

  return (
    <PageLayout>
      <Container safeArea className="py-4">
        <div className="max-w-6xl mx-auto w-full">
          {/* Заголовок и действия */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-white">
                <MessageCircle size={18} className="text-blue-500" />
                <span>Центр коммуникаций</span>
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Входящие и исходящие по задачам и заявкам; системные уведомления — ниже. Личные чаты — в кнопке чата внизу
                экрана.
              </span>
            </div>
            {(activityUnreadCount > 0 || notificationUnreadCount > 0) && (
              <Button
                variant="ghost"
                size="sm"
                icon={CheckCircle2}
                onClick={handleMarkEverythingRead}
              >
                Отметить всё прочитанным
                {(activityUnreadCount > 0 || notificationUnreadCount > 0) && (
                  <span className="ml-1 text-[11px] opacity-80">
                    ({activityUnreadCount}+{notificationUnreadCount})
                  </span>
                )}
              </Button>
            )}
          </div>

          {/* Табы */}
          <div className="flex items-center gap-2 mb-4 border-b border-gray-200 dark:border-[#333]">
            <button
              onClick={() => setActiveTab('inbox')}
              className={`flex items-center gap-1 px-3 py-2 text-xs font-medium border-b-2 -mb-px ${
                activeTab === 'inbox'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              <Inbox size={14} /> Входящие
              {incomingCards.length > 0 && (
                <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                  {incomingCards.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('outbox')}
              className={`flex items-center gap-1 px-3 py-2 text-xs font-medium border-b-2 -mb-px ${
                activeTab === 'outbox'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              <Send size={14} /> Исходящие
              {outboxCards.length > 0 && (
                <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200">
                  {outboxCards.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('notifications')}
              className={`flex items-center gap-1 px-3 py-2 text-xs font-medium border-b-2 -mb-px ${
                activeTab === 'notifications'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              <Bell size={14} /> Уведомления
              {notificationUnreadCount > 0 && (
                <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300">
                  {notificationUnreadCount}
                </span>
              )}
            </button>
          </div>

          {/* Контент вкладок */}
          {activeTab === 'notifications' && (
            <div>
              {systemNotifications.length === 0 ? (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  <Bell size={48} className="mx-auto mb-4 opacity-20" />
                  <p className="text-lg">Нет уведомлений</p>
                </div>
              ) : (
                <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-xl shadow-sm overflow-hidden">
                  <div className="divide-y divide-gray-100 dark:divide-[#333]">
                    {systemNotifications.map((n) => (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => {
                          markOneRead(n.id, true);
                        }}
                        className={`w-full text-left p-4 hover:bg-gray-50 dark:hover:bg-[#303030] transition-colors ${
                          n.isRead ? '' : 'bg-blue-50/40 dark:bg-blue-900/10'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm font-semibold text-gray-900 dark:text-white">{n.title}</div>
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-300 mt-1">{n.body}</div>
                        {n.createdAt && (
                          <div className="text-[10px] text-gray-400 dark:text-gray-500 mt-2">
                            {new Date(n.createdAt).toLocaleString('ru-RU')}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'inbox' && (
            <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-xl shadow-sm overflow-hidden">
              {incomingCards.length === 0 ? (
                <div className="text-center py-10 text-gray-500 dark:text-gray-400 text-sm">
                  Нет входящих задач, заявок или сделок
                </div>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-[#333]">
                  {incomingCards.map(card => (
                    <div
                      key={card.id}
                      className="p-4 flex items-start justify-between gap-3 hover:bg-gray-50 dark:hover:bg-[#303030] transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-1">
                          {card.kind === 'task' && (
                            <span className="px-2 py-1 text-[10px] rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                              Задача
                            </span>
                          )}
                          {card.kind === 'deal' && (
                            <span className="px-2 py-1 text-[10px] rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                              Сделка
                            </span>
                          )}
                          {card.kind === 'request' && (
                            <span className="px-2 py-1 text-[10px] rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                              Заявка
                            </span>
                          )}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {card.title}
                          </div>
                          {card.subtitle && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                              {card.subtitle}
                            </div>
                          )}
                          <div className="flex items-center gap-3 text-[11px] text-gray-400 dark:text-gray-500 mt-1">
                            {card.status && <span>{card.status}</span>}
                            {card.amount !== undefined && (
                              <span>{card.amount.toLocaleString()} UZS</span>
                            )}
                            {card.dateLabel && <span>{card.dateLabel}</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'outbox' && (
            <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-xl shadow-sm overflow-hidden">
              {outboxCards.length === 0 ? (
                <div className="text-center py-10 text-gray-500 dark:text-gray-400 text-sm">
                  Нет исходящих задач или заявок
                </div>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-[#333]">
                  {outboxCards.map(card => (
                    <div
                      key={card.id}
                      className="p-4 flex items-start justify-between gap-3 hover:bg-gray-50 dark:hover:bg-[#303030] transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-1">
                          {card.kind === 'task' && (
                            <span className="px-2 py-1 text-[10px] rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                              Задача
                            </span>
                          )}
                          {card.kind === 'request' && (
                            <span className="px-2 py-1 text-[10px] rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                              Моя заявка
                            </span>
                          )}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {card.title}
                          </div>
                          {card.subtitle && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                              {card.subtitle}
                            </div>
                          )}
                          <div className="flex items-center gap-3 text-[11px] text-gray-400 dark:text-gray-500 mt-1">
                            {card.status && <span>{card.status}</span>}
                            {card.amount !== undefined && (
                              <span>{card.amount.toLocaleString()} UZS</span>
                            )}
                            {card.dateLabel && <span>{card.dateLabel}</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </Container>
    </PageLayout>
  );
};

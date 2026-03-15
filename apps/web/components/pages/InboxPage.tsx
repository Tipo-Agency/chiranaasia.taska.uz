import React, { useEffect, useMemo, useState } from 'react';
import { ActivityLog, User, Task, Deal, PurchaseRequest, Role } from '../../types';
import { PageLayout } from '../ui/PageLayout';
import { Container } from '../ui/Container';
import { ActivityItem } from '../features/activity/ActivityItem';
import { Button } from '../ui/Button';
import { CheckCircle2, Bell, Inbox, Send, MessageCircle, Users as UsersIcon, Paperclip } from 'lucide-react';
import { chatLocalService, ChatMessageLocal } from '../../services/chatLocalService';

type TabId = 'inbox' | 'outbox' | 'notifications' | 'chat';

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
  users: User[];
  currentUser: User;
  tasks: Task[];
  deals: Deal[];
  purchaseRequests: PurchaseRequest[];
  onMarkAllRead: () => void;
}

export const InboxPage: React.FC<InboxPageProps> = ({
  activities,
  users,
  currentUser,
  tasks,
  deals,
  purchaseRequests,
  onMarkAllRead,
}) => {
  const unreadCount = activities.filter(a => !a.read).length;

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
    if (currentUser.role === Role.ADMIN) {
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

    // Входящие сделки: я ответственный по сделке
    (deals || [])
      .filter(d => d && d.assigneeId === currentUser.id && !d.isArchived)
      .forEach(d => {
        cards.push({
          id: `deal-${d.id}`,
          kind: 'deal',
          title: d.title,
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

  // --- ЛОКАЛЬНЫЙ ЧАТ ---

  const colleagues = useMemo(
    () => users.filter(u => u.id !== currentUser.id),
    [users, currentUser.id]
  );

  const [activeChatUserId, setActiveChatUserId] = useState<string | null>(
    colleagues[0]?.id || null
  );
  const [chatMessages, setChatMessages] = useState<ChatMessageLocal[]>([]);
  const [chatInput, setChatInput] = useState('');

  // Загружаем историю чатов из localStorage
  useEffect(() => {
    setChatMessages(chatLocalService.getMessagesForUser(currentUser.id));
  }, [currentUser.id]);

  const currentChatMessages = useMemo(() => {
    if (!activeChatUserId) return [];
    return chatMessages
      .filter(
        m =>
          (m.fromId === currentUser.id && m.toId === activeChatUserId) ||
          (m.toId === currentUser.id && m.fromId === activeChatUserId)
      )
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [chatMessages, activeChatUserId, currentUser.id]);

  const handleSendMessage = () => {
    if (!chatInput.trim() || !activeChatUserId) return;
    chatLocalService.addMessage({
      fromId: currentUser.id,
      toId: activeChatUserId,
      text: chatInput.trim(),
    });
    setChatMessages(chatLocalService.getMessagesForUser(currentUser.id));
    setChatInput('');
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
                Входящие, исходящие, уведомления и личные чаты в одном месте
              </span>
            </div>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                icon={CheckCircle2}
                onClick={onMarkAllRead}
              >
                Отметить все прочитанными ({unreadCount})
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
              {unreadCount > 0 && (
                <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300">
                  {unreadCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('chat')}
              className={`flex items-center gap-1 px-3 py-2 text-xs font-medium border-b-2 -mb-px ${
                activeTab === 'chat'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
            >
              <UsersIcon size={14} /> Чаты
            </button>
          </div>

          {/* Контент вкладок */}
          {activeTab === 'notifications' && (
            <div>
              {activities.length === 0 ? (
                <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                  <Bell size={48} className="mx-auto mb-4 opacity-20" />
                  <p className="text-lg">Нет уведомлений</p>
                </div>
              ) : (
                <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-xl shadow-sm overflow-hidden">
                  <div className="divide-y divide-gray-100 dark:divide-[#333]">
                    {activities.map((activity) => (
                      <ActivityItem
                        key={activity.id}
                        activity={activity}
                        users={users}
                      />
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

          {activeTab === 'chat' && (
            <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-xl shadow-sm overflow-hidden h-[480px] flex">
              {/* Список собеседников */}
              <div className="w-56 border-r border-gray-100 dark:border-[#333] bg-gray-50/70 dark:bg-[#202020] flex flex-col">
                <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-[#333]">
                  Коллеги
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                  {colleagues.length === 0 ? (
                    <div className="p-4 text-xs text-gray-500 dark:text-gray-400">
                      Пока нет коллег для чата
                    </div>
                  ) : (
                    colleagues.map(u => (
                      <button
                        key={u.id}
                        onClick={() => setActiveChatUserId(u.id)}
                        className={`w-full px-3 py-2 text-left text-xs flex items-center gap-2 border-b border-gray-100 dark:border-[#333] ${
                          activeChatUserId === u.id
                            ? 'bg-white dark:bg-[#252525] text-gray-900 dark:text-gray-100'
                            : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#252525]'
                        }`}
                      >
                        <div className="w-7 h-7 rounded-full bg-gray-200 dark:bg-[#444] flex items-center justify-center text-[11px] font-semibold">
                          {u.name
                            .split(' ')
                            .map(p => p[0])
                            .join('')
                            .toUpperCase()}
                        </div>
                        <span className="truncate">{u.name}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Окно чата */}
              <div className="flex-1 flex flex-col">
                <div className="px-4 py-2 border-b border-gray-100 dark:border-[#333] flex items-center justify-between">
                  {activeChatUserId ? (
                    <>
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-gray-200 dark:bg-[#444] flex items-center justify-center text-[11px] font-semibold">
                          {users
                            .find(u => u.id === activeChatUserId)
                            ?.name.split(' ')
                            .map(p => p[0])
                            .join('')
                            .toUpperCase()}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {users.find(u => u.id === activeChatUserId)?.name}
                          </span>
                          <span className="text-[11px] text-gray-400 dark:text-gray-500">
                            Личный чат
                          </span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      Выберите коллегу слева, чтобы начать диалог
                    </span>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-3 space-y-2">
                  {activeChatUserId && currentChatMessages.length === 0 && (
                    <div className="text-center text-xs text-gray-500 dark:text-gray-400 mt-4">
                      Нет сообщений. Напишите первым.
                    </div>
                  )}
                  {currentChatMessages.map(msg => {
                    const isMine = msg.fromId === currentUser.id;
                    const time = new Date(msg.createdAt).toLocaleTimeString('ru-RU', {
                      hour: '2-digit',
                      minute: '2-digit',
                    });
                    return (
                      <div
                        key={msg.id}
                        className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[70%] rounded-2xl px-3 py-2 text-xs shadow-sm ${
                            isMine
                              ? 'bg-blue-600 text-white rounded-br-sm'
                              : 'bg-gray-100 dark:bg-[#333] text-gray-900 dark:text-gray-100 rounded-bl-sm'
                          }`}
                        >
                          <div>{msg.text}</div>
                          <div
                            className={`mt-1 text-[10px] ${
                              isMine ? 'text-blue-100/80' : 'text-gray-400 dark:text-gray-500'
                            }`}
                          >
                            {time}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="border-t border-gray-100 dark:border-[#333] px-3 py-2 flex items-center gap-2">
                  <button
                    type="button"
                    className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-[#333]"
                    title="В будущем сюда можно прикреплять задачи, сделки и заявки"
                  >
                    <Paperclip size={16} />
                  </button>
                  <input
                    type="text"
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    className="flex-1 text-xs px-3 py-2 rounded-lg border border-gray-200 dark:border-[#333] bg-white dark:bg-[#252525] text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder={
                      activeChatUserId
                        ? 'Напишите сообщение...'
                        : 'Сначала выберите коллегу слева'
                    }
                  />
                  <Button
                    type="button"
                    size="sm"
                    disabled={!chatInput.trim() || !activeChatUserId}
                    onClick={handleSendMessage}
                  >
                    Отправить
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </Container>
    </PageLayout>
  );
};

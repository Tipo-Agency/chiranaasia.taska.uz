/**
 * Мини-мессенджер: список сотрудников, выбор «Всем» или одного, лента сообщений, поле ввода.
 * Используется во вкладке «Сообщения» на рабочем столе, в выезжающей панели и на отдельной странице «Чат».
 */
import React, { useMemo, useState, useEffect } from 'react';
import { MessageCircle, Send, Users } from 'lucide-react';
import { User } from '../../../types';
import { chatLocalService, ChatMessageLocal } from '../../../services/chatLocalService';

const TO_ALL_ID = '__all__';

interface MiniMessengerProps {
  users: User[];
  currentUser: User;
  onClose?: () => void;
  className?: string;
}

export const MiniMessenger: React.FC<MiniMessengerProps> = ({
  users,
  currentUser,
  onClose,
  className = '',
}) => {
  const colleagues = useMemo(
    () => users.filter((u) => u.id !== currentUser.id && !u.isArchived),
    [users, currentUser.id]
  );
  const [activeId, setActiveId] = useState<string | null>(TO_ALL_ID);
  const [messages, setMessages] = useState<ChatMessageLocal[]>([]);
  const [input, setInput] = useState('');

  useEffect(() => {
    setMessages(chatLocalService.getMessagesForUser(currentUser.id));
  }, [currentUser.id]);

  const threadMessages = useMemo(() => {
    if (activeId === TO_ALL_ID) {
      return messages
        .filter((m) => m.toId === TO_ALL_ID)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    }
    return messages
      .filter(
        (m) =>
          (m.fromId === currentUser.id && m.toId === activeId) ||
          (m.toId === currentUser.id && m.fromId === activeId)
      )
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [messages, activeId, currentUser.id]);

  const send = () => {
    const text = input.trim();
    if (!text) return;
    chatLocalService.addMessage({
      fromId: currentUser.id,
      toId: activeId === TO_ALL_ID ? TO_ALL_ID : activeId,
      text,
    });
    setMessages(chatLocalService.getMessagesForUser(currentUser.id));
    setInput('');
  };

  const activeName = activeId === TO_ALL_ID ? 'Всем' : colleagues.find((u) => u.id === activeId)?.name ?? activeId;

  return (
    <div className={`flex flex-col h-full min-h-0 bg-white dark:bg-[#252525] rounded-xl border border-gray-200 dark:border-[#333] ${className}`}>
      <div className="flex items-center justify-between gap-2 p-3 border-b border-gray-200 dark:border-[#333] shrink-0">
        <div className="flex items-center gap-2 text-gray-800 dark:text-white font-medium">
          <MessageCircle size={18} />
          Чат · {activeName}
        </div>
        {onClose && (
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-[#333]">
            ✕
          </button>
        )}
      </div>
      <div className="flex flex-1 min-h-0">
        <div className="w-32 sm:w-40 border-r border-gray-200 dark:border-[#333] flex flex-col overflow-y-auto shrink-0">
          <button
            type="button"
            onClick={() => setActiveId(TO_ALL_ID)}
            className={`flex items-center gap-2 px-3 py-2 text-left text-sm ${activeId === TO_ALL_ID ? 'bg-[#3337AD] text-white' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#2a2a2a]'}`}
          >
            <Users size={16} />
            Всем
          </button>
          {colleagues.map((u) => (
            <button
              key={u.id}
              type="button"
              onClick={() => setActiveId(u.id)}
              className={`flex items-center gap-2 px-3 py-2 text-left text-sm truncate ${activeId === u.id ? 'bg-[#3337AD] text-white' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#2a2a2a]'}`}
            >
              {u.name}
            </button>
          ))}
        </div>
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {threadMessages.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">Нет сообщений. Напишите первым.</p>
            ) : (
              threadMessages.map((m) => {
                const isMe = m.fromId === currentUser.id;
                const senderName = isMe ? 'Вы' : (users.find((u) => u.id === m.fromId)?.name ?? m.fromId);
                return (
                  <div
                    key={m.id}
                    className={`flex flex-col max-w-[85%] ${isMe ? 'ml-auto items-end' : 'mr-auto items-start'}`}
                  >
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">{senderName}</p>
                    <div
                      className={`px-3 py-2 rounded-xl text-sm break-words ${
                        isMe ? 'bg-[#3337AD] text-white' : 'bg-gray-100 dark:bg-[#333] text-gray-800 dark:text-gray-200'
                      }`}
                    >
                      {m.text}
                    </div>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
                      {new Date(m.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                );
              })
            )}
          </div>
          <div className="p-2 border-t border-gray-200 dark:border-[#333] flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
              placeholder="Сообщение..."
              className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-gray-200 dark:border-[#333] bg-white dark:bg-[#191919] text-gray-900 dark:text-gray-100 text-sm"
            />
            <button
              type="button"
              onClick={send}
              className="p-2 rounded-lg bg-[#3337AD] text-white hover:bg-[#292b8a]"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

import React, { useCallback, useEffect, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { countIncomingChatUnread } from '../../../utils/chatUnreadCount';

export interface ChatFloatingButtonProps {
  onOpen: () => void;
  /** Скрыть, когда открыта полноэкранная страница «Чат» */
  hidden?: boolean;
  currentUserId?: string;
}

/**
 * Плавающая кнопка чата — правый нижний угол.
 * Счётчик — непрочитанные входящие сообщения чата (локальное хранилище + синк с API), не колокольчик уведомлений.
 */
export function ChatFloatingButton({ onOpen, hidden, currentUserId }: ChatFloatingButtonProps) {
  const [chatUnread, setChatUnread] = useState(0);

  const recompute = useCallback(() => {
    if (!currentUserId) {
      setChatUnread(0);
      return;
    }
    setChatUnread(countIncomingChatUnread(currentUserId));
  }, [currentUserId]);

  useEffect(() => {
    recompute();
    const onChange = () => {
      recompute();
    };
    window.addEventListener('taska:chat-messages-changed', onChange);
    const poll = window.setInterval(recompute, 5000);
    return () => {
      window.removeEventListener('taska:chat-messages-changed', onChange);
      window.clearInterval(poll);
    };
  }, [recompute]);

  if (hidden) return null;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="fixed z-40 flex items-center justify-center p-2.5 rounded-2xl shadow-xl border border-gray-200/90 dark:border-[#3f3f3f] bg-white/95 dark:bg-[#2a2a2a]/95 backdrop-blur-md text-[#3337AD] dark:text-[#a5a8f5] hover:bg-white dark:hover:bg-[#333] hover:shadow-2xl transition-all duration-200 bottom-[max(4.5rem,env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))] md:bottom-10 md:right-6"
      title={chatUnread > 0 ? `Чат — непрочитанных: ${chatUnread}` : 'Чат'}
    >
      <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#3337AD]/10 dark:bg-[#3337AD]/25">
        <MessageCircle size={22} strokeWidth={2} className="text-[#3337AD] dark:text-[#c4c6ff]" />
        {chatUnread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[1.125rem] h-[1.125rem] px-1 flex items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white border-2 border-white dark:border-[#2a2a2a]">
            {chatUnread > 99 ? '99+' : chatUnread}
          </span>
        )}
      </span>
    </button>
  );
}

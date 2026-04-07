import React from 'react';
import { MessageCircle } from 'lucide-react';
import { useNotificationCenter } from '../../../frontend/contexts/NotificationCenterContext';

export interface ChatFloatingButtonProps {
  onOpen: () => void;
  /** Скрыть, когда открыта полноэкранная страница «Чат» */
  hidden?: boolean;
}

/**
 * Плавающая кнопка чата — правый нижний угол, стиль «напоминания» (карточка с тенью и подписью).
 */
export function ChatFloatingButton({ onOpen, hidden }: ChatFloatingButtonProps) {
  const { unreadCount } = useNotificationCenter();
  if (hidden) return null;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="fixed z-40 flex items-center gap-2 pl-3 pr-4 py-2.5 rounded-2xl shadow-xl border border-gray-200/90 dark:border-[#3f3f3f] bg-white/95 dark:bg-[#2a2a2a]/95 backdrop-blur-md text-[#3337AD] dark:text-[#a5a8f5] hover:bg-white dark:hover:bg-[#333] hover:shadow-2xl transition-all duration-200 bottom-[max(1rem,env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))] md:bottom-6 md:right-6"
      title={unreadCount > 0 ? `Чат — непрочитанных: ${unreadCount}` : 'Чат'}
    >
      <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#3337AD]/10 dark:bg-[#3337AD]/25">
        <MessageCircle size={22} strokeWidth={2} className="text-[#3337AD] dark:text-[#c4c6ff]" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[1.125rem] h-[1.125rem] px-1 flex items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white border-2 border-white dark:border-[#2a2a2a]">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </span>
      <span className="text-sm font-semibold tracking-tight text-gray-800 dark:text-gray-100 pr-0.5">Чат</span>
    </button>
  );
}

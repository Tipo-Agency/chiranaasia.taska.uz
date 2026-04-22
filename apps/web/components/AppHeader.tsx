import React, { useEffect, useRef, useState } from 'react';
import {
  Search,
  Moon,
  Sun,
  Settings,
  ArrowLeft,
  ChevronDown,
  LogOut,
  User as UserIcon,
  Menu,
  MessageCircle,
  Package,
  Bell,
} from 'lucide-react';
import { useNotificationCenter } from '../frontend/contexts/NotificationCenterContext';
import { User } from '../types';
import { hasPermission } from '../utils/permissions';
import { getDefaultAvatarForId } from '../constants/avatars';
import { useAppToolbar } from '../contexts/AppToolbarContext';

export interface AppHeaderProps {
  darkMode: boolean;
  currentView: string;
  currentUser: User;
  searchQuery: string;
  /** Подсказка в поле поиска (зависит от текущего раздела). */
  searchPlaceholder?: string;
  onToggleDarkMode: () => void;
  onSearchChange: (query: string) => void;
  onSearchFocus: () => void;
  /** Открыть системную ленту в чате */
  onOpenSystemChat?: () => void;
  onOpenSettings: (tab: string) => void;
  onLogout: () => void;
  onMobileMenuToggle: () => void;
  /** Семантический «назад» по вкладкам/хабу (не window.history) */
  canGoBackInApp?: boolean;
  onGoBackInApp?: () => void;
  /** Открыть центр коммуникаций (входящие / уведомления) */
  onOpenInbox?: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  darkMode,
  currentView,
  currentUser,
  searchQuery,
  searchPlaceholder = 'Поиск',
  onToggleDarkMode,
  onSearchChange,
  onSearchFocus,
  onOpenSystemChat,
  onOpenSettings,
  onLogout,
  onMobileMenuToggle,
  canGoBackInApp,
  onGoBackInApp,
  onOpenInbox,
}) => {
  const { leading, module } = useAppToolbar();
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const userRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const { notifications, unreadCount, markOneRead, markAllRead, refresh } = useNotificationCenter();

  useEffect(() => {
    const onDocumentClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (showUserDropdown && userRef.current && !userRef.current.contains(target)) {
        setShowUserDropdown(false);
      }
      if (notifOpen && notifRef.current && !notifRef.current.contains(target)) {
        setNotifOpen(false);
      }
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowUserDropdown(false);
    };
    document.addEventListener('mousedown', onDocumentClick);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onDocumentClick);
      document.removeEventListener('keydown', onEscape);
    };
  }, [showUserDropdown, notifOpen]);

  return (
    <div className="h-12 border-b border-gray-200 dark:border-[#333] flex items-center gap-2 px-2 md:px-3 bg-white/95 dark:bg-[#191919]/95 backdrop-blur shrink-0 z-[40] min-w-0">
      <button
        type="button"
        onClick={onMobileMenuToggle}
        className="md:hidden p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-[#252525] rounded-lg shrink-0"
        aria-label="Открыть меню"
      >
        <Menu size={20} />
      </button>

      <div className="flex-1 min-w-0 flex items-center gap-1.5 overflow-x-auto custom-scrollbar py-0.5">
        {canGoBackInApp && onGoBackInApp && (
          <button
            type="button"
            onClick={onGoBackInApp}
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-gray-200 dark:border-[#333] bg-white dark:bg-[#1a1a1a] text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#252525] shrink-0"
            title="Назад"
            aria-label="Назад"
          >
            <ArrowLeft size={16} />
          </button>
        )}
        {leading}
      </div>

        <div className="flex items-center gap-2 shrink-0">
        {module}

        <div className="relative shrink-0" ref={notifRef}>
          <button
            type="button"
            onClick={() => {
              setNotifOpen((o) => !o);
              void refresh();
            }}
            className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 dark:border-[#333] bg-white dark:bg-[#1a1a1a] text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#252525]"
            title="Уведомления и центр коммуникаций"
            aria-label="Уведомления"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 min-w-[1.125rem] h-[1.125rem] px-1 flex items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white border-2 border-white dark:border-[#191919]">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
          {notifOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-[min(100vw-1rem,22rem)] rounded-xl border border-gray-200 dark:border-[#333] bg-white dark:bg-[#252525] shadow-2xl z-[130] max-h-[min(70dvh,28rem)] flex flex-col">
              <div className="px-3 py-2 border-b border-gray-100 dark:border-[#333] flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-gray-900 dark:text-white">Уведомления</span>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
                    onClick={() => {
                      void markAllRead();
                    }}
                  >
                    Прочитать все
                  </button>
                )}
              </div>
              <div className="overflow-y-auto custom-scrollbar p-1.5 min-h-0 flex-1">
                {notifications.length === 0 ? (
                  <p className="px-2 py-6 text-center text-sm text-gray-500 dark:text-gray-400">Нет уведомлений</p>
                ) : (
                  <ul className="space-y-0.5">
                    {notifications.slice(0, 20).map((n) => (
                      <li key={n.id}>
                        <button
                          type="button"
                          onClick={() => {
                            void markOneRead(n.id, true);
                          }}
                          className={`w-full text-left rounded-lg px-2.5 py-2 text-sm transition-colors ${
                            n.isRead
                              ? 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#303030]'
                              : 'bg-blue-50/80 dark:bg-blue-900/20 text-gray-900 dark:text-white'
                          }`}
                        >
                          <div className="font-medium line-clamp-1">{n.title}</div>
                          {n.body && <div className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mt-0.5">{n.body}</div>}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {onOpenInbox && (
                <div className="p-2 border-t border-gray-100 dark:border-[#333]">
                  <button
                    type="button"
                    onClick={() => {
                      setNotifOpen(false);
                      onOpenInbox();
                    }}
                    className="w-full py-2 rounded-lg text-sm font-semibold bg-[#3337AD] text-white hover:opacity-95"
                  >
                    Центр коммуникаций
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="hidden sm:block w-44 md:w-52 shrink-0">
          <div className="relative group">
            <Search
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#3337AD]"
            />
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onSearchFocus();
              }}
              className="w-full bg-white dark:bg-[#252525] border border-gray-300 dark:border-[#333] group-focus-within:border-[#3337AD] rounded-lg pl-8 pr-2 py-1.5 text-xs text-gray-900 dark:text-white outline-none transition-all placeholder-gray-400"
            />
          </div>
        </div>

        <div className="relative" ref={userRef}>
          <button
            type="button"
            onClick={() => setShowUserDropdown((p) => !p)}
            className="flex items-center gap-1 hover:bg-gray-100 dark:hover:bg-[#252525] pl-1 pr-1.5 py-1 rounded-full transition-colors border border-transparent hover:border-gray-200 dark:hover:border-[#333]"
            aria-expanded={showUserDropdown}
            aria-haspopup="menu"
          >
            <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full border border-gray-200 dark:border-[#444] bg-gray-100 dark:bg-[#333]">
              <img
                src={currentUser.avatar || getDefaultAvatarForId(currentUser.id)}
                className="h-full w-full object-cover object-center"
                alt=""
              />
            </span>
            <ChevronDown size={14} className="text-gray-400 shrink-0" aria-hidden />
          </button>
          {showUserDropdown && (
            <div className="absolute right-0 top-full mt-[3px] w-56 bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-xl shadow-xl z-[120] overflow-hidden">
              <div className="p-1 border-b border-gray-100 dark:border-[#333]">
                <button
                  type="button"
                  onClick={() => {
                    setShowUserDropdown(false);
                    onToggleDarkMode();
                  }}
                  className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#333] rounded-lg"
                >
                  {darkMode ? <Sun size={16} /> : <Moon size={16} />}
                  {darkMode ? 'Светлая тема' : 'Тёмная тема'}
                </button>
                {onOpenSystemChat && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowUserDropdown(false);
                      onOpenSystemChat();
                    }}
                    className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#333] rounded-lg"
                  >
                    <MessageCircle size={16} /> Системный чат
                  </button>
                )}
              </div>
              <div className="p-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowUserDropdown(false);
                    onOpenSettings('profile');
                  }}
                  className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#333] rounded-lg"
                >
                  <UserIcon size={16} /> Профиль
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowUserDropdown(false);
                    onOpenSettings(
                      hasPermission(currentUser, 'settings.general') ? 'users' : 'profile'
                    );
                  }}
                  className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#333] rounded-lg"
                >
                  <Settings size={16} /> Настройки
                </button>
                {currentView === 'inventory' && hasPermission(currentUser, 'settings.general') && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowUserDropdown(false);
                      onOpenSettings('finance-setup');
                    }}
                    className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#333] rounded-lg"
                  >
                    <Package size={16} /> Склады в настройках
                  </button>
                )}
                <div className="h-px bg-gray-100 dark:bg-[#333] my-1" />
                <button
                  type="button"
                  onClick={() => {
                    setShowUserDropdown(false);
                    onLogout();
                  }}
                  className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                >
                  <LogOut size={16} /> Выйти
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

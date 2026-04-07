import React, { useEffect, useRef, useState } from 'react';
import {
  Search,
  Moon,
  Sun,
  Settings,
  ChevronDown,
  LogOut,
  User as UserIcon,
  Menu,
  MessageCircle,
  Package,
} from 'lucide-react';
import { User, TableCollection } from '../types';
import { hasPermission } from '../utils/permissions';
import { DynamicIcon } from './AppIcons';
import { getDefaultAvatarForId } from '../constants/avatars';
import { useAppToolbar } from '../contexts/AppToolbarContext';

export interface AppHeaderProps {
  darkMode: boolean;
  currentView: string;
  activeTable?: TableCollection;
  currentUser: User;
  searchQuery: string;
  onToggleDarkMode: () => void;
  onSearchChange: (query: string) => void;
  onSearchFocus: () => void;
  /** Открыть системную ленту в чате */
  onOpenSystemChat?: () => void;
  onOpenSettings: (tab: string) => void;
  onLogout: () => void;
  onEditTable: () => void;
  onMobileMenuToggle: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  darkMode,
  currentView,
  activeTable,
  currentUser,
  searchQuery,
  onToggleDarkMode,
  onSearchChange,
  onSearchFocus,
  onOpenSystemChat,
  onOpenSettings,
  onLogout,
  onEditTable,
  onMobileMenuToggle,
}) => {
  const { leading, module } = useAppToolbar();
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const userRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocumentClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (showUserDropdown && userRef.current && !userRef.current.contains(target)) {
        setShowUserDropdown(false);
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
  }, [showUserDropdown]);

  const tableIconSlot =
    currentView === 'table' && activeTable ? (
      <button
        type="button"
        onClick={onEditTable}
        title={activeTable.name}
        className="h-8 w-8 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center shrink-0 text-indigo-700 dark:text-indigo-300 hover:opacity-90"
      >
        <DynamicIcon name={activeTable.icon} className={`${activeTable.color} shrink-0`} />
      </button>
    ) : null;

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

      <div className="flex-1 min-w-0 flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
        {tableIconSlot}
        {leading}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {module}

        <div className="hidden sm:block w-44 md:w-52 shrink-0">
          <div className="relative group">
            <Search
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#3337AD]"
            />
            <input
              type="text"
              placeholder="Поиск"
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
            <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-xl shadow-xl z-[120] overflow-hidden">
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

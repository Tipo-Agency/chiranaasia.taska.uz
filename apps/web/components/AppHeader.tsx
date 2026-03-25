import React, { useEffect, useRef, useState } from 'react';
import { 
  Search, Moon, Sun, Settings, Bell, ChevronDown, LogOut, User as UserIcon, Home, Menu, X, MessageCircle,
  BarChart3, Wallet, Network, PieChart, Briefcase, UserCheck, CheckSquare, Users, FileText, Instagram, Layers, Package, Cog
} from 'lucide-react';
import { User, Role, TableCollection } from '../types';
import { DynamicIcon } from './AppIcons';
import { getDefaultAvatarForId } from '../constants/avatars';

export interface AppHeaderProps {
  darkMode: boolean;
  currentView: string;
  activeTable?: TableCollection;
  currentUser: User;
  searchQuery: string;
  unreadNotificationsCount: number;
  activityLogs: any[];
  onToggleDarkMode: () => void;
  onSearchChange: (query: string) => void;
  onSearchFocus: () => void;
  onNavigateToInbox: () => void;
  /** Открыть системную ленту в чате вместо раздела «Входящие» */
  onOpenSystemChat?: () => void;
  onMarkAllRead: () => void;
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
  unreadNotificationsCount,
  activityLogs,
  onToggleDarkMode,
  onSearchChange,
  onSearchFocus,
  onNavigateToInbox,
  onOpenSystemChat,
  onMarkAllRead,
  onOpenSettings,
  onLogout,
  onEditTable,
  onMobileMenuToggle,
}) => {
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showNotificationDropdown, setShowNotificationDropdown] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);
  const getLogTitle = (log: any) => log?.title || log?.action || 'Уведомление';
  const getLogBody = (log: any) => log?.body || log?.details || '';
  const getLogTimestamp = (log: any) => log?.createdAt || log?.timestamp;
  const isLogRead = (log: any) => Boolean(log?.isRead ?? log?.read);

  useEffect(() => {
    const onDocumentClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (showNotificationDropdown && notificationRef.current && !notificationRef.current.contains(target)) {
        setShowNotificationDropdown(false);
      }
      if (showUserDropdown && userRef.current && !userRef.current.contains(target)) {
        setShowUserDropdown(false);
      }
    };

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowNotificationDropdown(false);
        setShowUserDropdown(false);
      }
    };

    document.addEventListener('mousedown', onDocumentClick);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onDocumentClick);
      document.removeEventListener('keydown', onEscape);
    };
  }, [showNotificationDropdown, showUserDropdown]);

  /** Вкладка настроек, относящаяся к текущему экрану (для кнопки-шестерёнки в шапке). */
  const getModuleSettingsTab = (view: string): string | null => {
    switch (view) {
      case 'tasks': return 'statuses';
      case 'sales-funnel': return 'sales-funnels';
      case 'clients': return 'integrations';
      case 'finance': return 'finance-categories';
      case 'business-processes': return 'spaces';
      case 'employees': return 'departments';
      case 'spaces': return 'spaces';
      case 'meetings': return 'automation';
      case 'inbox': return 'automation';
      case 'analytics': return 'system';
      case 'home': return 'profile';
      case 'admin': return 'system';
      case 'inventory': return 'funds';
      case 'table': return 'spaces';
      default: return null;
    }
  };

  const getPageHeader = (view: string) => {
    switch(view) {
      case 'home': return { title: 'Рабочий стол', icon: <Home size={18} />, iconBox: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' };
      case 'tasks': return { title: 'Задачи', icon: <CheckSquare size={18} />, iconBox: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' };
      case 'inbox': return { title: 'Входящие', icon: <Bell size={18} />, iconBox: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' };
      case 'chat': return { title: 'Чат', icon: <MessageCircle size={18} />, iconBox: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300' };
      case 'search': return { title: 'Поиск', icon: <Search size={18} />, iconBox: 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-300' };
      case 'settings': return { title: 'Настройки', icon: <Settings size={18} />, iconBox: 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-300' };
      case 'analytics': return { title: 'Аналитика', icon: <PieChart size={18} />, iconBox: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300' };
      case 'sales-funnel': return { title: 'Воронка продаж', icon: <BarChart3 size={18} />, iconBox: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300' };
      case 'clients': return { title: 'Клиенты', icon: <Briefcase size={18} />, iconBox: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300' };
      case 'finance': return { title: 'Финансы', icon: <Wallet size={18} />, iconBox: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' };
      case 'business-processes': return { title: 'Бизнес-процессы', icon: <Network size={18} />, iconBox: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' };
      case 'employees': return { title: 'Сотрудники', icon: <UserCheck size={18} />, iconBox: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' };
      case 'spaces': return { title: 'Пространство', icon: <Layers size={18} />, iconBox: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' };
      case 'meetings': return { title: 'Встречи', icon: <Users size={18} />, iconBox: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300' };
      case 'docs': return { title: 'Документы', icon: <FileText size={18} />, iconBox: 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-300' };
      case 'doc-editor': return { title: 'Редактор документа', icon: <FileText size={18} />, iconBox: 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-300' };
      case 'inventory': return { title: 'Склад', icon: <Package size={18} />, iconBox: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' };
      default: return { title: view, icon: <Settings size={18} />, iconBox: 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-300' };
    }
  };

  const headerInfo = getPageHeader(currentView);
  const moduleSettingsTab = getModuleSettingsTab(currentView);

  return (
    <div className="h-14 md:h-14 border-b border-gray-200 dark:border-[#333] flex items-center justify-between px-3 md:px-4 bg-white/95 dark:bg-[#191919]/95 backdrop-blur shrink-0 z-[40]">
      <div className="flex items-center gap-2 md:gap-3 overflow-hidden min-w-0 flex-1">
        <button 
          onClick={onMobileMenuToggle} 
          className="md:hidden p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-[#252525] rounded-lg shrink-0"
        >
          <Menu size={20}/>
        </button>
        
        {currentView === 'table' && activeTable ? (
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="flex items-center gap-2 group cursor-pointer min-w-0 flex-1" onClick={onEditTable}>
              <div className="h-8 w-8 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center shrink-0">
                <DynamicIcon name={activeTable.icon} className={`${activeTable.color} shrink-0`} />
              </div>
              <h2 className="font-semibold text-gray-900 dark:text-white truncate text-sm md:text-base">
                {activeTable.name}
              </h2>
              {currentUser.role === Role.ADMIN && (
                <Settings size={14} className="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity hidden md:block shrink-0" />
              )}
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onOpenSettings('spaces'); }}
              className="p-1.5 rounded-lg text-gray-500 hover:text-[#3337AD] dark:hover:text-[#8b8ee0] hover:bg-gray-100 dark:hover:bg-[#252525] shrink-0"
              title="Настройки модулей и страниц"
            >
              <Cog size={16} strokeWidth={2} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-gray-800 dark:text-white font-semibold min-w-0">
            <div className={`h-8 w-8 rounded-xl flex items-center justify-center shrink-0 ${headerInfo.iconBox}`}>{headerInfo.icon}</div>
            <span className="truncate text-sm md:text-base">{headerInfo.title}</span>
            {moduleSettingsTab && (
              <button
                type="button"
                onClick={() => onOpenSettings(moduleSettingsTab)}
                className="p-1.5 rounded-lg text-gray-500 hover:text-[#3337AD] dark:hover:text-[#8b8ee0] hover:bg-gray-100 dark:hover:bg-[#252525] shrink-0"
                title="Настройки раздела"
              >
                <Cog size={16} strokeWidth={2} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Глобальный поиск по системе — выразительное поле */}
      <div className="flex-1 max-w-2xl mx-2 md:mx-4 hidden sm:block">
        <div className="relative group">
          <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#3337AD]"/>
          <input 
            type="text" 
            placeholder="Поиск"
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                onSearchFocus();
              }
            }}
            className="w-full bg-white dark:bg-[#252525] border border-gray-300 dark:border-[#333] group-focus-within:border-[#3337AD] rounded-xl pl-10 pr-4 py-2 text-sm text-gray-900 dark:text-white outline-none transition-all placeholder-gray-400"
          />
        </div>
      </div>

      <div className="flex items-center gap-1 md:gap-3 shrink-0">
        <button 
          onClick={onToggleDarkMode} 
          className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-[#252525] rounded-lg transition-colors hidden sm:block"
        >
          {darkMode ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        
        {/* Notification Bell */}
        <div className="relative" ref={notificationRef}>
          <button 
            onClick={() => {
              setShowNotificationDropdown((prev) => !prev);
              setShowUserDropdown(false);
            }}
            className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-[#252525] rounded-lg transition-colors relative"
          >
            <Bell size={18} />
            {unreadNotificationsCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border border-white dark:border-[#191919]"></span>
            )}
          </button>
          {showNotificationDropdown && (
              <div className="absolute right-0 top-full mt-2 w-[calc(100vw-2rem)] sm:w-72 md:w-80 max-w-sm bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-xl shadow-xl z-[120] overflow-hidden flex flex-col">
                <div className="p-3 border-b border-gray-100 dark:border-[#333] flex justify-between items-center bg-gray-50 dark:bg-[#202020]">
                  <span className="text-xs font-bold text-gray-500 uppercase">Уведомления</span>
                  {unreadNotificationsCount > 0 && (
                    <button 
                      onClick={onMarkAllRead} 
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Прочитать все
                    </button>
                  )}
                </div>
                <div className="max-h-64 overflow-y-auto custom-scrollbar">
                  {activityLogs.slice(0, 5).map(log => (
                    <div 
                      key={log.id} 
                      onClick={() => {
                        setShowNotificationDropdown(false);
                        if (onOpenSystemChat) onOpenSystemChat();
                        else onNavigateToInbox();
                      }}
                      className={`p-3 border-b border-gray-100 dark:border-[#333] last:border-0 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-[#303030] transition-colors ${!isLogRead(log) ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}
                    >
                      <div className="font-medium text-gray-800 dark:text-gray-200">{getLogTitle(log)}</div>
                      <div className="text-gray-500 dark:text-gray-400 text-xs truncate">{getLogBody(log)}</div>
                      {getLogTimestamp(log) && (
                        <div className="text-[10px] text-gray-400 mt-1">
                          {new Date(getLogTimestamp(log)).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                        </div>
                      )}
                    </div>
                  ))}
                  {activityLogs.length === 0 && (
                    <div className="p-4 text-center text-gray-400 text-xs">Нет уведомлений</div>
                  )}
                </div>
                <button 
                  onClick={() => {
                    setShowNotificationDropdown(false);
                    if (onOpenSystemChat) onOpenSystemChat();
                    else onNavigateToInbox();
                  }} 
                  className="p-2 text-center text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#333] border-t border-gray-100 dark:border-[#333]"
                >
                  {onOpenSystemChat ? 'Открыть системный чат' : 'Просмотреть все'}
                </button>
              </div>
          )}
        </div>

        <div className="h-6 w-px bg-gray-200 dark:bg-[#333] mx-1 hidden md:block"></div>

        <div className="relative" ref={userRef}>
          <button 
            onClick={() => {
              setShowUserDropdown((prev) => !prev);
              setShowNotificationDropdown(false);
            }}
            className="flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-[#252525] p-1 pr-3 rounded-full transition-colors border border-transparent hover:border-gray-200 dark:hover:border-[#333]"
          >
            <img 
              src={currentUser.avatar || getDefaultAvatarForId(currentUser.id)} 
              className="w-7 h-7 rounded-full border border-gray-200 dark:border-[#444] object-cover object-center" 
              alt="avatar"
            />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200 hidden md:block">
              {currentUser.name}
            </span>
            <ChevronDown size={14} className="text-gray-400 hidden md:block" />
          </button>
          {showUserDropdown && (
              <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-xl shadow-xl z-[120] overflow-hidden">
                <div className="p-3 border-b border-gray-100 dark:border-[#333] flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-lg">
                    {currentUser.name.charAt(0)}
                  </div>
                  <div className="overflow-hidden">
                    <div className="font-bold text-gray-900 dark:text-white text-sm truncate">
                      {currentUser.name}
                    </div>
                    <div className="text-xs text-gray-500 truncate">{currentUser.email}</div>
                  </div>
                </div>
                <div className="p-1">
                  <button 
                    onClick={() => { setShowUserDropdown(false); onOpenSettings('profile'); }} 
                    className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#333] rounded-lg"
                  >
                    <UserIcon size={16}/> Профиль
                  </button>
                  <button 
                    onClick={() => { setShowUserDropdown(false); onOpenSettings('users'); }} 
                    className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#333] rounded-lg"
                  >
                    <Settings size={16}/> Настройки
                  </button>
                  <div className="h-px bg-gray-100 dark:bg-[#333] my-1"></div>
                  <button 
                    onClick={onLogout} 
                    className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                  >
                    <LogOut size={16}/> Выйти
                  </button>
                </div>
              </div>
          )}
        </div>
      </div>
    </div>
  );
};


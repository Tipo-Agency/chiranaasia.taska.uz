
import React, { useState } from 'react';
import { 
  Plus, 
  Home,
  Settings,
  Edit2,
  Trash2,
  BarChart3,
  Wallet,
  Network,
  Briefcase,
  UserCheck,
  X,
  CheckSquare,
  ChevronRight,
  ChevronDown,
  Users,
  Layers,
  Package,
} from 'lucide-react';
import { TableCollection, User } from '../types';
import { LogoIcon, DynamicIcon } from './AppIcons';
import { hasPermission } from '../utils/permissions';

/** Подсветка активной иконки в стиле чипов верхнего меню */
const ICON_ACTIVE: Record<string, string> = {
  indigo: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  violet: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  orange: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  slate: 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-300',
};

function NavIcon({
  active,
  accent,
  children,
}: {
  active: boolean;
  accent: keyof typeof ICON_ACTIVE;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center w-8 h-8 rounded-xl transition-colors ${
        active ? ICON_ACTIVE[accent] : 'text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-200'
      }`}
    >
      {children}
    </span>
  );
}

export interface SidebarProps {
  isOpen: boolean; // Mobile state
  onClose: () => void; // Mobile close handler
  tables: TableCollection[];
  activeTableId: string;
  onSelectTable: (id: string) => void;
  onNavigate: (view: 'home' | 'tasks' | 'inbox' | 'chat' | 'search' | 'clients' | 'employees' | 'sales-funnel' | 'client-chats' | 'finance' | 'business-processes' | 'analytics' | 'settings' | 'inventory' | 'admin') => void;
  currentView: string;
  currentUser: User;
  onCreateTable: () => void;
  onOpenSettings: () => void;
  onDeleteTable: (id: string) => void;
  onEditTable: (table: TableCollection) => void;
  unreadCount: number;
  onNavigateToType?: (type: string) => void;
  activeSpaceTab?: 'content-plan' | 'backlog' | 'functionality';
}

const Sidebar: React.FC<SidebarProps> = ({ 
  isOpen,
  onClose,
  tables, 
  activeTableId, 
  onSelectTable, 
  onNavigate,
  currentView,
  currentUser,
  onCreateTable,
  onOpenSettings,
  onDeleteTable,
  onEditTable,
  unreadCount,
  onNavigateToType,
  activeSpaceTab
}) => {
  // Загружаем состояние из localStorage
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved === 'true';
  });
  
  // Сохраняем состояние в localStorage при изменении
  const handleToggleCollapse = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem('sidebarCollapsed', String(newState));
  };
  
  const getTableTypeIcon = (type: string) => {
      switch(type) {
          case 'functionality': return 'Layers';
          case 'backlog': return 'Archive';
          case 'content-plan': return 'Instagram';
          case 'meetings': return 'Users';
          case 'docs': return 'FileText';
          default: return 'CheckSquare';
      }
  };

  const handleNav = (cb: () => void) => {
      cb();
      onClose(); // Close sidebar on mobile after click
  };

  const can = (key: string) => hasPermission(currentUser, key);

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
            className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm transition-opacity"
            onClick={onClose}
        ></div>
      )}

      {/* Sidebar Container */}
      <div className={`
        fixed md:static inset-y-0 left-0 z-50
        ${isCollapsed ? 'w-16' : 'w-56'} md:${isCollapsed ? 'w-16' : 'w-56'} bg-white dark:bg-[#191919] border-r border-notion-border dark:border-[#333]
        transform transition-all duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0
        h-full flex flex-col text-notion-text dark:text-gray-300
      `} style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {/* Workspace Header */}
        <div className={`flex items-center ${isCollapsed ? 'justify-center relative' : 'justify-between'} p-2 mb-2`}>
            <div 
                onClick={() => handleNav(() => onNavigate('home'))}
                className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} hover:bg-notion-hover dark:hover:bg-[#252525] rounded cursor-pointer transition-colors p-2 ${isCollapsed ? 'w-full' : 'flex-1'}`}
            >
                <LogoIcon className="w-6 h-6 shrink-0" />
                {!isCollapsed && <span className="font-semibold text-sm">Типа задачи</span>}
            </div>
            {!isCollapsed && (
              <div className="flex items-center gap-1 shrink-0">
                {/* Mobile Close Button */}
                <button onClick={onClose} className="md:hidden p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-[#252525] rounded-lg">
                    <X size={20} />
                </button>
              </div>
            )}
        </div>

        {/* Standard Links - Порядок согласно ТЗ */}
        <div className={`${isCollapsed ? 'px-2' : 'px-2'} py-1 space-y-0.5 mb-4 shrink-0`} style={{ overflow: 'visible' }}>
            {/* 1. Рабочий стол */}
            {can('core.home') && (
            <div 
                onClick={() => handleNav(() => onNavigate('home'))}
                className={`group flex items-center ${isCollapsed ? 'justify-center' : 'gap-2'} ${isCollapsed ? 'px-2' : 'px-3'} py-1.5 rounded-lg cursor-pointer transition-colors ${currentView === 'home' ? 'text-gray-900 dark:text-white' : 'text-notion-text/70 dark:text-gray-400 hover:bg-notion-hover dark:hover:bg-[#252525] hover:text-notion-text dark:hover:text-gray-200'}`}
                title={isCollapsed ? "Рабочий стол" : ""}
            >
            <NavIcon active={currentView === 'home'} accent="indigo"><Home size={18} /></NavIcon>
            {!isCollapsed && <span className={`text-sm ${currentView === 'home' ? 'font-semibold' : ''}`}>Рабочий стол</span>}
            </div>
            )}
            
            {/* 2. Задачи */}
            {can('core.tasks') && (
            <div 
                onClick={() => handleNav(() => onNavigate('tasks'))}
                className={`group flex items-center ${isCollapsed ? 'justify-center' : 'gap-2'} ${isCollapsed ? 'px-2' : 'px-3'} py-1.5 rounded-lg cursor-pointer transition-colors ${currentView === 'tasks' ? 'text-gray-900 dark:text-white' : 'text-notion-text/70 dark:text-gray-400 hover:bg-notion-hover dark:hover:bg-[#252525] hover:text-notion-text dark:hover:text-gray-200'}`}
                title={isCollapsed ? "Задачи" : ""}
            >
                <NavIcon active={currentView === 'tasks'} accent="indigo"><CheckSquare size={18} /></NavIcon>
                {!isCollapsed && <span className={`text-sm ${currentView === 'tasks' ? 'font-semibold' : ''}`}>Задачи</span>}
            </div>
            )}

            {/* Воронка продаж + диалоги + клиенты (единый раздел) */}
            {(can('crm.sales_funnel') || can('crm.client_chats') || can('crm.clients')) && (
            <div 
                onClick={() => handleNav(() => onNavigate('sales-funnel'))}
                className={`group flex items-center ${isCollapsed ? 'justify-center' : 'gap-2'} ${isCollapsed ? 'px-2' : 'px-3'} py-1.5 rounded-lg cursor-pointer transition-colors ${currentView === 'sales-funnel' ? 'text-gray-900 dark:text-white' : 'text-notion-text/70 dark:text-gray-400 hover:bg-notion-hover dark:hover:bg-[#252525] hover:text-notion-text dark:hover:text-gray-200'}`}
                title={isCollapsed ? "Воронка продаж" : ""}
            >
                <NavIcon active={currentView === 'sales-funnel'} accent="violet"><BarChart3 size={18} /></NavIcon>
                {!isCollapsed && <span className={`text-sm ${currentView === 'sales-funnel' ? 'font-semibold' : ''}`}>Воронка продаж</span>}
            </div>
            )}

            {/* 4. Финансовое планирование */}
            {can('finance.finance') && (
            <div 
                onClick={() => handleNav(() => onNavigate('finance'))}
                className={`group flex items-center ${isCollapsed ? 'justify-center' : 'gap-2'} ${isCollapsed ? 'px-2' : 'px-3'} py-1.5 rounded-lg cursor-pointer transition-colors ${currentView === 'finance' ? 'text-gray-900 dark:text-white' : 'text-notion-text/70 dark:text-gray-400 hover:bg-notion-hover dark:hover:bg-[#252525] hover:text-notion-text dark:hover:text-gray-200'}`}
                title={isCollapsed ? "Фин. планирование" : ""}
            >
                <NavIcon active={currentView === 'finance'} accent="emerald"><Wallet size={18} /></NavIcon>
                {!isCollapsed && <span className={`text-sm ${currentView === 'finance' ? 'font-semibold' : ''}`}>Фин. планирование</span>}
            </div>
            )}

            {/* Бизнес-процессы; склад — вложенным пунктом */}
            {can('org.bpm') && can('org.inventory') && (
              <div className="space-y-0.5">
                <div
                  onClick={() => handleNav(() => onNavigate('business-processes'))}
                  className={`group flex items-center ${isCollapsed ? 'justify-center' : 'gap-2'} ${isCollapsed ? 'px-2' : 'px-3'} py-1.5 rounded-lg cursor-pointer transition-colors ${
                    currentView === 'business-processes'
                      ? 'text-gray-900 dark:text-white'
                      : 'text-notion-text/70 dark:text-gray-400 hover:bg-notion-hover dark:hover:bg-[#252525] hover:text-notion-text dark:hover:text-gray-200'
                  }`}
                  title={isCollapsed ? 'Бизнес-процессы' : ''}
                >
                  <NavIcon active={currentView === 'business-processes'} accent="blue"><Network size={18} /></NavIcon>
                  {!isCollapsed && (
                    <span className={`text-sm ${currentView === 'business-processes' ? 'font-semibold' : ''}`}>Бизнес-процессы</span>
                  )}
                </div>
                <div
                  onClick={() => handleNav(() => onNavigate('inventory'))}
                  className={`group flex items-center ${isCollapsed ? 'justify-center' : 'gap-2'} ${isCollapsed ? 'px-2' : 'px-3'} py-1.5 rounded-lg cursor-pointer transition-colors ${
                    currentView === 'inventory'
                      ? 'text-gray-900 dark:text-white'
                      : 'text-notion-text/70 dark:text-gray-400 hover:bg-notion-hover dark:hover:bg-[#252525] hover:text-notion-text dark:hover:text-gray-200'
                  }`}
                  title={isCollapsed ? 'Склад' : ''}
                >
                  <NavIcon active={currentView === 'inventory'} accent="emerald"><Package size={18} className="shrink-0" /></NavIcon>
                  {!isCollapsed && <span className={`text-sm ${currentView === 'inventory' ? 'font-semibold' : ''}`}>Склад</span>}
                </div>
              </div>
            )}
            {can('org.bpm') && !can('org.inventory') && (
              <div
                onClick={() => handleNav(() => onNavigate('business-processes'))}
                className={`group flex items-center ${isCollapsed ? 'justify-center' : 'gap-2'} ${isCollapsed ? 'px-2' : 'px-3'} py-1.5 rounded-lg cursor-pointer transition-colors ${
                  currentView === 'business-processes'
                    ? 'text-gray-900 dark:text-white'
                    : 'text-notion-text/70 dark:text-gray-400 hover:bg-notion-hover dark:hover:bg-[#252525] hover:text-notion-text dark:hover:text-gray-200'
                }`}
                title={isCollapsed ? 'Бизнес-процессы' : ''}
              >
                <NavIcon active={currentView === 'business-processes'} accent="blue"><Network size={18} /></NavIcon>
                {!isCollapsed && (
                  <span className={`text-sm ${currentView === 'business-processes' ? 'font-semibold' : ''}`}>Бизнес-процессы</span>
                )}
              </div>
            )}
            {!can('org.bpm') && can('org.inventory') && (
              <div
                onClick={() => handleNav(() => onNavigate('inventory'))}
                className={`group flex items-center ${isCollapsed ? 'justify-center' : 'gap-2'} ${isCollapsed ? 'px-2' : 'px-3'} py-1.5 rounded-lg cursor-pointer transition-colors ${
                  currentView === 'inventory'
                    ? 'text-gray-900 dark:text-white'
                    : 'text-notion-text/70 dark:text-gray-400 hover:bg-notion-hover dark:hover:bg-[#252525] hover:text-notion-text dark:hover:text-gray-200'
                }`}
                title={isCollapsed ? 'Склад' : ''}
              >
                <NavIcon active={currentView === 'inventory'} accent="emerald"><Package size={18} /></NavIcon>
                {!isCollapsed && <span className={`text-sm ${currentView === 'inventory' ? 'font-semibold' : ''}`}>Склад</span>}
              </div>
            )}

            {/* Чат на мобильной версии отключён (плохой UX). */}

            {/* 8. Сотрудники */}
            {can('org.employees') && (
                <div 
                    onClick={() => handleNav(() => onNavigate('employees'))}
                    className={`group flex items-center ${isCollapsed ? 'justify-center' : 'gap-2'} ${isCollapsed ? 'px-2' : 'px-3'} py-1.5 rounded-lg cursor-pointer transition-colors ${currentView === 'employees' ? 'text-gray-900 dark:text-white' : 'text-notion-text/70 dark:text-gray-400 hover:bg-notion-hover dark:hover:bg-[#252525] hover:text-notion-text dark:hover:text-gray-200'}`}
                    title={isCollapsed ? "Сотрудники" : ""}
                >
                    <NavIcon active={currentView === 'employees'} accent="orange"><UserCheck size={18} /></NavIcon>
                    {!isCollapsed && <span className={`text-sm ${currentView === 'employees' ? 'font-semibold' : ''}`}>Сотрудники</span>}
                </div>
            )}

        </div>

        {/* Tables List with Grouping */}
        <div className={`${isCollapsed ? 'px-2' : 'px-3'} flex-1 overflow-y-auto custom-scrollbar min-h-0`}>
            {can('crm.spaces') && (
              <div className="space-y-0.5 mb-3">
                <div 
                  onClick={() => handleNav(() => onNavigateToType?.('content-plan'))}
                  className={`group flex items-center ${isCollapsed ? 'justify-center' : 'gap-2'} ${isCollapsed ? 'px-2' : 'px-3'} py-1.5 rounded-lg cursor-pointer transition-colors ${(currentView === 'spaces' && activeSpaceTab === 'content-plan') || (currentView === 'table' && activeTableId && tables.find(t => t.id === activeTableId)?.type === 'content-plan') ? 'text-gray-900 dark:text-white' : 'text-notion-text/70 dark:text-gray-400 hover:bg-notion-hover dark:hover:bg-[#252525] hover:text-notion-text dark:hover:text-gray-200'}`}
                  title={isCollapsed ? 'Пространство' : ''}
                >
                  <NavIcon active={(currentView === 'spaces' && activeSpaceTab === 'content-plan') || (currentView === 'table' && activeTableId && tables.find(t => t.id === activeTableId)?.type === 'content-plan')} accent="indigo"><Layers size={isCollapsed ? 18 : 16} /></NavIcon>
                  {!isCollapsed && <span className={`text-sm ${((currentView === 'spaces' && activeSpaceTab === 'content-plan') || (currentView === 'table' && activeTableId && tables.find(t => t.id === activeTableId)?.type === 'content-plan')) ? 'font-semibold' : ''}`}>Пространство</span>}
                </div>
              </div>
            )}

        </div>

        {/* Footer Settings */}
        {can('settings.general') && (
            <div className={`${isCollapsed ? 'p-2' : 'p-3'} mt-auto border-t border-notion-border dark:border-[#333] shrink-0 bg-white dark:bg-[#191919]`}>
                <button 
                    type="button"
                    onClick={() => { handleNav(() => onOpenSettings()); }}
                    className={`group w-full ${isCollapsed ? 'flex justify-center' : 'text-left flex items-center gap-2'} ${isCollapsed ? 'px-2' : 'px-3'} py-2 rounded-lg cursor-pointer text-sm transition-colors ${currentView === 'settings' ? 'text-gray-900 dark:text-white' : 'text-notion-text dark:text-gray-300 hover:bg-notion-hover dark:hover:bg-[#252525]'}`}
                    title={isCollapsed ? "Настройки" : ""}
                >
                    <NavIcon active={currentView === 'settings'} accent="slate"><Settings size={18} /></NavIcon>
                    {!isCollapsed && <span className={currentView === 'settings' ? 'font-semibold' : ''}>Настройки</span>}
                </button>
            </div>
        )}

        {/* Collapse Button (внизу меню, всегда) */}
        <div className="border-t border-notion-border dark:border-[#333] shrink-0 bg-white dark:bg-[#191919] p-2">
          <button 
            onClick={handleToggleCollapse} 
            className="hidden md:flex items-center justify-center w-full h-8 text-gray-500 hover:bg-gray-100 dark:hover:bg-[#252525] rounded transition-colors"
            title={isCollapsed ? "Развернуть" : "Свернуть"}
          >
            <ChevronRight size={14} className={isCollapsed ? '' : 'rotate-180'} />
          </button>
        </div>
      </div>
    </>
  );
};

export default Sidebar;

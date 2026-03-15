
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
  PieChart,
  Briefcase,
  UserCheck,
  X,
  CheckSquare,
  ChevronRight,
  ChevronDown,
  Instagram,
  FileText,
  Users,
  Archive,
  Layers,
  Globe,
  ShieldCheck,
  MessageCircle
} from 'lucide-react';
import { TableCollection, User, Role } from '../types';
import { LogoIcon, DynamicIcon } from './AppIcons';

interface SidebarProps {
  isOpen: boolean; // Mobile state
  onClose: () => void; // Mobile close handler
  tables: TableCollection[];
  activeTableId: string;
  onSelectTable: (id: string) => void;
  onNavigate: (view: 'home' | 'tasks' | 'inbox' | 'chat' | 'search' | 'clients' | 'employees' | 'sales-funnel' | 'finance' | 'business-processes' | 'analytics' | 'settings' | 'sites' | 'inventory' | 'admin') => void;
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
            <div 
                onClick={() => handleNav(() => onNavigate('home'))}
                className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-2'} ${isCollapsed ? 'px-2' : 'px-3'} py-1.5 rounded cursor-pointer transition-colors ${currentView === 'home' ? 'bg-notion-hover dark:bg-[#252525] text-notion-text dark:text-white font-medium' : 'text-notion-text/70 dark:text-gray-400 hover:bg-notion-hover dark:hover:bg-[#252525] hover:text-notion-text dark:hover:text-gray-200'}`}
                title={isCollapsed ? "Рабочий стол" : ""}
            >
            <Home size={18} /> {!isCollapsed && <span className="text-sm">Рабочий стол</span>}
            </div>
            
            {/* 2. Задачи */}
            <div 
                onClick={() => handleNav(() => onNavigate('tasks'))}
                className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-2'} ${isCollapsed ? 'px-2' : 'px-3'} py-1.5 rounded cursor-pointer transition-colors ${currentView === 'tasks' ? 'bg-notion-hover dark:bg-[#252525] text-notion-text dark:text-white font-medium' : 'text-notion-text/70 dark:text-gray-400 hover:bg-notion-hover dark:hover:bg-[#252525] hover:text-notion-text dark:hover:text-gray-200'}`}
                title={isCollapsed ? "Задачи" : ""}
            >
                <CheckSquare size={18} /> {!isCollapsed && <span className="text-sm">Задачи</span>}
            </div>

            {/* 3. Воронка продаж */}
            <div 
                onClick={() => handleNav(() => onNavigate('sales-funnel'))}
                className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-2'} ${isCollapsed ? 'px-2' : 'px-3'} py-1.5 rounded cursor-pointer transition-colors ${currentView === 'sales-funnel' ? 'bg-notion-hover dark:bg-[#252525] text-notion-text dark:text-white font-medium' : 'text-notion-text/70 dark:text-gray-400 hover:bg-notion-hover dark:hover:bg-[#252525] hover:text-notion-text dark:hover:text-gray-200'}`}
                title={isCollapsed ? "Воронка продаж" : ""}
            >
                <BarChart3 size={18} /> {!isCollapsed && <span className="text-sm">Воронка продаж</span>}
            </div>

            {/* 3.1. Клиенты и договора (под Воронка продаж) */}
            <div 
                onClick={() => handleNav(() => onNavigate('clients'))}
                className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-2'} ${isCollapsed ? 'px-2' : 'px-3'} py-1.5 rounded cursor-pointer transition-colors ${currentView === 'clients' ? 'bg-notion-hover dark:bg-[#252525] text-notion-text dark:text-white font-medium' : 'text-notion-text/70 dark:text-gray-400 hover:bg-notion-hover dark:hover:bg-[#252525] hover:text-notion-text dark:hover:text-gray-200'}`}
                title={isCollapsed ? "Клиенты и договора" : ""}
            >
                <Briefcase size={18} /> {!isCollapsed && <span className="text-sm">Клиенты и договора</span>}
            </div>

            {/* 3.2. Склад */}
            <div 
                onClick={() => handleNav(() => onNavigate('inventory'))}
                className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-2'} ${isCollapsed ? 'px-2' : 'px-3'} py-1.5 rounded cursor-pointer transition-colors ${currentView === 'inventory' ? 'bg-notion-hover dark:bg-[#252525] text-notion-text dark:text-white font-medium' : 'text-notion-text/70 dark:text-gray-400 hover:bg-notion-hover dark:hover:bg-[#252525] hover:text-notion-text dark:hover:text-gray-200'}`}
                title={isCollapsed ? "Склад" : ""}
            >
                <Layers size={18} /> {!isCollapsed && <span className="text-sm">Склад</span>}
            </div>

            {/* 4. Финансовое планирование */}
            <div 
                onClick={() => handleNav(() => onNavigate('finance'))}
                className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-2'} ${isCollapsed ? 'px-2' : 'px-3'} py-1.5 rounded cursor-pointer transition-colors ${currentView === 'finance' ? 'bg-notion-hover dark:bg-[#252525] text-notion-text dark:text-white font-medium' : 'text-notion-text/70 dark:text-gray-400 hover:bg-notion-hover dark:hover:bg-[#252525] hover:text-notion-text dark:hover:text-gray-200'}`}
                title={isCollapsed ? "Фин. планирование" : ""}
            >
                <Wallet size={18} /> {!isCollapsed && <span className="text-sm">Фин. планирование</span>}
            </div>

            {/* 5. Бизнес-процессы */}
            <div 
                onClick={() => handleNav(() => onNavigate('business-processes'))}
                className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-2'} ${isCollapsed ? 'px-2' : 'px-3'} py-1.5 rounded cursor-pointer transition-colors ${currentView === 'business-processes' ? 'bg-notion-hover dark:bg-[#252525] text-notion-text dark:text-white font-medium' : 'text-notion-text/70 dark:text-gray-400 hover:bg-notion-hover dark:hover:bg-[#252525] hover:text-notion-text dark:hover:text-gray-200'}`}
                title={isCollapsed ? "Бизнес-процессы" : ""}
            >
                <Network size={18} /> {!isCollapsed && <span className="text-sm">Бизнес-процессы</span>}
            </div>

            {/* 6. Встречи */}
            <div 
                onClick={() => handleNav(() => onNavigate('meetings'))}
                className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-2'} ${isCollapsed ? 'px-2' : 'px-3'} py-1.5 rounded cursor-pointer transition-colors ${currentView === 'meetings' ? 'bg-notion-hover dark:bg-[#252525] text-notion-text dark:text-white font-medium' : 'text-notion-text/70 dark:text-gray-400 hover:bg-notion-hover dark:hover:bg-[#252525] hover:text-notion-text dark:hover:text-gray-200'}`}
                title={isCollapsed ? "Встречи" : ""}
            >
                <Users size={18} /> {!isCollapsed && <span className="text-sm">Встречи</span>}
            </div>

            {/* 7. Документы */}
            <div 
                onClick={() => handleNav(() => onNavigate('docs'))}
                className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-2'} ${isCollapsed ? 'px-2' : 'px-3'} py-1.5 rounded cursor-pointer transition-colors ${currentView === 'docs' ? 'bg-notion-hover dark:bg-[#252525] text-notion-text dark:text-white font-medium' : 'text-notion-text/70 dark:text-gray-400 hover:bg-notion-hover dark:hover:bg-[#252525] hover:text-notion-text dark:hover:text-gray-200'}`}
                title={isCollapsed ? "Документы" : ""}
            >
                <FileText size={18} /> {!isCollapsed && <span className="text-sm">Документы</span>}
            </div>

            {/* Чат — только на мобилке (на десктопе/планшете открывается круглой кнопкой) */}
            <div 
                className={`md:hidden flex items-center ${isCollapsed ? 'justify-center' : 'gap-2'} ${isCollapsed ? 'px-2' : 'px-3'} py-1.5 rounded cursor-pointer transition-colors ${currentView === 'chat' ? 'bg-notion-hover dark:bg-[#252525] text-notion-text dark:text-white font-medium' : 'text-notion-text/70 dark:text-gray-400 hover:bg-notion-hover dark:hover:bg-[#252525] hover:text-notion-text dark:hover:text-gray-200'}`}
                onClick={() => handleNav(() => onNavigate('chat'))}
                title={isCollapsed ? "Чат" : ""}
            >
                <MessageCircle size={18} /> {!isCollapsed && <span className="text-sm">Чат</span>}
            </div>

            {/* 8. Сотрудники (только админ) */}
            {currentUser.role === Role.ADMIN && (
                <div 
                    onClick={() => handleNav(() => onNavigate('employees'))}
                    className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-2'} ${isCollapsed ? 'px-2' : 'px-3'} py-1.5 rounded cursor-pointer transition-colors ${currentView === 'employees' ? 'bg-notion-hover dark:bg-[#252525] text-notion-text dark:text-white font-medium' : 'text-notion-text/70 dark:text-gray-400 hover:bg-notion-hover dark:hover:bg-[#252525] hover:text-notion-text dark:hover:text-gray-200'}`}
                    title={isCollapsed ? "Сотрудники" : ""}
                >
                    <UserCheck size={18} /> {!isCollapsed && <span className="text-sm">Сотрудники</span>}
                </div>
            )}

            {/* 8.1. Аналитика и отчеты (под Сотрудники) */}
            <div 
                onClick={() => handleNav(() => onNavigate('analytics'))}
                className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-2'} ${isCollapsed ? 'px-2' : 'px-3'} py-1.5 rounded cursor-pointer transition-colors ${currentView === 'analytics' ? 'bg-notion-hover dark:bg-[#252525] text-notion-text dark:text-white font-medium' : 'text-notion-text/70 dark:text-gray-400 hover:bg-notion-hover dark:hover:bg-[#252525] hover:text-notion-text dark:hover:text-gray-200'}`}
                title={isCollapsed ? "Аналитика и отчеты" : ""}
            >
                <PieChart size={18} /> {!isCollapsed && <span className="text-sm">Аналитика и отчеты</span>}
            </div>

            {/* Админ-панель (только для администраторов) */}
            {currentUser.role === Role.ADMIN && (
                <div 
                    onClick={() => handleNav(() => onNavigate('admin'))}
                    className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-2'} ${isCollapsed ? 'px-2' : 'px-3'} py-1.5 rounded cursor-pointer transition-colors ${currentView === 'admin' ? 'bg-notion-hover dark:bg-[#252525] text-notion-text dark:text-white font-medium' : 'text-notion-text/70 dark:text-gray-400 hover:bg-notion-hover dark:hover:bg-[#252525] hover:text-notion-text dark:hover:text-gray-200'}`}
                    title={isCollapsed ? "Админ-панель" : ""}
                >
                    <ShieldCheck size={18} /> {!isCollapsed && <span className="text-sm">Админ-панель</span>}
                </div>
            )}
        </div>

        {/* Tables List with Grouping */}
        <div className={`${isCollapsed ? 'px-2' : 'px-3'} flex-1 overflow-y-auto custom-scrollbar min-h-0`}>
            {/* Контент планы, Беклог, Функционал */}
            {!isCollapsed && (
              <div className="space-y-0.5 mb-3">
                {/* Контент планы */}
                <div 
                  onClick={() => handleNav(() => onNavigateToType?.('content-plan'))}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded cursor-pointer transition-colors ${(currentView === 'spaces' && activeSpaceTab === 'content-plan') || (currentView === 'table' && activeTableId && tables.find(t => t.id === activeTableId)?.type === 'content-plan') ? 'bg-notion-hover dark:bg-[#252525] text-notion-text dark:text-white font-medium' : 'text-notion-text/70 dark:text-gray-400 hover:bg-notion-hover dark:hover:bg-[#252525] hover:text-notion-text dark:hover:text-gray-200'}`}
                >
                  <Instagram size={16} /> <span className="text-sm">Контент планы</span>
                </div>

                {/* Беклог */}
                <div 
                  data-nav-item="backlog"
                  onClick={() => handleNav(() => onNavigateToType?.('backlog'))}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded cursor-pointer transition-colors ${(currentView === 'spaces' && activeSpaceTab === 'backlog') || (currentView === 'table' && activeTableId && tables.find(t => t.id === activeTableId)?.type === 'backlog') ? 'bg-notion-hover dark:bg-[#252525] text-notion-text dark:text-white font-medium' : 'text-notion-text/70 dark:text-gray-400 hover:bg-notion-hover dark:hover:bg-[#252525] hover:text-notion-text dark:hover:text-gray-200'}`}
                >
                  <Archive size={16} /> <span className="text-sm">Беклог</span>
                </div>

                {/* Функционал */}
                <div 
                  data-nav-item="functionality"
                  onClick={() => handleNav(() => onNavigateToType?.('functionality'))}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded cursor-pointer transition-colors ${(currentView === 'spaces' && activeSpaceTab === 'functionality') || (currentView === 'table' && activeTableId && tables.find(t => t.id === activeTableId)?.type === 'functionality') ? 'bg-notion-hover dark:bg-[#252525] text-notion-text dark:text-white font-medium' : 'text-notion-text/70 dark:text-gray-400 hover:bg-notion-hover dark:hover:bg-[#252525] hover:text-notion-text dark:hover:text-gray-200'}`}
                >
                  <Layers size={16} /> <span className="text-sm">Функционал</span>
                </div>

                {/* Сайты */}
                <div 
                  data-nav-item="sites"
                  onClick={() => handleNav(() => onNavigate('sites'))}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded cursor-pointer transition-colors ${currentView === 'sites' ? 'bg-notion-hover dark:bg-[#252525] text-notion-text dark:text-white font-medium' : 'text-notion-text/70 dark:text-gray-400 hover:bg-notion-hover dark:hover:bg-[#252525] hover:text-notion-text dark:hover:text-gray-200'}`}
                >
                  <Globe size={16} /> <span className="text-sm">Сайты</span>
                </div>
              </div>
            )}

        </div>

        {/* Footer Settings */}
        {currentUser.role === Role.ADMIN && (
            <div className={`${isCollapsed ? 'p-2' : 'p-3'} mt-auto border-t border-notion-border dark:border-[#333] shrink-0 bg-white dark:bg-[#191919]`}>
                <button 
                    onClick={() => { handleNav(() => onOpenSettings()); }}
                    className={`w-full ${isCollapsed ? 'flex justify-center' : 'text-left flex items-center gap-2'} ${isCollapsed ? 'px-2' : 'px-3'} py-2 rounded cursor-pointer text-sm transition-colors font-medium ${currentView === 'settings' ? 'bg-notion-hover dark:bg-[#252525] text-notion-text dark:text-white' : 'text-notion-text dark:text-gray-300 hover:bg-notion-hover dark:hover:bg-[#252525]'}`}
                    title={isCollapsed ? "Настройки" : ""}
                >
                    <Settings size={18} />
                    {!isCollapsed && <span>Настройки</span>}
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

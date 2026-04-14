/**
 * AppLayout - основной layout приложения
 * 
 * Зачем отдельно:
 * - Единая структура приложения (Sidebar + Header + Content)
 * - Переиспользование на всех страницах
 * - Централизованное управление safe areas
 */
import React from 'react';
import Sidebar from '../Sidebar';
import { AppHeader } from '../AppHeader';
import { SafeAreaAll } from '../ui/SafeArea';
import { User, TableCollection, ActivityLog } from '../../types';

interface AppLayoutProps {
  children: React.ReactNode;
  // Sidebar props
  tables: TableCollection[];
  activeTableId?: string;
  currentView: string;
  currentUser: User;
  onSelectTable: (tableId: string) => void;
  onNavigate: (view: string) => void;
  onCreateTable: (type?: string) => void;
  onOpenSettings: () => void;
  onDeleteTable: (tableId: string) => void;
  onEditTable: (table: TableCollection) => void;
  unreadCount: number;
  activeSpaceTab?: 'content-plan' | 'backlog' | 'functionality';
  onNavigateToType: (type: 'content-plan' | 'backlog' | 'functionality') => void;
  // Header props
  darkMode: boolean;
  activeTable?: TableCollection;
  searchQuery: string;
  activityLogs: ActivityLog[];
  onToggleDarkMode: () => void;
  onSearchChange: (query: string) => void;
  onSearchFocus: () => void;
  onNavigateToInbox: () => void;
  onMarkAllRead: () => void;
  onLogout: () => void;
  onEditTableHeader: () => void;
  onMobileMenuToggle: () => void;
  // Mobile menu
  isMobileMenuOpen: boolean;
  onCloseMobileMenu: () => void;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  children,
  tables,
  activeTableId,
  currentView,
  currentUser,
  onSelectTable,
  onNavigate,
  onCreateTable,
  onOpenSettings,
  onDeleteTable,
  onEditTable,
  unreadCount,
  activeSpaceTab,
  onNavigateToType,
  darkMode,
  activeTable,
  searchQuery,
  activityLogs,
  onToggleDarkMode,
  onSearchChange,
  onSearchFocus,
  onNavigateToInbox,
  onMarkAllRead,
  onLogout,
  onEditTableHeader,
  onMobileMenuToggle,
  isMobileMenuOpen,
  onCloseMobileMenu,
}) => {
  return (
    <SafeAreaAll
      className={`flex h-screen w-full transition-colors duration-200 overflow-hidden ${
        darkMode ? 'dark bg-[#191919] text-gray-100' : 'bg-white text-gray-900'
      }`}
    >
      {/* Sidebar */}
      <Sidebar
        isOpen={isMobileMenuOpen}
        onClose={onCloseMobileMenu}
        tables={tables}
        activeTableId={activeTableId}
        onSelectTable={onSelectTable}
        onNavigate={onNavigate}
        currentView={currentView}
        currentUser={currentUser}
        onCreateTable={onCreateTable}
        onOpenSettings={onOpenSettings}
        onDeleteTable={onDeleteTable}
        onEditTable={onEditTable}
        unreadCount={unreadCount}
        activeSpaceTab={activeSpaceTab}
        onNavigateToType={onNavigateToType}
      />

      <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-[#191919] relative">
        {/* Header */}
        <AppHeader
          darkMode={darkMode}
          currentView={currentView}
          activeTable={activeTable}
          currentUser={currentUser}
          searchQuery={searchQuery}
          unreadNotificationsCount={unreadCount}
          activityLogs={activityLogs}
          onToggleDarkMode={onToggleDarkMode}
          onSearchChange={onSearchChange}
          onSearchFocus={onSearchFocus}
          onNavigateToInbox={onNavigateToInbox}
          onMarkAllRead={onMarkAllRead}
          onOpenSettings={onOpenSettings}
          onLogout={onLogout}
          onEditTable={onEditTableHeader}
          onMobileMenuToggle={onMobileMenuToggle}
        />

        {/* Main Content — flex + min-h-0 для корректного скролла до конца */}
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">{children}</div>
      </div>
    </SafeAreaAll>
  );
};

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
import { User, TableCollection } from '../../types';

interface AppLayoutProps {
  children: React.ReactNode;
  tables: TableCollection[];
  activeTableId?: string;
  currentView: string;
  currentUser: User;
  onSelectTable: (tableId: string) => void;
  onNavigate: (view: string) => void;
  onCreateTable: (type?: string) => void;
  onOpenSettings: (tab?: string) => void;
  onDeleteTable: (tableId: string) => void;
  onEditTable: (table: TableCollection) => void;
  unreadCount: number;
  activeSpaceTab?: 'content-plan' | 'backlog' | 'functionality';
  onNavigateToType: (type: 'content-plan' | 'backlog' | 'functionality') => void;
  darkMode: boolean;
  activeTable?: TableCollection;
  searchQuery: string;
  onToggleDarkMode: () => void;
  onSearchChange: (query: string) => void;
  onSearchFocus: () => void;
  onOpenSystemChat?: () => void;
  onLogout: () => void;
  onEditTableHeader: () => void;
  onMobileMenuToggle: () => void;
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
  onToggleDarkMode,
  onSearchChange,
  onSearchFocus,
  onOpenSystemChat,
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
      <Sidebar
        isOpen={isMobileMenuOpen}
        onClose={onCloseMobileMenu}
        tables={tables}
        activeTableId={activeTableId || ''}
        onSelectTable={onSelectTable}
        onNavigate={onNavigate as AppLayoutProps['onNavigate']}
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
        <AppHeader
          darkMode={darkMode}
          currentView={currentView}
          activeTable={activeTable}
          currentUser={currentUser}
          searchQuery={searchQuery}
          onToggleDarkMode={onToggleDarkMode}
          onSearchChange={onSearchChange}
          onSearchFocus={onSearchFocus}
          onOpenSystemChat={onOpenSystemChat}
          onOpenSettings={onOpenSettings}
          onLogout={onLogout}
          onEditTable={onEditTableHeader}
          onMobileMenuToggle={onMobileMenuToggle}
        />

        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">{children}</div>
      </div>
    </SafeAreaAll>
  );
};

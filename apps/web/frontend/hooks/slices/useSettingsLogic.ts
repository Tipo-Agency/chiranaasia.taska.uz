
import { useState, useEffect } from 'react';
import { TableCollection, ActivityLog, ViewMode, NotificationPreferences, AutomationRule } from '../../../types';
import { api } from '../../../backend/api';
import { DEFAULT_NOTIFICATION_PREFS } from '../../../constants';

export const useSettingsLogic = (showNotification: (msg: string) => void) => {
  const [darkMode, setDarkMode] = useState(false);
  const [tables, setTables] = useState<TableCollection[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreferences>(DEFAULT_NOTIFICATION_PREFS);
  const [automationRules, setAutomationRules] = useState<AutomationRule[]>([]);
  
  // UI Global State
  const [currentView, setCurrentView] = useState<
    | 'home'
    | 'tasks'
    | 'inbox'
    | 'search'
    | 'table'
    | 'doc-editor'
    | 'clients'
    | 'employees'
    | 'payroll'
    | 'sales-funnel'
    | 'client-chats'
    | 'finance'
    | 'business-processes'
    | 'production'
    | 'analytics'
    | 'settings'
    | 'spaces'
    | 'meetings'
    | 'docs'
    | 'inventory'
    | 'chat'
    | 'admin'
  >('home');
  const [activeTableId, setActiveTableId] = useState<string>('');
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.TABLE);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSpaceTab, setActiveSpaceTab] = useState<'content-plan' | 'backlog' | 'functionality' | undefined>(undefined);
  /** Вкладка рабочего стола (дашборд, календарь, документы …) */
  const [workdeskTab, setWorkdeskTab] = useState<
    'dashboard' | 'weekly' | 'tasks' | 'deals' | 'meetings' | 'documents'
  >('dashboard');
  /** Подраздел внутри «Воронка продаж»: воронка / диалоги / клиенты */
  const [crmHubTab, setCrmHubTab] = useState<'funnel' | 'chats' | 'clients'>('funnel');
  
  // Modals
  const [settingsActiveTab, setSettingsActiveTab] = useState<string>('users'); 

  const [isCreateTableModalOpen, setIsCreateTableModalOpen] = useState(false);
  const [createTableType, setCreateTableType] = useState<string | undefined>(undefined);
  const [isEditTableModalOpen, setIsEditTableModalOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<TableCollection | null>(null);

  useEffect(() => {
      const storedTheme = localStorage.getItem('theme');
      if (storedTheme === 'dark' || (!storedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
          setDarkMode(true);
      }
  }, []);

  useEffect(() => {
      if (darkMode) {
          document.documentElement.classList.add('dark');
          localStorage.setItem('theme', 'dark');
      } else {
          document.documentElement.classList.remove('dark');
          localStorage.setItem('theme', 'light');
      }
  }, [darkMode]);

  const toggleDarkMode = () => setDarkMode(!darkMode);

  const createTable = (name: string, type: any, icon: string, color: string) => {
      const newTable: TableCollection = {
        id: `t${Date.now()}`,
        name,
        type,
        icon,
        color,
        isSystem: false,
        isPublic: false,
      };
      const newTables = [...tables, newTable]; 
      setTables(newTables);
      api.tables.updateAll(newTables).catch(() => showNotification('Ошибка создания страницы')); 
      
      // Для пространств (content-plan, backlog, functionality) не переходим на table view, остаемся в spaces
      const isSpaceType = ['content-plan', 'backlog', 'functionality'].includes(type);
      if (!isSpaceType) {
          setActiveTableId(newTable.id); 
          setCurrentView('table');
      }
      
      setIsCreateTableModalOpen(false);
      setCreateTableType(undefined);
  };

  const updateTable = (updatedTable: TableCollection) => {
      const updatedTables = tables.map(t => t.id === updatedTable.id ? updatedTable : t);
      setTables(updatedTables);
      api.tables.updateAll(updatedTables).catch(() => showNotification('Ошибка сохранения страницы'));
      setIsEditTableModalOpen(false); setEditingTable(null); showNotification('Страница обновлена');
  };

  const deleteTable = async (id: string) => {
      const now = new Date().toISOString();
      // Мягкое удаление: помечаем таблицу как архивную
      const updated = tables.map(t => 
          t.id === id 
              ? { ...t, isArchived: true, updatedAt: now } 
              : { ...t, updatedAt: t.updatedAt || now }
      );
      setTables(updated);
      await api.tables.updateAll(updated).catch(() => showNotification('Ошибка архивации страницы'));
      if (activeTableId === id) setCurrentView('home');
      showNotification('Страница перемещена в архив');
  };

  const updateNotificationPrefs = (prefs: NotificationPreferences) => {
      setNotificationPrefs(prefs);
      const prefsUserId = (prefs as { id?: string })?.id;
      api.notificationPrefs.update(prefs, prefsUserId).catch(() => showNotification('Ошибка сохранения уведомлений'));
      showNotification('Настройки уведомлений сохранены');
  };

  const saveAutomationRule = (rule: AutomationRule) => {
      const normalized: AutomationRule = { ...rule, isArchived: rule.isArchived ?? false };
      const updated = automationRules.find(r => r.id === normalized.id)
          ? automationRules.map(r => r.id === normalized.id ? normalized : r)
          : [...automationRules, normalized];
      setAutomationRules(updated);
      api.automation.updateRules(updated).catch(() => showNotification('Ошибка сохранения правила'));
      showNotification('Правило сохранено');
  };

  const deleteAutomationRule = (id: string) => {
      const updated = automationRules.map((r) => (r.id === id ? { ...r, isArchived: true } : r));
      setAutomationRules(updated);
      api.automation.updateRules(updated).catch(() => showNotification('Ошибка удаления правила'));
      showNotification('Правило в архиве');
  };

  const markAllRead = () => {
      const u = activityLogs.map(l => ({ ...l, read: true }));
      setActivityLogs(u);
      api.activity.updateAll(u).catch(() => showNotification('Ошибка обновления ленты'));
  };

  const handleNavigate = (
    view:
      | 'home'
      | 'tasks'
      | 'inbox'
      | 'search'
      | 'clients'
      | 'employees'
      | 'payroll'
      | 'sales-funnel'
      | 'client-chats'
      | 'finance'
      | 'business-processes'
      | 'production'
      | 'analytics'
      | 'spaces'
      | 'meetings'
      | 'docs'
      | 'inventory'
      | 'chat'
      | 'admin'
      | 'settings'
  ) => {
    setActiveTableId('');
    if (view === 'meetings') {
      setWorkdeskTab('meetings');
      setCurrentView('home');
      return;
    }
    if (view === 'docs') {
      setWorkdeskTab('documents');
      setCurrentView('home');
      return;
    }
    if (view === 'clients') {
      setCrmHubTab('clients');
      setCurrentView('sales-funnel');
      return;
    }
    if (view === 'client-chats') {
      setCrmHubTab('chats');
      setCurrentView('sales-funnel');
      return;
    }
    if (view === 'inventory') {
      setCurrentView('inventory');
      return;
    }
    if (view === 'admin') {
      setSettingsActiveTab('admin');
      setCurrentView('settings');
      return;
    }
    if (view === 'analytics') {
      setCurrentView('home');
      return;
    }
    if (view === 'sales-funnel') {
      setCrmHubTab('funnel');
      setCurrentView('sales-funnel');
      return;
    }
    if (view === 'business-processes') {
      setCurrentView('business-processes');
      return;
    }
    if (view === 'production') {
      setCurrentView('production');
      return;
    }
    if (view === 'spaces') {
      setActiveSpaceTab((prev) => prev ?? 'content-plan');
      setCurrentView('spaces');
      return;
    }
    setCurrentView(view);
  };

  return {
    state: { 
        darkMode, tables, activityLogs, currentView, activeTableId, viewMode, searchQuery,
        settingsActiveTab, isCreateTableModalOpen, createTableType, isEditTableModalOpen, editingTable, notificationPrefs,
        automationRules, activeSpaceTab, workdeskTab, crmHubTab
    },
    setters: {
      setTables,
      setActivityLogs,
      setCurrentView,
      setActiveTableId,
      setViewMode,
      setSearchQuery,
      setNotificationPrefs,
      setAutomationRules,
      setActiveSpaceTab,
      setSettingsActiveTab,
      setWorkdeskTab,
      setCrmHubTab,
    },
    actions: {
        toggleDarkMode, createTable, updateTable, deleteTable, markAllRead, navigate: handleNavigate,
        // Changed: Opens settings page instead of modal
        openSettings: (tab: string = 'users') => { setSettingsActiveTab(tab); setCurrentView('settings'); setActiveTableId(''); }, 
        closeSettings: () => setCurrentView('home'),
        openCreateTable: (type?: string) => { setCreateTableType(type); setIsCreateTableModalOpen(true); }, 
        closeCreateTable: () => { setIsCreateTableModalOpen(false); setCreateTableType(undefined); },
        openEditTable: (t: TableCollection) => { setEditingTable(t); setIsEditTableModalOpen(true); }, closeEditTable: () => setIsEditTableModalOpen(false),
        updateNotificationPrefs,
        saveAutomationRule, deleteAutomationRule,
        setActiveSpaceTab
    }
  };
};

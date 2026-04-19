
import { useState, useEffect, useRef } from 'react';
import { api } from '../../backend/api';
import { 
  notifyDealCreated, 
  notifyDealStatusChanged, 
  notifyClientCreated, 
  notifyContractCreated, 
  notifyDocCreated, 
  notifyMeetingCreated, 
  notifyPurchaseRequestCreated,
  NotificationContext 
} from '../../services/notificationService';
import { Deal, Task, BusinessProcess, ProcessStep, Client, Contract, PurchaseRequest, Doc, Meeting, SalesFunnel, InboxMessage, MessageAttachment, User, ContentPost, Project, TableCollection, Department, FinanceCategory, EmployeeInfo, OrgPosition, AutomationRule, StatusOption, PriorityOption, ShootPlan, ProductionRoutePipeline, ProductionRouteOrder } from '../../types';
import { hasPermission } from '../../utils/permissions';
import { getStepsForInstance } from '../../utils/bpmDealFunnel';
import { chatLocalService } from '../../services/chatLocalService';
import { isFunnelDeal } from '../../utils/dealModel';

import { useAuthLogic } from './slices/useAuthLogic';
import { useTaskLogic } from './slices/useTaskLogic';
import { useCRMLogic } from './slices/useCRMLogic';
import { useContentLogic } from './slices/useContentLogic';
import { useSettingsLogic } from './slices/useSettingsLogic';
import { useFinanceLogic, type SavePurchaseRequestOptions } from './slices/useFinanceLogic';
import { useBPMLogic } from './slices/useBPMLogic';
import { useInventoryLogic } from './slices/useInventoryLogic';
import { STANDARD_FEATURES } from '../../components/FunctionalityView';
import { buildLocation, parseLocation } from '../../utils/urlSync';
import { normalizeCrmHubTab } from '../../types/crmHub';
import { devWarn } from '../../utils/devLog';
import { resolveAssigneesForOrgPosition } from '../../utils/orgPositionAssignee';
import { useAuthScopeStore } from '../stores/authScopeStore';
import { useUiToastStore } from '../stores/uiToastStore';
import {
  normalizeProductionOrder,
  normalizeProductionPipeline,
  pipelineToBulk,
} from '../../utils/productionRoutesNormalize';
import { normalizeInventoryItem } from '../../utils/inventoryNormalize';
// Функция заполнения тестовыми данными полностью удалена

export const useAppLogic = () => {
  const [isLoading, setIsLoading] = useState(true);
  const notification = useUiToastStore((s) => s.notification);
  const showNotification = useUiToastStore((s) => s.showNotification);
  const clearNotification = useUiToastStore((s) => s.clearNotification);
  /** Защита от повторной загрузки данных модулей (lazy load) — без лишнего state в React */
  const loadedModulesRef = useRef<Set<string>>(new Set());

  const settingsSlice = useSettingsLogic(showNotification);
  const authSlice = useAuthLogic(showNotification);
  const crmSlice = useCRMLogic(showNotification, () => authSlice.state.currentUser);
  const [salesFunnels, setSalesFunnels] = useState<SalesFunnel[]>([]);
  const [productionPipelines, setProductionPipelines] = useState<ProductionRoutePipeline[]>([]);
  const [productionBoardOrders, setProductionBoardOrders] = useState<ProductionRouteOrder[]>([]);
  const [inboxMessages, setInboxMessages] = useState<InboxMessage[]>([]);
  const [outboxMessages, setOutboxMessages] = useState<InboxMessage[]>([]);
  const contentSlice = useContentLogic(showNotification, settingsSlice.state.activeTableId);
  const taskSlice = useTaskLogic(showNotification, authSlice.state.currentUser, authSlice.state.users, settingsSlice.state.automationRules, contentSlice.state.docs, contentSlice.actions.saveDoc, settingsSlice.state.notificationPrefs);
  const financeSlice = useFinanceLogic(showNotification);
  const bpmSlice = useBPMLogic(showNotification);
  const inventorySlice = useInventoryLogic(showNotification);

  // Базовая загрузка - только критически важные данные для работы приложения
  // Уровень 0: Загрузка данных для аутентификации (только users)
  const loadAuthData = async (): Promise<boolean> => {
      try {
          const users = (await api.users.getAll()) as User[];
          if (users.length !== authSlice.state.users.length ||
              users.some(u => !authSlice.state.users.find(au => au.id === u.id))) {
            authSlice.actions.updateUsers(users, { persistRemote: false });
          } else {
            authSlice.setters.setUsers(users);
          }
          return true;
      } catch (error: any) {
          // Для незалогиненного пользователя 401 на /auth/users — ожидаемый сценарий.
          if (error?.message === 'Not authenticated') {
            return false;
          }
          console.error('[Auth] Error loading users:', error);
          console.error('[Auth] Error details:', {
              code: error?.code,
              message: error?.message,
              stack: error?.stack
          });
          return false;
      }
  };

  // Уровень 1a: минимум для первого кадра UI (без тяжёлых логов и производства)
  const loadMainDataCore = async () => {
      const [tables, notificationPrefs, automationRules, statuses, priorities, funnels] = await Promise.all([
          api.tables.getAll(),
          api.notificationPrefs.get(),
          api.automation.getRules(),
          api.statuses.getAll(),
          api.priorities.getAll(),
          api.funnels.getAll(),
      ]);
      settingsSlice.setters.setTables(tables);
      settingsSlice.setters.setNotificationPrefs(notificationPrefs);
      settingsSlice.setters.setAutomationRules(automationRules);
      taskSlice.setters.setStatuses(statuses);
      taskSlice.setters.setPriorities(priorities);
      setSalesFunnels(funnels);
  };

  // Уровень 1b: тяжёлое — не блокируем снятие лоадера; догружается сразу после core
  const loadMainDataHeavy = async () => {
      try {
          const [activityLogs, prodPipes, prodOrders] = await Promise.all([
              api.activity.getAll(),
              api.production.getPipelines().catch(() => []),
              api.production.getOrders().catch(() => []),
          ]);
          settingsSlice.setters.setActivityLogs(activityLogs);
          const pipes = (Array.isArray(prodPipes) ? prodPipes : [])
              .map(normalizeProductionPipeline)
              .filter((x): x is ProductionRoutePipeline => x != null && !x.isArchived);
          setProductionPipelines(pipes);
          const ords = (Array.isArray(prodOrders) ? prodOrders : [])
              .map(normalizeProductionOrder)
              .filter((x): x is ProductionRouteOrder => x != null && !x.isArchived);
          setProductionBoardOrders(ords);
      } catch (e) {
          devWarn('[loadMainDataHeavy]', e);
      }
  };

  // Уровень 2: Загрузка данных модуля Tasks (lazy loading)
  const loadTasksData = async () => {
      if (loadedModulesRef.current.has('tasks')) return; // Уже загружено
      const [tasks, projects] = await Promise.all([
          api.tasks.getAll(),
          api.projects.getAll(),
      ]);
      taskSlice.setters.setTasks(tasks);
      taskSlice.setters.setProjects(projects);
      loadedModulesRef.current.add('tasks');
  };

  // Уровень 2: Загрузка данных модуля CRM (lazy loading)
  const loadCRMData = async () => {
      if (loadedModulesRef.current.has('crm')) return; // Уже загружено
      const [clients, deals, contracts, oneTimeDeals, accountsReceivable, employees] = await Promise.all([
          api.clients.getAll(),
          api.deals.getAll(),
          api.contracts.getAll(),
          api.oneTimeDeals.getAll(),
          api.accountsReceivable.getAll(),
          api.employees.getAll(),
      ]);
      crmSlice.setters.setClients(clients);
      crmSlice.setters.setDeals(deals);
      crmSlice.setters.setContracts(contracts);
      crmSlice.setters.setOneTimeDeals(oneTimeDeals);
      crmSlice.setters.setAccountsReceivable(accountsReceivable);
      crmSlice.setters.setEmployeeInfos(employees);
      loadedModulesRef.current.add('crm');
  };

  // Уровень 2: Загрузка данных модуля Content (lazy loading)
  const loadContentData = async () => {
      if (loadedModulesRef.current.has('content')) return; // Уже загружено
      const [docs, folders, meetings, contentPosts, shootPlans] = await Promise.all([
          api.docs.getAll(),
          api.folders.getAll(),
          api.meetings.getAll(),
          api.contentPosts.getAll(),
          api.shootPlans.getAll(),
      ]);
      // Не фильтруем архивные элементы - они нужны для архива, фильтрация происходит в компонентах
      contentSlice.setters.setDocs(docs);
      contentSlice.setters.setFolders(folders);
      contentSlice.setters.setMeetings(meetings);
      contentSlice.setters.setContentPosts(contentPosts);
      contentSlice.setters.setShootPlans(shootPlans as ShootPlan[]);
      loadedModulesRef.current.add('content');
  };

  // Загрузка сообщений входящие/исходящие (для главной)
  const loadMessages = async () => {
    const uid = authSlice.state.currentUser?.id;
    if (!uid) return;
    try {
      const [inbox, outbox] = await Promise.all([
        api.messages.getInbox(uid),
        api.messages.getOutbox(uid),
      ]);
      setInboxMessages((inbox || []) as InboxMessage[]);
      setOutboxMessages((outbox || []) as InboxMessage[]);
    } catch (e) {
      devWarn('[Messages] load failed', e);
    }
  };

  // Уровень 2: Загрузка данных модуля Finance (lazy loading)
  const loadFinanceData = async () => {
      if (loadedModulesRef.current.has('finance')) return; // Уже загружено
      const [departments, categories, plan, requests, planDocs, plannings, incReports] = await Promise.all([
          api.departments.getAll(),
          api.finance.getCategories(),
          api.finance.getPlan(),
          api.finance.getRequestsAll(),
          api.finance.getFinancialPlanDocuments(),
          api.finance.getFinancialPlannings(),
          api.finance.getIncomeReports(),
      ]);
      financeSlice.setters.setDepartments(departments);
      financeSlice.setters.setFinanceCategories(categories);
      financeSlice.setters.setFinancePlan(plan);
      financeSlice.setters.setPurchaseRequests(requests);
      financeSlice.setters.setFinancialPlanDocuments(planDocs);
      financeSlice.setters.setFinancialPlannings(plannings);
      financeSlice.setters.setIncomeReports(incReports || []);
      await financeSlice.actions.loadBdr();
      loadedModulesRef.current.add('finance');
  };

  // Уровень 2: Загрузка данных модуля BPM (lazy loading)
  const loadBPMData = async () => {
      if (loadedModulesRef.current.has('bpm')) return; // Уже загружено
      const [positions, processes] = await Promise.all([
          api.bpm.getPositions(),
          api.bpm.getProcesses(),
      ]);
      bpmSlice.setters.setOrgPositions(positions);
      bpmSlice.setters.setBusinessProcesses(processes as BusinessProcess[]);
      loadedModulesRef.current.add('bpm');
  };

  // Уровень 2: Загрузка данных модуля Inventory (lazy loading)
  const loadInventoryData = async () => {
      if (loadedModulesRef.current.has('inventory')) return;
      const [warehouses, items, movements, revisions] = await Promise.all([
          api.inventory.getWarehouses(),
          api.inventory.getItems(),
          api.inventory.getMovements(),
          api.inventory.getRevisions(),
      ]);
      inventorySlice.setters.setWarehouses(warehouses);
      inventorySlice.setters.setItems(
        Array.isArray(items) ? items.map((row) => normalizeInventoryItem(row)) : []
      );
      inventorySlice.setters.setMovements(movements);
      inventorySlice.setters.setRevisions(revisions);
      loadedModulesRef.current.add('inventory');
  };

  // Обновление данных модуля (перезагрузка из локального хранилища)
  const refreshModuleData = async (module: string) => {
      switch (module) {
          case 'tasks':
              await loadTasksData();
              break;
          case 'crm':
              await loadCRMData();
              break;
          case 'content':
              await loadContentData();
              break;
          case 'finance':
              await loadFinanceData();
              break;
          case 'bpm':
              await loadBPMData();
              break;
          case 'inventory':
              await loadInventoryData();
              break;
      }
  };

  // Инициализация приложения - поэтапная загрузка (фавикон задаётся из `primaryColor` в applyOrgBrandingToDocument)
  useEffect(() => {
    const initApp = async () => { 
      setIsLoading(true); 
      
      try {
        // Уровень 0: Загружаем только данные для аутентификации
        const isAuthenticated = await loadAuthData();
        if (!isAuthenticated) {
          setIsLoading(false);
          return;
        }
        // Сначала лёгкий пакет — быстрее снимаем лоадер; лог активности и производство — сразу после
        await loadMainDataCore();
        setIsLoading(false);
        void loadMainDataHeavy();
      } catch (err) {
        console.error('Ошибка загрузки данных:', err);
        showNotification('Ошибка загрузки данных.');
        setIsLoading(false);
      }
    };
    initApp();
  }, []);

  const didHydrateUrlRef = useRef(false);
  const ignoreNextUrlSyncRef = useRef(false);

  // Сброс тоста при смене раздела (первый ренер пропускаем — иначе сбросим до показа)
  const toastClearAfterNavRef = useRef(false);
  useEffect(() => {
    if (!toastClearAfterNavRef.current) {
      toastClearAfterNavRef.current = true;
      return;
    }
    clearNotification();
  }, [settingsSlice.state.currentView, clearNotification]);

  useEffect(() => {
    useAuthScopeStore.getState().setCurrentUserId(authSlice.state.currentUser?.id ?? null);
  }, [authSlice.state.currentUser?.id]);

  useEffect(() => {
    if (!authSlice.state.currentUser) {
      didHydrateUrlRef.current = false;
    }
  }, [authSlice.state.currentUser]);

  useEffect(() => {
    const uid = authSlice.state.currentUser?.id;
    if (!uid) return;
    api.notificationPrefs
      .get(uid)
      .then((prefs) => settingsSlice.setters.setNotificationPrefs(prefs as any))
      .catch(() => {});
  }, [authSlice.state.currentUser?.id]);

  // Один раз после входа: восстановить раздел из URL (F5 остаётся на /tasks и т.д.)
  useEffect(() => {
    if (isLoading || !authSlice.state.currentUser) return;
    if (didHydrateUrlRef.current) return;
    const parsed = parseLocation(window.location.pathname, window.location.search);
    didHydrateUrlRef.current = true;
    if (!parsed) {
      if (window.location.pathname !== '/' && window.location.pathname !== '') {
        window.history.replaceState(null, '', '/');
      }
      return;
    }
    ignoreNextUrlSyncRef.current = true;
    if (parsed.view === 'table' && parsed.activeTableId) {
      settingsSlice.setters.setActiveTableId(parsed.activeTableId);
      settingsSlice.setters.setCurrentView('table');
    } else {
      settingsSlice.setters.setActiveTableId('');
      settingsSlice.setters.setCurrentView(parsed.view as typeof settingsSlice.state.currentView);
    }
    if (parsed.activeSpaceTab) {
      settingsSlice.setters.setActiveSpaceTab(parsed.activeSpaceTab);
    }
    if (parsed.settingsTab) {
      settingsSlice.setters.setSettingsActiveTab(parsed.settingsTab);
    }
    if (parsed.workdeskTab) {
      settingsSlice.setters.setWorkdeskTab(parsed.workdeskTab);
    }
    if (parsed.crmHubTab) {
      settingsSlice.setters.setCrmHubTab(normalizeCrmHubTab(parsed.crmHubTab));
    }
    if (parsed.view === 'employees') {
      settingsSlice.setters.setEmployeesHubTab(parsed.employeesHubTab === 'payroll' ? 'payroll' : 'team');
    }
  }, [isLoading, authSlice.state.currentUser]);

  // Адресная строка следует за состоянием (клик по меню и т.д.)
  useEffect(() => {
    if (isLoading || !authSlice.state.currentUser) return;
    if (!didHydrateUrlRef.current) return;
    if (ignoreNextUrlSyncRef.current) {
      ignoreNextUrlSyncRef.current = false;
      return;
    }
    const next =
      window.location.pathname +
      (window.location.search || '');
    const built = buildLocation({
      currentView: settingsSlice.state.currentView,
      activeTableId: settingsSlice.state.activeTableId,
      activeSpaceTab: settingsSlice.state.activeSpaceTab,
      settingsActiveTab: settingsSlice.state.settingsActiveTab,
      workdeskTab: settingsSlice.state.workdeskTab,
      crmHubTab: settingsSlice.state.crmHubTab,
      employeesHubTab: settingsSlice.state.employeesHubTab,
    });
    if (next === built) return;
    window.history.pushState(null, '', built);
  }, [
    isLoading,
    authSlice.state.currentUser,
    settingsSlice.state.currentView,
    settingsSlice.state.activeTableId,
    settingsSlice.state.activeSpaceTab,
    settingsSlice.state.settingsActiveTab,
    settingsSlice.state.workdeskTab,
    settingsSlice.state.crmHubTab,
    settingsSlice.state.employeesHubTab,
  ]);

  useEffect(() => {
    const onPop = () => {
      const parsed = parseLocation(window.location.pathname, window.location.search);
      if (!parsed) return;
      ignoreNextUrlSyncRef.current = true;
      if (parsed.view === 'table' && parsed.activeTableId) {
        settingsSlice.setters.setActiveTableId(parsed.activeTableId);
        settingsSlice.setters.setCurrentView('table');
      } else {
        settingsSlice.setters.setActiveTableId('');
        settingsSlice.setters.setCurrentView(parsed.view as typeof settingsSlice.state.currentView);
      }
      if (parsed.activeSpaceTab) {
        settingsSlice.setters.setActiveSpaceTab(parsed.activeSpaceTab);
      } else if (parsed.view === 'spaces') {
        settingsSlice.setters.setActiveSpaceTab(undefined);
      }
      if (parsed.settingsTab) {
        settingsSlice.setters.setSettingsActiveTab(parsed.settingsTab);
      }
      if (parsed.workdeskTab) {
        settingsSlice.setters.setWorkdeskTab(parsed.workdeskTab);
      }
      if (parsed.crmHubTab) {
        settingsSlice.setters.setCrmHubTab(normalizeCrmHubTab(parsed.crmHubTab));
      }
      if (parsed.view === 'employees') {
        settingsSlice.setters.setEmployeesHubTab(parsed.employeesHubTab === 'payroll' ? 'payroll' : 'team');
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Данные хранятся локально, загружаются по требованию

  // Ленивая загрузка данных при открытии разделов (Уровень 2)
  useEffect(() => {
    if (!authSlice.state.currentUser) return;
    const currentView = settingsSlice.state.currentView;
    
    // Определяем, какие данные нужно загрузить в зависимости от текущего представления
    const loadData = async () => {
      switch (currentView) {
          case 'home': {
              // Только то, что нужно активной вкладке рабочего стола — иначе четыре тяжёлых модуля + сообщения каждый раз.
              const tab = settingsSlice.state.workdeskTab;
              const loads: Promise<void>[] = [];
              switch (tab) {
                case 'meetings':
                  loads.push(loadContentData(), loadTasksData(), loadCRMData());
                  break;
                case 'documents':
                  loads.push(loadContentData(), loadTasksData());
                  break;
                case 'dashboard':
                default:
                  loads.push(
                    loadTasksData(),
                    loadContentData(),
                    loadFinanceData(),
                    loadCRMData(),
                  );
              }
              await Promise.all(loads);
              void loadMessages();
              break;
          }
          case 'tasks':
          case 'search':
          case 'analytics':
          case 'spaces':
              await loadTasksData();
              if (currentView === 'analytics') {
                  await loadCRMData(); // для deals и contracts в аналитике
              }
              break;
          case 'sales-funnel':
          case 'clients':
          case 'client-chats':
              await Promise.all([
                  loadTasksData(), // Tasks нужны для CRM модуля
                  loadCRMData(),
              ]);
              break;
          case 'finance':
              await loadFinanceData();
              break;
          case 'settings':
              // Для архива нужны подразделения, категории, воронки и т.д.
              // Склады (Structure → склады) живут в inventory slice и раньше подгружались
              // только при заходе в модуль «Склад», из‑за чего список складов в настройках был пуст.
              await Promise.all([
                  loadFinanceData(),
                  loadCRMData(),
                  loadContentData(),
                  loadBPMData(),
                  loadInventoryData(),
              ]);
              break;
          case 'employees':
          case 'business-processes':
              await Promise.all([
                  loadTasksData(), // Tasks нужны для HR модуля
                  loadBPMData(),
                  loadCRMData(), // EmployeeInfos находятся в CRM
              ]);
              break;
          case 'meetings':
          case 'docs':
          case 'table':
              // Для table проверяем тип активной таблицы
              const activeTable = settingsSlice.state.tables.find(t => t.id === settingsSlice.state.activeTableId);
              if (activeTable?.type === 'content-plan') {
                  await loadContentData();
              } else {
                  await loadTasksData();
              }
              break;
          case 'inventory':
              await loadInventoryData();
              break;
          case 'inbox':
          case 'chat':
              await loadTasksData();
              void loadMessages();
              break;
          case 'admin':
              await loadTasksData();
              break;
      }
    };
    
    loadData().catch(err => {
      console.error('Ошибка загрузки данных модуля:', err);
    });
  }, [
    settingsSlice.state.currentView,
    settingsSlice.state.activeTableId,
    settingsSlice.state.workdeskTab,
    authSlice.state.currentUser,
  ]);

  // Обработчик синхронизации контент-плана
  useEffect(() => {
      if (!authSlice.state.currentUser) return;
      const handleContentPlanSync = async () => {
          const activeTable = settingsSlice.state.tables.find(t => t.id === settingsSlice.state.activeTableId);
          if (activeTable?.type === 'content-plan') {
              try {
                  const [contentPosts, shootPlans, meetings] = await Promise.all([
                      api.contentPosts.getAll(),
                      api.shootPlans.getAll(),
                      api.meetings.getAll(),
                  ]);
                  contentSlice.setters.setContentPosts(contentPosts);
                  contentSlice.setters.setShootPlans(shootPlans as ShootPlan[]);
                  contentSlice.setters.setMeetings(meetings as Meeting[]);
              } catch (error) {
                  console.error('Ошибка обновления контент-плана:', error);
              }
          }
      };

      window.addEventListener('contentPlanSync', handleContentPlanSync);
      return () => {
          window.removeEventListener('contentPlanSync', handleContentPlanSync);
      };
  }, [settingsSlice.state.activeTableId, settingsSlice.state.tables, authSlice.state.currentUser]);

  const saveDocWrapper = (docData: any) => {
      // Для документов не требуется tableId - находим системную таблицу docs или используем пустую строку
      const docsTable = settingsSlice.state.tables.find(t => t.type === 'docs' && t.isSystem) || 
                       settingsSlice.state.tables.find(t => t.type === 'docs');
      const targetTableId = docsTable?.id || '';
      
      const existing = docData.id ? contentSlice.state.docs.find(d => d.id === docData.id) : null;
      const newDoc = contentSlice.actions.saveDoc(docData, targetTableId, docData.folderId);
      if (newDoc && !existing && authSlice.state.currentUser) {
        const context: NotificationContext = {
          currentUser: authSlice.state.currentUser,
          allUsers: authSlice.state.users,
          notificationPrefs: settingsSlice.state.notificationPrefs
        };
        notifyDocCreated(newDoc, { context }).catch(() => {});
      }
      // Обновляем данные модуля после сохранения
      if (loadedModulesRef.current.has('content')) {
          refreshModuleData('content').catch(err => console.error('Ошибка обновления данных модуля:', err));
      }
      if (docData.type === 'internal') { 
          contentSlice.setters.setActiveDocId(newDoc.id); 
          settingsSlice.setters.setCurrentView('doc-editor'); 
      }
      // Закрываем модалку явно
      contentSlice.actions.closeDocModal();
  };

  const handleDocClickWrapper = (doc: any) => {
      const result = contentSlice.actions.handleDocClick(doc);
      if (result === 'doc-editor') settingsSlice.setters.setCurrentView('doc-editor');
  };

  // Обертка для createTable с автоматическим созданием стандартных функций для functionality
  const createTableWrapper = (name: string, type: any, icon: string, color: string) => {
      // Создаем таблицу
      settingsSlice.actions.createTable(name, type, icon, color);
      
      // Если это functionality таблица, создаем стандартные функции
      if (type === 'functionality') {
          // Используем setTimeout чтобы дать время на обновление состояния
          setTimeout(() => {
              // Находим только что созданную таблицу
              const newTable = settingsSlice.state.tables.find(t => 
                  t.name === name && 
                  t.type === 'functionality' && 
                  !t.isSystem
              );
              
              if (newTable) {
                  const statuses = taskSlice.state.statuses;
                  const priorities = taskSlice.state.priorities;
                  
                  // Находим статус "Не начато" или первый статус, который не "Выполнено"
                  const defaultStatus = statuses.find(s => s.name === 'Не начато')?.name || 
                                       statuses.find(s => s.name !== 'Выполнено' && s.name !== 'Done')?.name || 
                                       statuses[0]?.name || 
                                       'Не начато';
                  
                  const defaultPriority = priorities.find(p => p.name === 'Средний')?.name || 
                                          priorities[0]?.name || 
                                          'Средний';
                  
                  // Создаем стандартные функции
                  STANDARD_FEATURES.forEach((standardFeature, index) => {
                      setTimeout(() => {
                          const newTask: Partial<Task> = {
                              entityType: 'feature', // Устанавливаем entityType для функций
                              tableId: newTable.id,
                              title: standardFeature.title,
                              description: standardFeature.description,
                              status: defaultStatus, // Явно устанавливаем статус "Не начато"
                              priority: defaultPriority,
                              assigneeId: null,
                              startDate: new Date().toISOString().split('T')[0],
                              endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                              category: standardFeature.category,
                          };
                          taskSlice.actions.saveTask(newTask, newTable.id);
                      }, index * 100); // Небольшая задержка между созданием функций
                  });
                  
                  showNotification(`Создан функционал "${name}" с ${STANDARD_FEATURES.length} стандартными функциями`);
              }
          }, 200);
      }
  };

  // Обертка для saveTask с обработкой бизнес-процессов
  const saveTaskWrapper = (taskData: Partial<Task>) => {
      // Получаем старую задачу ДО сохранения
      const oldTask = taskData.id ? taskSlice.state.tasks.find(t => t.id === taskData.id) : null;
      const wasCompleted = oldTask && (oldTask.status === 'Выполнено' || oldTask.status === 'Done');
      const isNowCompleted = taskData.status && (taskData.status === 'Выполнено' || taskData.status === 'Done');
      
      // Используем tableId из задачи, если он есть, иначе activeTableId
      const targetTableId = taskData.tableId || settingsSlice.state.activeTableId;
      
      // Сохраняем задачу
      taskSlice.actions.saveTask(taskData, targetTableId);

      // Новая задача — пишем в «Систему» (включая случай «сам себе»)
      if (!oldTask && authSlice.state.currentUser && taskData.assigneeId) {
          const tid = taskData.id;
          const isSelfAssigned = taskData.assigneeId === authSlice.state.currentUser.id;
          if (!isSelfAssigned) {
            chatLocalService.addSystemMessageForEntity({
                actorId: authSlice.state.currentUser.id,
                targetUserId: taskData.assigneeId,
                text: `Я поставил тебе задачу: ${taskData.title || 'без названия'}`,
                entityType: 'task',
                entityId: tid,
            });
          }
          if (tid) {
            chatLocalService.addSystemFeedMessage({
              targetUserId: taskData.assigneeId,
              text: isSelfAssigned
                ? `Создана новая задача: ${taskData.title || 'без названия'}`
                : `${authSlice.state.currentUser.name} назначил вам задачу: ${taskData.title || 'без названия'}`,
              entityType: 'task',
              entityId: tid,
            });
            if (!isSelfAssigned) {
              chatLocalService.addSystemFeedMessage({
                targetUserId: authSlice.state.currentUser.id,
                text: `Вы назначили задачу ${authSlice.state.users.find((u) => u.id === taskData.assigneeId)?.name || 'сотруднику'}: ${taskData.title || 'без названия'}`,
                entityType: 'task',
                entityId: tid,
              });
            }
          }
      }
      
      // Если задача процесса только что выполнена - переходим к следующему шагу или ожидаем выбор ветки
      if (oldTask && oldTask.processId && oldTask.processInstanceId && oldTask.stepId && !wasCompleted && isNowCompleted) {
          const process = bpmSlice.state.businessProcesses.find(p =>
              p.id === oldTask.processId && p.instances?.some(i => i.id === oldTask.processInstanceId)
          );
          if (process) {
              const instance = process.instances!.find(i => i.id === oldTask.processInstanceId);
              if (instance && instance.status === 'active') {
                  const steps = getStepsForInstance(process, instance);
                  const currentStep = steps.find(s => s.id === instance.currentStepId);
                  if (!currentStep) return;

                  // Отмечаем шаг как выполненный в истории экземпляра
                  const completedSet = new Set(instance.completedStepIds || []);
                  completedSet.add(currentStep.id);

                  // Шаг с вариантами: ожидаем выбор ветки (UI покажет модалку)
                  if (currentStep.stepType === 'variant' && currentStep.branches && currentStep.branches.length > 0) {
                      const updatedInstance = {
                          ...instance,
                          currentStepId: null,
                          pendingBranchSelection: { stepId: currentStep.id },
                          completedStepIds: Array.from(completedSet)
                      };
                      const updatedProcess: BusinessProcess = {
                          ...process,
                          instances: process.instances?.map(i => i.id === instance.id ? updatedInstance : i) || [updatedInstance]
                      };
                      bpmSlice.actions.saveProcess(updatedProcess);
                      showNotification('Выберите вариант перехода в карточке экземпляра процесса');
                      return;
                  }

                  const currentStepIndex = steps.findIndex(s => s.id === instance.currentStepId);
                  const nextStep: ProcessStep | undefined = currentStep.nextStepId
                      ? steps.find(s => s.id === currentStep.nextStepId)
                      : steps[currentStepIndex + 1];

                  const dealForInstance = instance.dealId
                      ? crmSlice.state.deals.find(d => d.id === instance.dealId)
                      : undefined;

                  if (nextStep) {
                      const tasksTable = settingsSlice.state.tables.find(t => t.type === 'tasks');
                      if (tasksTable) {
                          let nextAssigneeId: string | null = null;
                          let nextAssigneeIds: string[] | undefined;
                          if (nextStep.assigneeType === 'position') {
                              const position = bpmSlice.state.orgPositions.find(p => p.id === nextStep.assigneeId);
                              const resolved = resolveAssigneesForOrgPosition(position, crmSlice.state.employeeInfos);
                              nextAssigneeId = resolved.assigneeId;
                              nextAssigneeIds = resolved.assigneeIds;
                              if (resolved.positionPatch && position) {
                                  bpmSlice.actions.savePosition({ ...position, ...resolved.positionPatch });
                              }
                          } else {
                              nextAssigneeId = nextStep.assigneeId || null;
                          }

                          if (nextAssigneeId) {
                              const isDealFunnel = !!instance.dealId;
                              const taskTitle = isDealFunnel && dealForInstance
                                  ? `${dealForInstance.title}: ${nextStep.title}`
                                  : `${process.title}: ${nextStep.title}`;
                              const nextTask: Partial<Task> = {
                                  id: `task-${Date.now()}`,
                                  tableId: tasksTable.id,
                                  title: taskTitle,
                                  description: nextStep.description || '',
                                  status: 'Не начато',
                                  priority: 'Средний',
                                  assigneeId: nextAssigneeId,
                                  assigneeIds: nextAssigneeIds,
                                  startDate: new Date().toISOString().split('T')[0],
                                  endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                                  processId: process.id,
                                  processInstanceId: instance.id,
                                  stepId: nextStep.id,
                                  dealId: instance.dealId,
                                  source: isDealFunnel ? 'Сделка' : 'Процесс',
                                  entityType: 'task',
                                  createdByUserId: authSlice.state.currentUser?.id,
                              };

                              taskSlice.actions.saveTask(nextTask, tasksTable.id);

                              if (instance.dealId && dealForInstance) {
                                  crmSlice.actions.saveDeal({ ...dealForInstance, stage: nextStep.id });
                              }

                              const feedUserIds =
                                  nextAssigneeIds && nextAssigneeIds.length > 0
                                      ? nextAssigneeIds
                                      : nextAssigneeId
                                        ? [nextAssigneeId]
                                        : [];
                              const cur = authSlice.state.currentUser?.id;
                              for (const uid of feedUserIds) {
                                  if (nextTask.id && uid && cur && uid !== cur) {
                                      chatLocalService.addSystemFeedMessage({
                                          targetUserId: uid,
                                          text: `Новая задача по сделке: ${taskTitle}`,
                                          entityType: 'task',
                                          entityId: nextTask.id,
                                      });
                                  }
                              }

                              const updatedInstance = {
                                  ...instance,
                                  currentStepId: nextStep.id,
                                  taskIds: [...instance.taskIds, nextTask.id!],
                                  completedStepIds: Array.from(completedSet)
                              };

                              const updatedProcess: BusinessProcess = {
                                  ...process,
                                  instances: process.instances?.map(i => i.id === instance.id ? updatedInstance : i) || [updatedInstance]
                              };

                              bpmSlice.actions.saveProcess(updatedProcess);
                              showNotification(`Процесс перешёл к шагу: ${nextStep.title}`);
                          }
                      }
                  } else {
                      if (instance.dealId && dealForInstance) {
                          crmSlice.actions.saveDeal({ ...dealForInstance, stage: currentStep.id });
                      }
                      const updatedInstance = {
                          ...instance,
                          status: 'completed' as const,
                          completedAt: new Date().toISOString(),
                          currentStepId: null
                      };

                      const updatedProcess: BusinessProcess = {
                          ...process,
                          instances: process.instances?.map(i => i.id === instance.id ? updatedInstance : i) || [updatedInstance]
                      };

                      bpmSlice.actions.saveProcess(updatedProcess);
                      showNotification(`Процесс «${process.title}» завершён!`);
                  }
              }
          }
      }
  };

  const isDoneStatus = (status?: string) => status === 'Выполнено' || status === 'Done' || status === 'Завершено';

  const syncDealStageTasks = (oldDeal: Deal | undefined, newDeal: Deal, actorUserId: string) => {
      const funnel = salesFunnels.find((f) => f.id === newDeal.funnelId) || salesFunnels[0];
      const tasksTable = settingsSlice.state.tables.find((t) => t.type === 'tasks');
      if (!funnel || !tasksTable) return;

      const targetStageId = newDeal.stage || funnel.stages?.[0]?.id;
      if (!targetStageId) return;
      const stage = funnel.stages.find((s) => s.id === targetStageId);
      const template = stage?.taskTemplate;
      const shouldCreate = template?.enabled !== false;
      const taskTitle = (template?.title || '').trim() || `Сделка: ${stage?.label || targetStageId}`;
      const stageChanged = !!oldDeal && oldDeal.stage !== newDeal.stage;
      const isCreated = !oldDeal;
      if (!isCreated && !stageChanged) return;

      const relatedTasks = taskSlice.state.tasks.filter((t) => !t.isArchived && t.dealId === newDeal.id && t.source === 'Сделка');
      relatedTasks.forEach((t) => {
          if (!isDoneStatus(t.status) && t.stepId && t.stepId !== targetStageId) {
              taskSlice.actions.saveTask({ ...t, status: 'Выполнено' }, tasksTable.id);
          }
      });

      if (!shouldCreate) return;
      const sameStageActive = relatedTasks.some((t) => t.stepId === targetStageId && !isDoneStatus(t.status));
      if (sameStageActive) return;

      const assigneeId =
          template?.assigneeMode === 'specific_user'
              ? (template.assigneeUserId || null)
              : (newDeal.assigneeId || actorUserId || null);
      if (!assigneeId) return;

      const nowIso = new Date().toISOString();
      const taskId = `task-${Date.now()}`;
      taskSlice.actions.saveTask(
          {
              id: taskId,
              entityType: 'task',
              tableId: tasksTable.id,
              title: `${newDeal.title || 'Сделка'}: ${taskTitle}`,
              description: '',
              status: 'Не начато',
              priority: 'Средний',
              assigneeId,
              source: 'Сделка',
              startDate: nowIso.slice(0, 10),
              endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
              stepId: targetStageId,
              dealId: newDeal.id,
              createdAt: nowIso,
              createdByUserId: actorUserId,
          },
          tasksTable.id
      );
      if (assigneeId !== actorUserId) {
          chatLocalService.addSystemFeedMessage({
              targetUserId: assigneeId,
              text: `Новая задача по сделке «${newDeal.title || 'Без названия'}»: ${taskTitle}`,
              entityType: 'task',
              entityId: taskId,
          });
      }
  };

  /** Завершить шаг с вариантами — создать задачу для выбранной ветки */
  const completeProcessStepWithBranch = (instanceId: string, nextStepId: string) => {
      const allProcs = bpmSlice.state.businessProcesses;
      for (const process of allProcs) {
          const instance = process.instances?.find(i => i.id === instanceId);
          if (!instance || !instance.pendingBranchSelection) continue;

          const steps = getStepsForInstance(process, instance);
          const nextStep = steps.find(s => s.id === nextStepId);
          if (!nextStep) return;

          const tasksTable = settingsSlice.state.tables.find(t => t.type === 'tasks');
          if (!tasksTable) return;

          let assigneeId: string | null = null;
          let assigneeIds: string[] | undefined;
          if (nextStep.assigneeType === 'position') {
              const position = bpmSlice.state.orgPositions.find(p => p.id === nextStep.assigneeId);
              const resolved = resolveAssigneesForOrgPosition(position, crmSlice.state.employeeInfos);
              assigneeId = resolved.assigneeId;
              assigneeIds = resolved.assigneeIds;
              if (resolved.positionPatch && position) {
                  bpmSlice.actions.savePosition({ ...position, ...resolved.positionPatch });
              }
          } else {
              assigneeId = nextStep.assigneeId || null;
          }

          if (!assigneeId) return;

          const fromStepId = instance.pendingBranchSelection.stepId;

          const dealForInstance = instance.dealId
              ? crmSlice.state.deals.find(d => d.id === instance.dealId)
              : undefined;
          const isDealFunnel = !!instance.dealId;
          const taskTitle = isDealFunnel && dealForInstance
              ? `${dealForInstance.title}: ${nextStep.title}`
              : `${process.title}: ${nextStep.title}`;

          const nextTask: Partial<Task> = {
              id: `task-${Date.now()}`,
              tableId: tasksTable.id,
              title: taskTitle,
              description: nextStep.description || '',
              status: 'Не начато',
              priority: 'Средний',
              assigneeId,
              assigneeIds,
              startDate: new Date().toISOString().split('T')[0],
              endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              processId: process.id,
              processInstanceId: instanceId,
              stepId: nextStep.id,
              dealId: instance.dealId,
              source: isDealFunnel ? 'Сделка' : 'Процесс',
              entityType: 'task',
              createdByUserId: authSlice.state.currentUser?.id,
          };

          taskSlice.actions.saveTask(nextTask, tasksTable.id);

          if (instance.dealId && dealForInstance) {
              crmSlice.actions.saveDeal({ ...dealForInstance, stage: nextStep.id });
          }

          const completedSet = new Set(instance.completedStepIds || []);
          completedSet.add(fromStepId);

          const chosenBranch = steps
            .find(s => s.id === fromStepId)
            ?.branches?.find(b => b.nextStepId === nextStep.id);

          const updatedInstance = {
              ...instance,
              currentStepId: nextStep.id,
              pendingBranchSelection: undefined,
              taskIds: [...instance.taskIds, nextTask.id!],
              completedStepIds: Array.from(completedSet),
              branchHistory: [
                ...(instance.branchHistory || []),
                { stepId: fromStepId, branchId: chosenBranch?.id, nextStepId: nextStep.id },
              ],
          };

          const updatedProcess: BusinessProcess = {
              ...process,
              instances: process.instances?.map(i => i.id === instanceId ? updatedInstance : i) || [updatedInstance]
          };

          bpmSlice.actions.saveProcess(updatedProcess);
          showNotification(`Процесс перешел к шагу: ${nextStep.title}`);
          return;
      }
  };

  type AppNavView = (typeof settingsSlice.state)['currentView'];

  /** Редирект устаревших разделов в хабы (клиенты → воронка, календарь → рабочий стол и т.д.) */
  const setCurrentView = (v: AppNavView | 'payroll') => {
    const st = settingsSlice.setters;
    if (v === 'payroll') {
      st.setEmployeesHubTab('payroll');
      st.setCurrentView('employees');
      st.setActiveTableId('');
      return;
    }
    if (v === 'clients') {
      st.setCrmHubTab('clients');
      st.setCurrentView('sales-funnel');
      st.setActiveTableId('');
      return;
    }
    if (v === 'client-chats') {
      st.setCrmHubTab('funnel');
      st.setCurrentView('sales-funnel');
      st.setActiveTableId('');
      return;
    }
    if (v === 'meetings') {
      st.setWorkdeskTab('meetings');
      st.setCurrentView('home');
      st.setActiveTableId('');
      return;
    }
    if (v === 'docs') {
      st.setWorkdeskTab('documents');
      st.setCurrentView('home');
      st.setActiveTableId('');
      return;
    }
    if (v === 'inventory') {
      st.setCurrentView('inventory');
      st.setActiveTableId('');
      return;
    }
    if (v === 'admin') {
      st.setSettingsActiveTab('admin');
      st.setCurrentView('settings');
      st.setActiveTableId('');
      return;
    }
    if (v === 'analytics') {
      st.setCurrentView('home');
      st.setActiveTableId('');
      return;
    }
    st.setCurrentView(v);
  };

  /** «Назад» в шапке: внутри вкладок (рабочий стол, CRM, пространства, настройки), не через window.history. */
  const goBackWithinApp = () => {
    const v = settingsSlice.state.currentView;
    const st = settingsSlice.setters;
    if (v === 'home' && settingsSlice.state.workdeskTab !== 'dashboard') {
      st.setWorkdeskTab('dashboard');
      return;
    }
    if (v === 'sales-funnel' && settingsSlice.state.crmHubTab !== 'funnel') {
      st.setCrmHubTab('funnel');
      return;
    }
    if (v === 'employees' && settingsSlice.state.employeesHubTab === 'payroll') {
      st.setEmployeesHubTab('team');
      return;
    }
    if (v === 'spaces') {
      const tab = settingsSlice.state.activeSpaceTab;
      if (tab === 'functionality') {
        st.setActiveSpaceTab('backlog');
        return;
      }
      if (tab === 'backlog') {
        st.setActiveSpaceTab('content-plan');
        return;
      }
    }
    if (v === 'settings') {
      if (settingsSlice.state.settingsActiveTab !== 'users') {
        st.setSettingsActiveTab('users');
        return;
      }
      settingsSlice.actions.closeSettings();
      return;
    }
    if (v === 'table') {
      st.setActiveTableId('');
      setCurrentView('home');
      return;
    }
    if (v === 'doc-editor') {
      contentSlice.setters.setActiveDocId('');
      setCurrentView('home');
      st.setWorkdeskTab('documents');
      return;
    }
    if (
      v === 'tasks' ||
      v === 'inbox' ||
      v === 'search' ||
      v === 'finance' ||
      v === 'inventory' ||
      v === 'business-processes' ||
      v === 'chat' ||
      v === 'production'
    ) {
      st.setActiveTableId('');
      st.setWorkdeskTab('dashboard');
      st.setCrmHubTab('funnel');
      setCurrentView('home');
    }
  };

  return {
    state: {
      isLoading, notification,
      users: authSlice.state.users, currentUser: authSlice.state.currentUser, isProfileOpen: authSlice.state.isProfileOpen,
      tasks: taskSlice.state.tasks, projects: taskSlice.state.projects, statuses: taskSlice.state.statuses, priorities: taskSlice.state.priorities, isTaskModalOpen: taskSlice.state.isTaskModalOpen, editingTask: taskSlice.state.editingTask,
      clients: crmSlice.state.clients, contracts: crmSlice.state.contracts, oneTimeDeals: crmSlice.state.oneTimeDeals, accountsReceivable: crmSlice.state.accountsReceivable, employeeInfos: crmSlice.state.employeeInfos, deals: crmSlice.state.deals,
      docs: contentSlice.state.docs, folders: contentSlice.state.folders, meetings: contentSlice.state.meetings, contentPosts: contentSlice.state.contentPosts, shootPlans: contentSlice.state.shootPlans, isDocModalOpen: contentSlice.state.isDocModalOpen, activeDocId: contentSlice.state.activeDocId, targetFolderId: contentSlice.state.targetFolderId, editingDoc: contentSlice.state.editingDoc,
      departments: financeSlice.state.departments, financeCategories: financeSlice.state.financeCategories, financePlan: financeSlice.state.financePlan, purchaseRequests: financeSlice.state.purchaseRequests, financialPlanDocuments: financeSlice.state.financialPlanDocuments, financialPlannings: financeSlice.state.financialPlannings, incomeReports: financeSlice.state.incomeReports, bdr: financeSlice.state.bdr,
      orgPositions: bpmSlice.state.orgPositions, businessProcesses: bpmSlice.state.businessProcesses,
      warehouses: inventorySlice.state.warehouses, inventoryItems: inventorySlice.state.items, inventoryMovements: inventorySlice.state.movements, inventoryBalances: inventorySlice.state.balances, inventoryRevisions: inventorySlice.state.revisions,
      salesFunnels: salesFunnels,
      productionPipelines,
      productionBoardOrders,
      inboxMessages, outboxMessages,
      darkMode: settingsSlice.state.darkMode, tables: settingsSlice.state.tables, activityLogs: settingsSlice.state.activityLogs, currentView: settingsSlice.state.currentView, activeTableId: settingsSlice.state.activeTableId, viewMode: settingsSlice.state.viewMode, searchQuery: settingsSlice.state.searchQuery, settingsActiveTab: settingsSlice.state.settingsActiveTab, isCreateTableModalOpen: settingsSlice.state.isCreateTableModalOpen, createTableType: settingsSlice.state.createTableType, isEditTableModalOpen: settingsSlice.state.isEditTableModalOpen, editingTable: settingsSlice.state.editingTable, notificationPrefs: settingsSlice.state.notificationPrefs, automationRules: settingsSlice.state.automationRules, activeSpaceTab: settingsSlice.state.activeSpaceTab,
      workdeskTab: settingsSlice.state.workdeskTab,
      crmHubTab: settingsSlice.state.crmHubTab,
      employeesHubTab: settingsSlice.state.employeesHubTab,
      activeTable: settingsSlice.state.tables.find(t => t.id === settingsSlice.state.activeTableId), activeDoc: contentSlice.state.docs.find(d => d.id === contentSlice.state.activeDocId)
    },
    actions: {
      login: authSlice.actions.login, logout: authSlice.actions.logout, updateUsers: authSlice.actions.updateUsers, updateProfile: authSlice.actions.updateProfile, openProfile: authSlice.actions.openProfile, closeProfile: authSlice.actions.closeProfile,
      updateProjects: taskSlice.actions.updateProjects, updateStatuses: taskSlice.actions.updateStatuses, updatePriorities: taskSlice.actions.updatePriorities, quickCreateProject: taskSlice.actions.quickCreateProject, saveTask: saveTaskWrapper, deleteTask: taskSlice.actions.deleteTask, restoreTask: taskSlice.actions.restoreTask, permanentDeleteTask: taskSlice.actions.permanentDeleteTask, openTaskModal: taskSlice.actions.openTaskModal, closeTaskModal: taskSlice.actions.closeTaskModal, addTaskComment: taskSlice.actions.addTaskComment, addTaskAttachment: taskSlice.actions.addTaskAttachment,
      addTaskDocAttachment: taskSlice.actions.addTaskDocAttachment,
      removeTaskAttachment: taskSlice.actions.removeTaskAttachment,
      saveClient: (client: Client) => {
        const existing = crmSlice.state.clients.find(c => c.id === client.id);
        crmSlice.actions.saveClient(client);
        if (!existing && authSlice.state.currentUser) {
          const context: NotificationContext = {
            currentUser: authSlice.state.currentUser,
            allUsers: authSlice.state.users,
            notificationPrefs: settingsSlice.state.notificationPrefs
          };
          notifyClientCreated(client, { context }).catch(() => {});
        }
      },
      deleteClient: crmSlice.actions.deleteClient,
      saveContract: (contract: Contract) => {
        const existing = crmSlice.state.contracts.find(c => c.id === contract.id);
        crmSlice.actions.saveContract(contract);
        if (!existing && authSlice.state.currentUser) {
          const client = crmSlice.state.clients.find(c => c.id === contract.clientId);
          const context: NotificationContext = {
            currentUser: authSlice.state.currentUser,
            allUsers: authSlice.state.users,
            notificationPrefs: settingsSlice.state.notificationPrefs
          };
          notifyContractCreated(contract, client?.name || 'Неизвестный клиент', { context }).catch(() => {});
        }
      },
      deleteContract: crmSlice.actions.deleteContract,
      saveEmployee: crmSlice.actions.saveEmployee,
      deleteEmployee: crmSlice.actions.deleteEmployee,
      saveDeal: (deal: Deal) => {
        const normalizedDeal: Deal = isFunnelDeal(deal) ? { ...deal, dealKind: 'funnel' } : deal;
        const existing = crmSlice.state.deals.find(d => d.id === deal.id);
        const oldStage = existing?.stage;
        crmSlice.actions.saveDeal(normalizedDeal);
        if (!existing && authSlice.state.currentUser && isFunnelDeal(normalizedDeal)) {
          syncDealStageTasks(existing, normalizedDeal, authSlice.state.currentUser.id);

          const assignee = authSlice.state.users.find(u => u.id === normalizedDeal.assigneeId) || null;
          const context: NotificationContext = {
            currentUser: authSlice.state.currentUser,
            allUsers: authSlice.state.users,
            notificationPrefs: settingsSlice.state.notificationPrefs
          };
          notifyDealCreated(normalizedDeal, assignee, { context }).catch(() => {});
          // Новая сделка — пишем в «Систему» (включая случай «сам себе»)
          if (normalizedDeal.assigneeId) {
            const isSelfAssignedDeal = normalizedDeal.assigneeId === authSlice.state.currentUser.id;
            if (!isSelfAssignedDeal) {
              chatLocalService.addSystemMessageForEntity({
                actorId: authSlice.state.currentUser.id,
                targetUserId: normalizedDeal.assigneeId,
                text: `Я создал для тебя сделку: ${normalizedDeal.title}`,
                entityType: 'deal',
                entityId: normalizedDeal.id,
              });
            }
            chatLocalService.addSystemFeedMessage({
              targetUserId: normalizedDeal.assigneeId,
              text: isSelfAssignedDeal
                ? `Создана новая сделка: ${normalizedDeal.title}`
                : `${authSlice.state.currentUser.name} назначил вам сделку: ${normalizedDeal.title}`,
              entityType: 'deal',
              entityId: normalizedDeal.id,
            });
            if (!isSelfAssignedDeal) {
              chatLocalService.addSystemFeedMessage({
                targetUserId: authSlice.state.currentUser.id,
                text: `Вы создали сделку для ${authSlice.state.users.find((u) => u.id === normalizedDeal.assigneeId)?.name || 'сотрудника'}: ${normalizedDeal.title}`,
                entityType: 'deal',
                entityId: normalizedDeal.id,
              });
            }
          }
        } else if (existing && oldStage !== normalizedDeal.stage && authSlice.state.currentUser && isFunnelDeal(normalizedDeal)) {
          syncDealStageTasks(existing, normalizedDeal, authSlice.state.currentUser.id);
          const context: NotificationContext = {
            currentUser: authSlice.state.currentUser,
            allUsers: authSlice.state.users,
            notificationPrefs: settingsSlice.state.notificationPrefs
          };
          notifyDealStatusChanged(normalizedDeal, oldStage || 'Новая', normalizedDeal.stage, { context }).catch(() => {});
        }
      },
      deleteDeal: crmSlice.actions.deleteDeal,
      saveOneTimeDeal: crmSlice.actions.saveOneTimeDeal,
      deleteOneTimeDeal: crmSlice.actions.deleteOneTimeDeal,
      saveAccountsReceivable: crmSlice.actions.saveAccountsReceivable,
      deleteAccountsReceivable: crmSlice.actions.deleteAccountsReceivable,
      saveMeeting: (meeting: Meeting) => {
        const existing = contentSlice.state.meetings.find(m => m.id === meeting.id);
        contentSlice.actions.saveMeeting(meeting);
        if (!existing && authSlice.state.currentUser) {
          const participantIds = meeting.participantIds || [];
          const context: NotificationContext = {
            currentUser: authSlice.state.currentUser,
            allUsers: authSlice.state.users,
            notificationPrefs: settingsSlice.state.notificationPrefs
          };
          notifyMeetingCreated(meeting, participantIds, { context }).catch(() => {});
        }
      },
      deleteMeeting: contentSlice.actions.deleteMeeting,
      updateMeetingSummary: contentSlice.actions.updateMeetingSummary,
      savePost: contentSlice.actions.savePost,
      deletePost: contentSlice.actions.deletePost,
      saveShootPlan: contentSlice.actions.saveShootPlan,
      deleteShootPlan: contentSlice.actions.deleteShootPlan,
      saveDoc: saveDocWrapper,
      saveDocContent: contentSlice.actions.saveDocContent,
      deleteDoc: contentSlice.actions.deleteDoc,
      createFolder: contentSlice.actions.createFolder,
      deleteFolder: contentSlice.actions.deleteFolder,
      updateFolder: contentSlice.actions.updateFolder,
      handleDocClick: handleDocClickWrapper,
      openDocModal: contentSlice.actions.openDocModal,
      openEditDocModal: contentSlice.actions.openEditDocModal,
      closeDocModal: contentSlice.actions.closeDocModal,
      saveDepartment: financeSlice.actions.saveDepartment, deleteDepartment: financeSlice.actions.deleteDepartment, saveFinanceCategory: financeSlice.actions.saveFinanceCategory, deleteFinanceCategory: financeSlice.actions.deleteFinanceCategory, updateFinancePlan: financeSlice.actions.updateFinancePlan,       savePurchaseRequest: (request: PurchaseRequest, opts?: SavePurchaseRequestOptions) => {
        const existing = financeSlice.state.purchaseRequests.find(r => r.id === request.id);
        financeSlice.actions.savePurchaseRequest(request, opts);
        if (!existing && authSlice.state.currentUser) {
          const department = financeSlice.state.departments.find(d => d.id === request.departmentId);
          const context: NotificationContext = {
            currentUser: authSlice.state.currentUser,
            allUsers: authSlice.state.users,
            notificationPrefs: settingsSlice.state.notificationPrefs
          };
          notifyPurchaseRequestCreated(
            {
              id: request.id,
              title: request.title || request.description,
              description: request.comment || request.description,
              amount: request.amount,
            },
            department?.name || 'Не указан',
            { context }
          ).catch(() => {});
          // Новая заявка на средства — отправляем системное сообщение первому администратору
          const admins = authSlice.state.users.filter(u => hasPermission(u, 'finance.approve'));
          const admin = admins.find(u => u.id !== authSlice.state.currentUser!.id) || admins[0];
          if (admin) {
            chatLocalService.addSystemMessageForEntity({
              actorId: authSlice.state.currentUser.id,
              targetUserId: admin.id,
              text: `Я создал заявку на ${typeof request.amount === 'string' ? request.amount : String(request.amount ?? 0)} UZS: ${request.title || request.description || request.comment || ''}`,
              entityType: 'request',
              entityId: request.id,
            });
          }
        }
      },
      deletePurchaseRequest: financeSlice.actions.deletePurchaseRequest,
      refreshPurchaseRequests: financeSlice.actions.refreshPurchaseRequests,
      saveFinancialPlanDocument: financeSlice.actions.saveFinancialPlanDocument, deleteFinancialPlanDocument: financeSlice.actions.deleteFinancialPlanDocument, saveFinancialPlanning: financeSlice.actions.saveFinancialPlanning,       deleteFinancialPlanning: financeSlice.actions.deleteFinancialPlanning,
      refreshIncomeReports: financeSlice.actions.refreshIncomeReports,
      loadBdr: financeSlice.actions.loadBdr,
      saveBdr: financeSlice.actions.saveBdr,
      saveWarehouse: inventorySlice.actions.saveWarehouse, deleteWarehouse: inventorySlice.actions.deleteWarehouse, saveInventoryItem: inventorySlice.actions.saveItem, deleteInventoryItem: inventorySlice.actions.deleteItem, createInventoryMovement: inventorySlice.actions.createMovement, createInventoryRevision: inventorySlice.actions.createRevision, updateInventoryRevision: inventorySlice.actions.updateRevision, postInventoryRevision: inventorySlice.actions.postRevision,
      savePosition: bpmSlice.actions.savePosition, deletePosition: bpmSlice.actions.deletePosition, saveProcess: bpmSlice.actions.saveProcess, deleteProcess: bpmSlice.actions.deleteProcess, completeProcessStepWithBranch,
      saveSalesFunnel: async (funnel: SalesFunnel) => {
          try {
              // Проверяем, существует ли воронка с таким id
              const existingFunnels = (await api.funnels.getAll()) as SalesFunnel[];
              const exists = existingFunnels.some(f => f.id === funnel.id);
              
              if (exists) {
                  // Обновляем существующую воронку
                  await api.funnels.update(funnel.id, funnel);
              } else {
                  // Создаем новую воронку (без id)
                  const { id, ...funnelWithoutId } = funnel;
                  await api.funnels.create(funnelWithoutId);
              }
              // После сохранения перезагружаем данные из локального хранилища
              const funnels = (await api.funnels.getAll()) as SalesFunnel[];
              setSalesFunnels(funnels);
              showNotification('Воронка сохранена');
          } catch (error) {
              console.error('Ошибка сохранения воронки:', error);
              showNotification('Ошибка сохранения воронки');
          }
      },
      deleteSalesFunnel: async (id: string) => {
          try {
              await api.funnels.delete(id);
              // После удаления перезагружаем данные
              const funnels = (await api.funnels.getAll()) as SalesFunnel[];
              setSalesFunnels(funnels);
              showNotification('Воронка удалена');
          } catch (error) {
              console.error('Ошибка удаления воронки:', error);
              showNotification('Ошибка удаления воронки');
          }
      },
      refreshProductionRoutes: async () => {
        try {
          const [pipes, ords] = await Promise.all([api.production.getPipelines(), api.production.getOrders()]);
          setProductionPipelines(
            (Array.isArray(pipes) ? pipes : [])
              .map(normalizeProductionPipeline)
              .filter((x): x is ProductionRoutePipeline => x != null && !x.isArchived)
          );
          setProductionBoardOrders(
            (Array.isArray(ords) ? ords : [])
              .map(normalizeProductionOrder)
              .filter((x): x is ProductionRouteOrder => x != null && !x.isArchived)
          );
        } catch (error) {
          console.error(error);
          showNotification('Не удалось обновить производство');
        }
      },
      saveProductionPipeline: async (p: ProductionRoutePipeline) => {
        try {
          await api.production.putPipelines([pipelineToBulk(p)]);
          const pipes = await api.production.getPipelines();
          setProductionPipelines(
            (Array.isArray(pipes) ? pipes : [])
              .map(normalizeProductionPipeline)
              .filter((x): x is ProductionRoutePipeline => x != null && !x.isArchived)
          );
          showNotification('Маршрут сохранён');
        } catch (error) {
          console.error(error);
          showNotification('Ошибка сохранения маршрута');
        }
      },
      deleteProductionPipeline: async (id: string) => {
        try {
          const pipesRaw = await api.production.getPipelines();
          const found = (Array.isArray(pipesRaw) ? pipesRaw : [])
            .map(normalizeProductionPipeline)
            .find((x) => x?.id === id);
          if (!found) return;
          await api.production.putPipelines([pipelineToBulk({ ...found, isArchived: true })]);
          const next = await api.production.getPipelines();
          setProductionPipelines(
            (Array.isArray(next) ? next : [])
              .map(normalizeProductionPipeline)
              .filter((x): x is ProductionRoutePipeline => x != null && !x.isArchived)
          );
          showNotification('Маршрут в архиве');
        } catch (error) {
          console.error(error);
          showNotification('Ошибка архивации маршрута');
        }
      },
      createProductionRouteOrder: async (pipelineId: string, title: string) => {
        try {
          await api.production.createOrder({ pipelineId, title });
          const ords = await api.production.getOrders();
          setProductionBoardOrders(
            (Array.isArray(ords) ? ords : [])
              .map(normalizeProductionOrder)
              .filter((x): x is ProductionRouteOrder => x != null && !x.isArchived)
          );
          showNotification('Заказ создан');
        } catch (error) {
          console.error(error);
          showNotification('Ошибка создания заказа');
        }
      },
      productionHandOver: async (orderId: string, notes?: string) => {
        try {
          await api.production.handOver(orderId, { notes: notes || null });
          const ords = await api.production.getOrders();
          setProductionBoardOrders(
            (Array.isArray(ords) ? ords : [])
              .map(normalizeProductionOrder)
              .filter((x): x is ProductionRouteOrder => x != null && !x.isArchived)
          );
        } catch (error) {
          console.error(error);
          showNotification('Не удалось передать этап');
        }
      },
      productionResolveHandoff: async (
        handoffId: string,
        payload: { action: 'accept' | 'reject'; hasDefects?: boolean; defectNotes?: string | null }
      ) => {
        try {
          await api.production.resolveHandoff(handoffId, payload);
          const ords = await api.production.getOrders();
          setProductionBoardOrders(
            (Array.isArray(ords) ? ords : [])
              .map(normalizeProductionOrder)
              .filter((x): x is ProductionRouteOrder => x != null && !x.isArchived)
          );
        } catch (error) {
          console.error(error);
          showNotification('Не удалось обработать приёмку');
        }
      },
      productionCompleteOrder: async (orderId: string) => {
        try {
          await api.production.completeOrder(orderId);
          const ords = await api.production.getOrders();
          setProductionBoardOrders(
            (Array.isArray(ords) ? ords : [])
              .map(normalizeProductionOrder)
              .filter((x): x is ProductionRouteOrder => x != null && !x.isArchived)
          );
          showNotification('Заказ завершён');
        } catch (error) {
          console.error(error);
          showNotification('Не удалось завершить заказ');
        }
      },
      restoreUser: async (userId: string) => {
          try {
              const allUsers = (await api.users.getAll()) as User[];
              const user = allUsers.find(u => u.id === userId);
              if (!user) return;
              const now = new Date().toISOString();
              const updated = allUsers.map(u => u.id === userId ? { ...u, isArchived: false, updatedAt: now } : u);
              await api.users.updateAll(updated);
              // Обновляем локальное состояние
              authSlice.actions.updateUsers(updated);
              showNotification('Пользователь восстановлен');
          } catch (error) {
              console.error('Ошибка восстановления пользователя:', error);
              showNotification('Ошибка восстановления пользователя');
          }
      },
      restoreDoc: async (docId: string) => {
          try {
              const allDocs = (await api.docs.getAll()) as Doc[];
              const doc = allDocs.find(d => d.id === docId);
              if (!doc) return;
              const now = new Date().toISOString();
              const updated = allDocs.map(d => d.id === docId ? { ...d, isArchived: false, updatedAt: now } : d);
              await api.docs.updateAll(updated);
              // Обновляем локальное состояние
              contentSlice.setters.setDocs(updated);
              showNotification('Документ восстановлен');
          } catch (error) {
              console.error('Ошибка восстановления документа:', error);
              showNotification('Ошибка восстановления документа');
          }
      },
      restorePost: async (postId: string) => {
          try {
              const allPosts = (await api.contentPosts.getAll()) as ContentPost[];
              const post = allPosts.find(p => p.id === postId);
              if (!post) return;
              const now = new Date().toISOString();
              const updated = allPosts.map(p => p.id === postId ? { ...p, isArchived: false, updatedAt: now } : p);
              await api.contentPosts.updateAll(updated);
              contentSlice.setters.setContentPosts(updated);
              showNotification('Пост восстановлен');
          } catch (error) {
              console.error('Ошибка восстановления поста:', error);
              showNotification('Ошибка восстановления поста');
          }
      },
      restoreEmployee: async (employeeId: string) => {
          try {
              await api.employees.update(employeeId, { isArchived: false });
              const employees = (await api.employees.getAll()) as EmployeeInfo[];
              crmSlice.setters.setEmployeeInfos(employees);
              showNotification('Сотрудник восстановлен');
          } catch (error) {
              console.error('Ошибка восстановления сотрудника:', error);
              showNotification('Ошибка восстановления сотрудника');
          }
      },
      restoreProject: async (projectId: string) => {
          try {
              const allProjects = (await api.projects.getAll()) as Project[];
              const project = allProjects.find(p => p.id === projectId);
              if (!project) return;
              const now = new Date().toISOString();
              const updated = allProjects.map(p => p.id === projectId ? { ...p, isArchived: false, updatedAt: now } : p);
              await api.projects.updateAll(updated);
              taskSlice.actions.updateProjects(updated);
              showNotification('Проект восстановлен');
          } catch (error) {
              console.error('Ошибка восстановления проекта:', error);
              showNotification('Ошибка восстановления проекта');
          }
      },
      restoreDepartment: async (departmentId: string) => {
          try {
              const allDepartments = (await api.departments.getAll()) as Department[];
              const department = allDepartments.find(d => d.id === departmentId);
              if (!department) return;
              const now = new Date().toISOString();
              const updated = allDepartments.map(d => d.id === departmentId ? { ...d, isArchived: false, updatedAt: now } : d);
              await api.departments.updateAll(updated);
              financeSlice.setters.setDepartments(updated);
              showNotification('Подразделение восстановлено');
          } catch (error) {
              console.error('Ошибка восстановления подразделения:', error);
              showNotification('Ошибка восстановления подразделения');
          }
      },
      restoreFinanceCategory: async (categoryId: string) => {
          try {
              const allCategories = (await api.finance.getCategories()) as FinanceCategory[];
              const category = allCategories.find(c => c.id === categoryId);
              if (!category) return;
              const now = new Date().toISOString();
              const updated = allCategories.map(c => c.id === categoryId ? { ...c, isArchived: false, updatedAt: now } : c);
              await api.finance.updateCategories(updated);
              financeSlice.setters.setFinanceCategories(updated);
              showNotification('Фонд восстановлен');
          } catch (error) {
              console.error('Ошибка восстановления фонда:', error);
              showNotification('Ошибка восстановления фонда');
          }
      },
      restoreSalesFunnel: async (funnelId: string) => {
          try {
              const allFunnels = (await api.funnels.getAll()) as SalesFunnel[];
              const funnel = allFunnels.find(f => f.id === funnelId);
              if (!funnel) return;
              const now = new Date().toISOString();
              const updated = allFunnels.map(f => f.id === funnelId ? { ...f, isArchived: false, updatedAt: now } : f);
              await Promise.all(updated.map(f => api.funnels.update(f.id, f)));
              setSalesFunnels(updated);
              showNotification('Воронка восстановлена');
          } catch (error) {
              console.error('Ошибка восстановления воронки:', error);
              showNotification('Ошибка восстановления воронки');
          }
      },
      restoreTable: async (tableId: string) => {
          try {
              const allTables = (await api.tables.getAll()) as TableCollection[];
              const table = allTables.find(t => t.id === tableId);
              if (!table) return;
              const now = new Date().toISOString();
              const updated = allTables.map(t => t.id === tableId ? { ...t, isArchived: false, updatedAt: now } : t);
              await api.tables.updateAll(updated);
              settingsSlice.setters.setTables(updated);
              showNotification('Таблица восстановлена');
          } catch (error) {
              console.error('Ошибка восстановления таблицы:', error);
              showNotification('Ошибка восстановления таблицы');
          }
      },
      restoreBusinessProcess: async (processId: string) => {
          try {
              const allProcesses = (await api.bpm.getProcesses()) as BusinessProcess[];
              const process = allProcesses.find(p => p.id === processId);
              if (!process) return;
              const now = new Date().toISOString();
              const updated = allProcesses.map(p => p.id === processId ? { ...p, isArchived: false, updatedAt: now } : p);
              await api.bpm.updateProcesses(updated);
              bpmSlice.setters.setBusinessProcesses(updated);
              showNotification('Бизнес-процесс восстановлен');
          } catch (error) {
              console.error('Ошибка восстановления бизнес-процесса:', error);
              showNotification('Ошибка восстановления бизнес-процесса');
          }
      },
      restoreDeal: async (dealId: string) => {
          try {
              const allDeals = (await api.deals.getAll()) as Deal[];
              const deal = allDeals.find(d => d.id === dealId);
              if (!deal) return;
              const now = new Date().toISOString();
              const updated = allDeals.map(d => d.id === dealId ? { ...d, isArchived: false, updatedAt: now } : d);
              await api.deals.updateAll(updated);
              crmSlice.setters.setDeals(updated);
              showNotification('Сделка восстановлена');
          } catch (error) {
              console.error('Ошибка восстановления сделки:', error);
              showNotification('Ошибка восстановления сделки');
          }
      },
      restoreClient: async (clientId: string) => {
          try {
              const fresh = await api.clients.getById(clientId);
              const updated = await api.clients.patch(clientId, {
                isArchived: false,
                ...(fresh.version != null && Number.isFinite(fresh.version) ? { version: fresh.version } : {}),
              });
              crmSlice.setters.setClients((prev) =>
                prev.map((c) => (c.id === clientId ? updated : c))
              );
              showNotification('Клиент восстановлен');
          } catch (error) {
              console.error('Ошибка восстановления клиента:', error);
              showNotification('Ошибка восстановления клиента');
          }
      },
      restoreContract: async (contractId: string) => {
          try {
              const allContracts = (await api.contracts.getAll()) as Deal[];
              const deal = allContracts.find(d => d.id === contractId);
              if (!deal) return;
              const now = new Date().toISOString();
              const updated = allContracts.map(d => d.id === contractId ? { ...d, isArchived: false, updatedAt: now } : d);
              await api.contracts.updateAll(updated);
              crmSlice.setters.setContracts(updated);
              showNotification('Договор восстановлен');
          } catch (error) {
              console.error('Ошибка восстановления договора:', error);
              showNotification('Ошибка восстановления договора');
          }
      },
      restoreMeeting: async (meetingId: string) => {
          try {
              await api.meetings.patch(meetingId, { isArchived: false });
              const fresh = (await api.meetings.getAll()) as Meeting[];
              contentSlice.setters.setMeetings(fresh);
              showNotification('Встреча восстановлена');
          } catch (error) {
              console.error('Ошибка восстановления встречи:', error);
              showNotification('Ошибка восстановления встречи');
          }
      },
      restoreOrgPosition: async (positionId: string) => {
          try {
              const all = (await api.bpm.getPositions()) as OrgPosition[];
              const pos = all.find((p) => p.id === positionId);
              if (!pos) return;
              const now = new Date().toISOString();
              const updated = all.map((p) =>
                  p.id === positionId ? { ...p, isArchived: false, updatedAt: now } : p
              );
              await api.bpm.updatePositions(updated);
              bpmSlice.setters.setOrgPositions(updated);
              showNotification('Должность восстановлена');
          } catch (error) {
              console.error('Ошибка восстановления должности:', error);
              showNotification('Ошибка восстановления должности');
          }
      },
      restoreAutomationRule: async (ruleId: string) => {
          try {
              const all = (await api.automation.getRules()) as AutomationRule[];
              const rule = all.find((r) => r.id === ruleId);
              if (!rule) return;
              const updated = all.map((r) => (r.id === ruleId ? { ...r, isArchived: false } : r));
              await api.automation.updateRules(updated);
              settingsSlice.setters.setAutomationRules(updated);
              showNotification('Правило восстановлено');
          } catch (error) {
              console.error('Ошибка восстановления правила:', error);
              showNotification('Ошибка восстановления правила');
          }
      },
      restoreStatus: async (statusId: string) => {
          try {
              const all = (await api.statuses.getAll()) as StatusOption[];
              const row = all.find((s) => s.id === statusId);
              if (!row) return;
              const now = new Date().toISOString();
              const updated = all.map((s) => (s.id === statusId ? { ...s, isArchived: false, updatedAt: now } : s));
              await api.statuses.updateAll(updated);
              taskSlice.setters.setStatuses(updated);
              showNotification('Статус восстановлен');
          } catch (error) {
              console.error('Ошибка восстановления статуса:', error);
              showNotification('Ошибка восстановления статуса');
          }
      },
      restorePriority: async (priorityId: string) => {
          try {
              const all = (await api.priorities.getAll()) as PriorityOption[];
              const row = all.find((p) => p.id === priorityId);
              if (!row) return;
              const now = new Date().toISOString();
              const updated = all.map((p) => (p.id === priorityId ? { ...p, isArchived: false, updatedAt: now } : p));
              await api.priorities.updateAll(updated);
              taskSlice.setters.setPriorities(updated);
              showNotification('Приоритет восстановлен');
          } catch (error) {
              console.error('Ошибка восстановления приоритета:', error);
              showNotification('Ошибка восстановления приоритета');
          }
      },
      toggleDarkMode: settingsSlice.actions.toggleDarkMode, createTable: createTableWrapper, updateTable: settingsSlice.actions.updateTable, deleteTable: settingsSlice.actions.deleteTable, markAllRead: settingsSlice.actions.markAllRead, navigate: settingsSlice.actions.navigate, goBackWithinApp, openSettings: settingsSlice.actions.openSettings, closeSettings: settingsSlice.actions.closeSettings, openCreateTable: settingsSlice.actions.openCreateTable, closeCreateTable: settingsSlice.actions.closeCreateTable, openEditTable: settingsSlice.actions.openEditTable, closeEditTable: settingsSlice.actions.closeEditTable, updateNotificationPrefs: settingsSlice.actions.updateNotificationPrefs, saveAutomationRule: settingsSlice.actions.saveAutomationRule, deleteAutomationRule: settingsSlice.actions.deleteAutomationRule, setActiveSpaceTab: settingsSlice.actions.setActiveSpaceTab,
      setActiveTableId: settingsSlice.setters.setActiveTableId, setCurrentView, setViewMode: settingsSlice.setters.setViewMode, setSearchQuery: settingsSlice.setters.setSearchQuery, setSettingsActiveTab: settingsSlice.setters.setSettingsActiveTab,
      setWorkdeskTab: settingsSlice.setters.setWorkdeskTab,
      setCrmHubTab: settingsSlice.setters.setCrmHubTab,
      setEmployeesHubTab: settingsSlice.setters.setEmployeesHubTab,
      /** Открыть контент-план и вкладку «Съёмки» (из календаря) */
      openShootPlanFromCalendar: (tableId: string, shootPlanId?: string) => {
        settingsSlice.setters.setActiveTableId(tableId);
        settingsSlice.setters.setCurrentView('table');
        window.setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent('openContentPlanShoots', { detail: { tableId, shootPlanId } })
          );
        }, 0);
      },
      loadMessages,
      sendMessage: async (payload: { text: string; attachments?: MessageAttachment[]; recipientId?: string | null }) => {
        const uid = authSlice.state.currentUser?.id;
        if (!uid) return;
        try {
          await api.messages.add({
            senderId: uid,
            recipientId: payload.recipientId ?? null,
            text: payload.text,
            attachments: payload.attachments || [],
          });
          await loadMessages();
          showNotification('Сообщение отправлено');
        } catch (e) {
          console.error(e);
          showNotification('Ошибка отправки');
        }
      },
      /** Короткое уведомление (тост) — для UI вне хука */
      showToast: showNotification,
    }
  };
};

/** Тип экшнов приложения для пропсов модулей вместо `any` */
export type AppActions = ReturnType<typeof useAppLogic>['actions'];

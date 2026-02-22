
import { useState, useEffect, useRef } from 'react';
import { api } from '../../backend/api';
import { FAVICON_SVG_DATA_URI } from '../../components/AppIcons';
import { storageService } from '../../services/storageService';
// import { pollTelegramUpdates } from '../../services/telegramService'; // Отключено - polling делается только на сервере
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
import { leadSyncService } from '../../services/leadSyncService';
import { Comment, Deal, Task, BusinessProcess, Client, Contract, PurchaseRequest, Doc, Meeting, SalesFunnel } from '../../types';
import { createDeleteHandler } from '../../utils/crudUtils';

import { useAuthLogic } from './slices/useAuthLogic';
import { useTaskLogic } from './slices/useTaskLogic';
import { useCRMLogic } from './slices/useCRMLogic';
import { useContentLogic } from './slices/useContentLogic';
import { useSettingsLogic } from './slices/useSettingsLogic';
import { useFinanceLogic } from './slices/useFinanceLogic';
import { useBPMLogic } from './slices/useBPMLogic';
import { useInventoryLogic } from './slices/useInventoryLogic';
import { STANDARD_FEATURES } from '../../components/FunctionalityView';
// Функция заполнения тестовыми данными полностью удалена

export const useAppLogic = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [notification, setNotification] = useState<string | null>(null);
  // Отслеживание загруженных модулей для ленивой загрузки
  const [loadedModules, setLoadedModules] = useState<Set<string>>(new Set());
  const loadedModulesRef = useRef<Set<string>>(new Set());

  const showNotification = (msg: string) => { setNotification(msg); setTimeout(() => setNotification(null), 3000); };

  const settingsSlice = useSettingsLogic(showNotification);
  const authSlice = useAuthLogic(showNotification);
  const crmSlice = useCRMLogic(showNotification);
  const [salesFunnels, setSalesFunnels] = useState<SalesFunnel[]>([]);
  const contentSlice = useContentLogic(showNotification, settingsSlice.state.activeTableId);
  const taskSlice = useTaskLogic(showNotification, authSlice.state.currentUser, authSlice.state.users, settingsSlice.state.automationRules, contentSlice.state.docs, contentSlice.actions.saveDoc, settingsSlice.state.notificationPrefs);
  const financeSlice = useFinanceLogic(showNotification);
  const bpmSlice = useBPMLogic(showNotification);
  const inventorySlice = useInventoryLogic(showNotification);

  // Базовая загрузка - только критически важные данные для работы приложения
  // Уровень 0: Загрузка данных для аутентификации (только users)
  const loadAuthData = async () => {
      try {
          const users = await api.users.getAll();
          if (users.length === 0) {
              console.warn('[Auth] No users in local store');
          }
          
          if (users.length !== authSlice.state.users.length || 
              users.some(u => !authSlice.state.users.find(au => au.id === u.id))) {
            console.log('[Auth] Updating users via updateUsers');
            authSlice.actions.updateUsers(users);
          } else {
            console.log('[Auth] Setting users directly');
            authSlice.setters.setUsers(users);
          }
      } catch (error: any) {
          console.error('[Auth] Error loading users:', error);
          console.error('[Auth] Error details:', {
              code: error?.code,
              message: error?.message,
              stack: error?.stack
          });
          throw error;
      }
  };

  // Уровень 1: Загрузка основных данных верхнего уровня (после аутентификации)
  const loadMainData = async () => {
      // Загружаем параллельно для скорости
      const [tables, activityLogs, notificationPrefs, automationRules, statuses, priorities, funnels] = await Promise.all([
          api.tables.getAll(),
          api.activity.getAll(),
          api.notificationPrefs.get(),
          api.automation.getRules(),
          api.statuses.getAll(),
          api.priorities.getAll(),
          api.funnels.getAll(),
      ]);
      
      settingsSlice.setters.setTables(tables);
      settingsSlice.setters.setActivityLogs(activityLogs);
      settingsSlice.setters.setNotificationPrefs(notificationPrefs);
      settingsSlice.setters.setAutomationRules(automationRules);
      taskSlice.setters.setStatuses(statuses);
      taskSlice.setters.setPriorities(priorities);
      setSalesFunnels(funnels);
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
      setLoadedModules(new Set(loadedModulesRef.current));
  };

  // Уровень 2: Загрузка данных модуля CRM (lazy loading)
  const loadCRMData = async () => {
      if (loadedModulesRef.current.has('crm')) return; // Уже загружено
      const [clients, deals, accountsReceivable, employees] = await Promise.all([
          api.clients.getAll(),
          api.deals.getAll(), // Объединенная коллекция для договоров и продаж
          api.accountsReceivable.getAll(),
          api.employees.getAll(),
      ]);
      crmSlice.setters.setClients(clients);
      crmSlice.setters.setDeals(deals); // Устанавливаем все сделки (договоры и продажи)
      crmSlice.setters.setAccountsReceivable(accountsReceivable);
      crmSlice.setters.setEmployeeInfos(employees);
      loadedModulesRef.current.add('crm');
      setLoadedModules(new Set(loadedModulesRef.current));
  };

  // Уровень 2: Загрузка данных модуля Content (lazy loading)
  const loadContentData = async () => {
      if (loadedModulesRef.current.has('content')) return; // Уже загружено
      const [docs, folders, meetings, contentPosts] = await Promise.all([
          api.docs.getAll(),
          api.folders.getAll(),
          api.meetings.getAll(),
          api.contentPosts.getAll(),
      ]);
      // Не фильтруем архивные элементы - они нужны для архива, фильтрация происходит в компонентах
      contentSlice.setters.setDocs(docs);
      contentSlice.setters.setFolders(folders);
      contentSlice.setters.setMeetings(meetings);
      contentSlice.setters.setContentPosts(contentPosts);
      loadedModulesRef.current.add('content');
      setLoadedModules(new Set(loadedModulesRef.current));
  };

  // Уровень 2: Загрузка данных модуля Finance (lazy loading)
  const loadFinanceData = async () => {
      if (loadedModulesRef.current.has('finance')) return; // Уже загружено
      const [departments, categories, funds, plan, requests, planDocs, plannings] = await Promise.all([
          api.departments.getAll(),
          api.finance.getCategories(),
          api.finance.getFunds(),
          api.finance.getPlan(),
          api.finance.getRequests(),
          api.finance.getFinancialPlanDocuments(),
          api.finance.getFinancialPlannings(),
      ]);
      financeSlice.setters.setDepartments(departments);
      financeSlice.setters.setFinanceCategories(categories);
      financeSlice.setters.setFunds(funds);
      financeSlice.setters.setFinancePlan(plan);
      financeSlice.setters.setPurchaseRequests(requests);
      financeSlice.setters.setFinancialPlanDocuments(planDocs);
      financeSlice.setters.setFinancialPlannings(plannings);
      loadedModulesRef.current.add('finance');
      setLoadedModules(new Set(loadedModulesRef.current));
  };

  // Уровень 2: Загрузка данных модуля BPM (lazy loading)
  const loadBPMData = async () => {
      if (loadedModulesRef.current.has('bpm')) return; // Уже загружено
      const [positions, processes] = await Promise.all([
          api.bpm.getPositions(),
          api.bpm.getProcesses(),
      ]);
      bpmSlice.setters.setOrgPositions(positions);
      bpmSlice.setters.setBusinessProcesses(processes);
      loadedModulesRef.current.add('bpm');
      setLoadedModules(new Set(loadedModulesRef.current));
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
      inventorySlice.setters.setItems(items);
      inventorySlice.setters.setMovements(movements);
      inventorySlice.setters.setRevisions(revisions);
      loadedModulesRef.current.add('inventory');
      setLoadedModules(new Set(loadedModulesRef.current));
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

  // Инициализация приложения - поэтапная загрузка
  useEffect(() => {
    const faviconLink = document.getElementById('dynamic-favicon') as HTMLLinkElement;
    if (faviconLink) faviconLink.href = FAVICON_SVG_DATA_URI;
    
    const initApp = async () => { 
      setIsLoading(true); 
      
      try {
        // Уровень 0: Загружаем только данные для аутентификации
        await loadAuthData();
        setIsLoading(false);
        
        // Уровень 1: После загрузки auth данных, загружаем основные данные
        // Загружаем всегда, так как основные данные нужны для работы приложения
        await loadMainData();
      } catch (err) {
        console.error('Ошибка загрузки данных:', err);
        showNotification('Ошибка загрузки данных.');
        setIsLoading(false);
      }
    };
    initApp();
  }, []);

  // Данные хранятся локально, загружаются по требованию

  // Instagram синхронизация для воронок с подключенным Instagram
  useEffect(() => {
    if (!loadedModulesRef.current.has('crm')) return; // Работает только если CRM модуль загружен
    
    const instagramSyncInterval = setInterval(async () => {
      try {
        const result = await leadSyncService.syncAllInstagramFunnels();
        
        // Сохраняем новые сделки
        if (result.newDeals.length > 0) {
          const currentDeals = await api.deals.getAll();
          const mergedDeals = [...currentDeals, ...result.newDeals];
          crmSlice.setters.setDeals(mergedDeals);
          await api.deals.updateAll(mergedDeals);
          showNotification(`Новых лидов из Instagram: ${result.newDeals.length}`);
        }
        
        // Обновляем существующие сделки
        if (result.updatedDeals.length > 0) {
          const currentDeals = await api.deals.getAll();
          const updatedDealsMap = new Map(result.updatedDeals.map(d => [d.id, d]));
          const mergedDeals = currentDeals.map(d => updatedDealsMap.get(d.id) || d);
          crmSlice.setters.setDeals(mergedDeals);
          await api.deals.updateAll(mergedDeals);
          showNotification(`Обновлено сделок из Instagram: ${result.updatedDeals.length}`);
        }
        
        // Показываем ошибки, если есть
        if (result.errors.length > 0) {
          console.warn('Instagram sync errors:', result.errors);
        }
      } catch (error) {
        console.error('Error syncing Instagram leads:', error);
      }
    }, 60000); // Синхронизация каждую минуту (Instagram API имеет лимиты)

    return () => clearInterval(instagramSyncInterval);
  }, [loadedModules]); // Зависимость от loadedModules для пересоздания эффекта при загрузке CRM

  // Ленивая загрузка данных при открытии разделов (Уровень 2)
  useEffect(() => {
    const currentView = settingsSlice.state.currentView;
    
    // Определяем, какие данные нужно загрузить в зависимости от текущего представления
    const loadData = async () => {
      switch (currentView) {
          case 'home':
              // Home использует данные из нескольких модулей
              await Promise.all([
                  loadTasksData(),
                  loadContentData(), // для meetings и contentPosts
                  loadFinanceData(), // для financePlan и purchaseRequests
                  loadCRMData(), // для deals и employeeInfos
              ]);
              break;
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
              await Promise.all([
                  loadTasksData(), // Tasks нужны для CRM модуля
                  loadCRMData(),
              ]);
              break;
          case 'finance':
              await loadFinanceData();
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
      }
    };
    
    loadData().catch(err => {
      console.error('Ошибка загрузки данных модуля:', err);
    });
  }, [settingsSlice.state.currentView, settingsSlice.state.activeTableId]);

  // Обработчик синхронизации контент-плана
  useEffect(() => {
      const handleContentPlanSync = async () => {
          const activeTable = settingsSlice.state.tables.find(t => t.id === settingsSlice.state.activeTableId);
          if (activeTable?.type === 'content-plan') {
              try {
                  const contentPosts = await api.contentPosts.getAll();
                  contentSlice.setters.setContentPosts(contentPosts);
              } catch (error) {
                  console.error('Ошибка обновления контент-плана:', error);
              }
          }
      };

      window.addEventListener('contentPlanSync', handleContentPlanSync);
      return () => {
          window.removeEventListener('contentPlanSync', handleContentPlanSync);
      };
  }, [settingsSlice.state.activeTableId, settingsSlice.state.tables]);

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
      
      // Если задача процесса только что выполнена - переходим к следующему шагу или ожидаем выбор ветки
      if (oldTask && oldTask.processId && oldTask.processInstanceId && oldTask.stepId && !wasCompleted && isNowCompleted) {
          const process = bpmSlice.state.businessProcesses.find(p =>
              p.id === oldTask.processId && p.instances?.some(i => i.id === oldTask.processInstanceId)
          );
          if (process) {
              const instance = process.instances!.find(i => i.id === oldTask.processInstanceId);
              if (instance && instance.status === 'active') {
                  const currentStep = process.steps.find(s => s.id === instance.currentStepId);
                  if (!currentStep) return;

                  // Шаг с вариантами: ожидаем выбор ветки (UI покажет модалку)
                  if (currentStep.stepType === 'variant' && currentStep.branches && currentStep.branches.length > 0) {
                      const updatedInstance = {
                          ...instance,
                          currentStepId: null,
                          pendingBranchSelection: { stepId: currentStep.id }
                      };
                      const updatedProcess: BusinessProcess = {
                          ...process,
                          instances: process.instances?.map(i => i.id === instance.id ? updatedInstance : i) || [updatedInstance]
                      };
                      bpmSlice.actions.saveProcess(updatedProcess);
                      showNotification('Выберите вариант перехода в карточке экземпляра процесса');
                      return;
                  }

                  // Определяем следующий шаг: nextStepId или линейный порядок
                  const currentStepIndex = process.steps.findIndex(s => s.id === instance.currentStepId);
                  let nextStep = currentStep.nextStepId
                      ? process.steps.find(s => s.id === currentStep.nextStepId)
                      : process.steps[currentStepIndex + 1];

                  if (nextStep) {
                      const tasksTable = settingsSlice.state.tables.find(t => t.type === 'tasks');
                      if (tasksTable) {
                          let nextAssigneeId: string | null = null;
                          if (nextStep!.assigneeType === 'position') {
                              const position = bpmSlice.state.orgPositions.find(p => p.id === nextStep!.assigneeId);
                              nextAssigneeId = position?.holderUserId || null;
                          } else {
                              nextAssigneeId = nextStep!.assigneeId || null;
                          }

                          if (nextAssigneeId) {
                              const nextTask: Partial<Task> = {
                                  id: `task-${Date.now()}`,
                                  tableId: tasksTable.id,
                                  title: `${process.title}: ${nextStep!.title}`,
                                  description: nextStep!.description || '',
                                  status: 'Не начато',
                                  priority: 'Средний',
                                  assigneeId: nextAssigneeId,
                                  startDate: new Date().toISOString().split('T')[0],
                                  endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                                  processId: process.id,
                                  processInstanceId: instance.id,
                                  stepId: nextStep!.id
                              };

                              taskSlice.actions.saveTask(nextTask, tasksTable.id);

                              const updatedInstance = {
                                  ...instance,
                                  currentStepId: nextStep!.id,
                                  taskIds: [...instance.taskIds, nextTask.id!]
                              };

                              const updatedProcess: BusinessProcess = {
                                  ...process,
                                  instances: process.instances?.map(i => i.id === instance.id ? updatedInstance : i) || [updatedInstance]
                              };

                              bpmSlice.actions.saveProcess(updatedProcess);
                              showNotification(`Процесс перешел к шагу: ${nextStep!.title}`);
                          }
                      }
                  } else {
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
                      showNotification(`Процесс "${process.title}" завершен!`);
                  }
              }
          }
      }
  };

  /** Завершить шаг с вариантами — создать задачу для выбранной ветки */
  const completeProcessStepWithBranch = (instanceId: string, nextStepId: string) => {
      const allProcs = bpmSlice.state.businessProcesses;
      for (const process of allProcs) {
          const instance = process.instances?.find(i => i.id === instanceId);
          if (!instance || !instance.pendingBranchSelection) continue;

          const nextStep = process.steps.find(s => s.id === nextStepId);
          if (!nextStep) return;

          const tasksTable = settingsSlice.state.tables.find(t => t.type === 'tasks');
          if (!tasksTable) return;

          let assigneeId: string | null = null;
          if (nextStep.assigneeType === 'position') {
              const position = bpmSlice.state.orgPositions.find(p => p.id === nextStep.assigneeId);
              assigneeId = position?.holderUserId || null;
          } else {
              assigneeId = nextStep.assigneeId || null;
          }

          if (!assigneeId) return;

          const nextTask: Partial<Task> = {
              id: `task-${Date.now()}`,
              tableId: tasksTable.id,
              title: `${process.title}: ${nextStep.title}`,
              description: nextStep.description || '',
              status: 'Не начато',
              priority: 'Средний',
              assigneeId,
              startDate: new Date().toISOString().split('T')[0],
              endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              processId: process.id,
              processInstanceId: instanceId,
              stepId: nextStep.id
          };

          taskSlice.actions.saveTask(nextTask, tasksTable.id);

          const updatedInstance = {
              ...instance,
              currentStepId: nextStep.id,
              pendingBranchSelection: undefined,
              taskIds: [...instance.taskIds, nextTask.id!]
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

  return {
    state: {
      isLoading, notification,
      users: authSlice.state.users, currentUser: authSlice.state.currentUser, isProfileOpen: authSlice.state.isProfileOpen,
      tasks: taskSlice.state.tasks, projects: taskSlice.state.projects, statuses: taskSlice.state.statuses, priorities: taskSlice.state.priorities, isTaskModalOpen: taskSlice.state.isTaskModalOpen, editingTask: taskSlice.state.editingTask,
      clients: crmSlice.state.clients, contracts: crmSlice.state.contracts, oneTimeDeals: crmSlice.state.oneTimeDeals, accountsReceivable: crmSlice.state.accountsReceivable, employeeInfos: crmSlice.state.employeeInfos, deals: crmSlice.state.deals,
      docs: contentSlice.state.docs, folders: contentSlice.state.folders, meetings: contentSlice.state.meetings, contentPosts: contentSlice.state.contentPosts, isDocModalOpen: contentSlice.state.isDocModalOpen, activeDocId: contentSlice.state.activeDocId, targetFolderId: contentSlice.state.targetFolderId, editingDoc: contentSlice.state.editingDoc,
      departments: financeSlice.state.departments, financeCategories: financeSlice.state.financeCategories, funds: financeSlice.state.funds, financePlan: financeSlice.state.financePlan, purchaseRequests: financeSlice.state.purchaseRequests, financialPlanDocuments: financeSlice.state.financialPlanDocuments, financialPlannings: financeSlice.state.financialPlannings,
      orgPositions: bpmSlice.state.orgPositions, businessProcesses: bpmSlice.state.businessProcesses,
      warehouses: inventorySlice.state.warehouses, inventoryItems: inventorySlice.state.items, inventoryMovements: inventorySlice.state.movements, inventoryBalances: inventorySlice.state.balances, inventoryRevisions: inventorySlice.state.revisions,
      salesFunnels: salesFunnels,
      darkMode: settingsSlice.state.darkMode, tables: settingsSlice.state.tables, activityLogs: settingsSlice.state.activityLogs, currentView: settingsSlice.state.currentView, activeTableId: settingsSlice.state.activeTableId, viewMode: settingsSlice.state.viewMode, searchQuery: settingsSlice.state.searchQuery, settingsActiveTab: settingsSlice.state.settingsActiveTab, isCreateTableModalOpen: settingsSlice.state.isCreateTableModalOpen, createTableType: settingsSlice.state.createTableType, isEditTableModalOpen: settingsSlice.state.isEditTableModalOpen, editingTable: settingsSlice.state.editingTable, notificationPrefs: settingsSlice.state.notificationPrefs, automationRules: settingsSlice.state.automationRules, activeSpaceTab: settingsSlice.state.activeSpaceTab,
      activeTable: settingsSlice.state.tables.find(t => t.id === settingsSlice.state.activeTableId), activeDoc: contentSlice.state.docs.find(d => d.id === contentSlice.state.activeDocId)
    },
    actions: {
      login: authSlice.actions.login, logout: authSlice.actions.logout, updateUsers: authSlice.actions.updateUsers, updateProfile: authSlice.actions.updateProfile, openProfile: authSlice.actions.openProfile, closeProfile: authSlice.actions.closeProfile,
      updateProjects: taskSlice.actions.updateProjects, updateStatuses: taskSlice.actions.updateStatuses, updatePriorities: taskSlice.actions.updatePriorities, quickCreateProject: taskSlice.actions.quickCreateProject, saveTask: saveTaskWrapper, deleteTask: taskSlice.actions.deleteTask, restoreTask: taskSlice.actions.restoreTask, permanentDeleteTask: taskSlice.actions.permanentDeleteTask, openTaskModal: taskSlice.actions.openTaskModal, closeTaskModal: taskSlice.actions.closeTaskModal, addTaskComment: taskSlice.actions.addTaskComment, addTaskAttachment: taskSlice.actions.addTaskAttachment, addTaskDocAttachment: taskSlice.actions.addTaskDocAttachment,
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
        const existing = crmSlice.state.deals.find(d => d.id === deal.id);
        const oldStage = existing?.stage;
        crmSlice.actions.saveDeal(deal);
        if (!existing && authSlice.state.currentUser) {
          const assignee = authSlice.state.users.find(u => u.id === deal.assigneeId) || null;
          const context: NotificationContext = {
            currentUser: authSlice.state.currentUser,
            allUsers: authSlice.state.users,
            notificationPrefs: settingsSlice.state.notificationPrefs
          };
          notifyDealCreated(deal, assignee, { context }).catch(() => {});
        } else if (existing && oldStage !== deal.stage && authSlice.state.currentUser) {
          const context: NotificationContext = {
            currentUser: authSlice.state.currentUser,
            allUsers: authSlice.state.users,
            notificationPrefs: settingsSlice.state.notificationPrefs
          };
          notifyDealStatusChanged(deal, oldStage || 'Новая', deal.stage, { context }).catch(() => {});
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
      saveDoc: saveDocWrapper,
      saveDocContent: contentSlice.actions.saveDocContent,
      deleteDoc: contentSlice.actions.deleteDoc,
      createFolder: contentSlice.actions.createFolder,
      deleteFolder: contentSlice.actions.deleteFolder,
      handleDocClick: handleDocClickWrapper,
      openDocModal: contentSlice.actions.openDocModal,
      openEditDocModal: contentSlice.actions.openEditDocModal,
      closeDocModal: contentSlice.actions.closeDocModal,
      saveDepartment: financeSlice.actions.saveDepartment, deleteDepartment: financeSlice.actions.deleteDepartment, saveFinanceCategory: financeSlice.actions.saveFinanceCategory, deleteFinanceCategory: financeSlice.actions.deleteFinanceCategory, saveFund: financeSlice.actions.saveFund, deleteFund: financeSlice.actions.deleteFund, updateFinancePlan: financeSlice.actions.updateFinancePlan, savePurchaseRequest: (request: PurchaseRequest) => {
        const existing = financeSlice.state.purchaseRequests.find(r => r.id === request.id);
        financeSlice.actions.savePurchaseRequest(request);
        if (!existing && authSlice.state.currentUser) {
          const department = financeSlice.state.departments.find(d => d.id === request.departmentId);
          const context: NotificationContext = {
            currentUser: authSlice.state.currentUser,
            allUsers: authSlice.state.users,
            notificationPrefs: settingsSlice.state.notificationPrefs
          };
          notifyPurchaseRequestCreated(
            { id: request.id, title: request.description, description: request.description, amount: request.amount },
            department?.name || 'Не указан',
            { context }
          ).catch(() => {});
        }
      },
      deletePurchaseRequest: financeSlice.actions.deletePurchaseRequest, saveFinancialPlanDocument: financeSlice.actions.saveFinancialPlanDocument, deleteFinancialPlanDocument: financeSlice.actions.deleteFinancialPlanDocument, saveFinancialPlanning: financeSlice.actions.saveFinancialPlanning, deleteFinancialPlanning: financeSlice.actions.deleteFinancialPlanning,
      saveWarehouse: inventorySlice.actions.saveWarehouse, deleteWarehouse: inventorySlice.actions.deleteWarehouse, saveInventoryItem: inventorySlice.actions.saveItem, deleteInventoryItem: inventorySlice.actions.deleteItem, createInventoryMovement: inventorySlice.actions.createMovement, createInventoryRevision: inventorySlice.actions.createRevision, updateInventoryRevision: inventorySlice.actions.updateRevision, postInventoryRevision: inventorySlice.actions.postRevision,
      savePosition: bpmSlice.actions.savePosition, deletePosition: bpmSlice.actions.deletePosition, saveProcess: bpmSlice.actions.saveProcess, deleteProcess: bpmSlice.actions.deleteProcess, completeProcessStepWithBranch,
      saveSalesFunnel: async (funnel: SalesFunnel) => {
          try {
              // Проверяем, существует ли воронка с таким id
              const existingFunnels = await api.funnels.getAll();
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
              const funnels = await api.funnels.getAll();
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
              const funnels = await api.funnels.getAll();
              setSalesFunnels(funnels);
              showNotification('Воронка удалена');
          } catch (error) {
              console.error('Ошибка удаления воронки:', error);
              showNotification('Ошибка удаления воронки');
          }
      },
      restoreUser: async (userId: string) => {
          try {
              const allUsers = await api.users.getAll();
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
              const allDocs = await api.docs.getAll();
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
              const allPosts = await api.contentPosts.getAll();
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
              const allEmployees = await api.employees.getAll();
              const employee = allEmployees.find(e => e.id === employeeId);
              if (!employee) return;
              const now = new Date().toISOString();
              const updated = allEmployees.map(e => e.id === employeeId ? { ...e, isArchived: false, updatedAt: now } : e);
              await api.employees.updateAll(updated);
              crmSlice.setters.setEmployeeInfos(updated);
              showNotification('Сотрудник восстановлен');
          } catch (error) {
              console.error('Ошибка восстановления сотрудника:', error);
              showNotification('Ошибка восстановления сотрудника');
          }
      },
      restoreProject: async (projectId: string) => {
          try {
              const allProjects = await api.projects.getAll();
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
              const allDepartments = await api.departments.getAll();
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
              const allCategories = await api.finance.getCategories();
              const category = allCategories.find(c => c.id === categoryId);
              if (!category) return;
              const now = new Date().toISOString();
              const updated = allCategories.map(c => c.id === categoryId ? { ...c, isArchived: false, updatedAt: now } : c);
              await api.finance.updateCategories(updated);
              financeSlice.setters.setFinanceCategories(updated);
              showNotification('Статья расходов восстановлена');
          } catch (error) {
              console.error('Ошибка восстановления статьи расходов:', error);
              showNotification('Ошибка восстановления статьи расходов');
          }
      },
      restoreSalesFunnel: async (funnelId: string) => {
          try {
              const allFunnels = await api.funnels.getAll();
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
              const allTables = await api.tables.getAll();
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
              const allProcesses = await api.bpm.getProcesses();
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
              const allDeals = await api.deals.getAll();
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
              const allClients = await api.clients.getAll();
              const client = allClients.find(c => c.id === clientId);
              if (!client) return;
              const now = new Date().toISOString();
              const updated = allClients.map(c => c.id === clientId ? { ...c, isArchived: false, updatedAt: now } : c);
              await api.clients.updateAll(updated);
              crmSlice.setters.setClients(updated);
              showNotification('Клиент восстановлен');
          } catch (error) {
              console.error('Ошибка восстановления клиента:', error);
              showNotification('Ошибка восстановления клиента');
          }
      },
      restoreContract: async (contractId: string) => {
          try {
              const allDeals = await api.deals.getAll();
              const deal = allDeals.find(d => d.id === contractId && d.recurring === true);
              if (!deal) return;
              const now = new Date().toISOString();
              const updated = allDeals.map(d => d.id === contractId ? { ...d, isArchived: false, updatedAt: now } : d);
              await api.deals.updateAll(updated);
              crmSlice.setters.setDeals(updated);
              showNotification('Договор восстановлен');
          } catch (error) {
              console.error('Ошибка восстановления договора:', error);
              showNotification('Ошибка восстановления договора');
          }
      },
      restoreMeeting: async (meetingId: string) => {
          try {
              const allMeetings = await api.meetings.getAll();
              const meeting = allMeetings.find(m => m.id === meetingId);
              if (!meeting) return;
              const now = new Date().toISOString();
              const updated = allMeetings.map(m => m.id === meetingId ? { ...m, isArchived: false, updatedAt: now } : m);
              await api.meetings.updateAll(updated);
              contentSlice.setters.setMeetings(updated);
              showNotification('Встреча восстановлена');
          } catch (error) {
              console.error('Ошибка восстановления встречи:', error);
              showNotification('Ошибка восстановления встречи');
          }
      },
      toggleDarkMode: settingsSlice.actions.toggleDarkMode, createTable: createTableWrapper, updateTable: settingsSlice.actions.updateTable, deleteTable: settingsSlice.actions.deleteTable, markAllRead: settingsSlice.actions.markAllRead, navigate: settingsSlice.actions.navigate, openSettings: settingsSlice.actions.openSettings, closeSettings: settingsSlice.actions.closeSettings, openCreateTable: settingsSlice.actions.openCreateTable, closeCreateTable: settingsSlice.actions.closeCreateTable, openEditTable: settingsSlice.actions.openEditTable, closeEditTable: settingsSlice.actions.closeEditTable, updateNotificationPrefs: settingsSlice.actions.updateNotificationPrefs, saveAutomationRule: settingsSlice.actions.saveAutomationRule, deleteAutomationRule: settingsSlice.actions.deleteAutomationRule, setActiveSpaceTab: settingsSlice.actions.setActiveSpaceTab,
      setActiveTableId: settingsSlice.setters.setActiveTableId, setCurrentView: settingsSlice.setters.setCurrentView, setViewMode: settingsSlice.setters.setViewMode, setSearchQuery: settingsSlice.setters.setSearchQuery,
      // Функция fillMockData полностью удалена
    }
  };
};

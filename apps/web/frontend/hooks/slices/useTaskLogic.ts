
import { useState, useEffect } from 'react';
import { Task, Project, StatusOption, PriorityOption, User, TaskComment, TaskAttachment, AutomationRule, Doc, NotificationPreferences } from '../../../types';
import { DEFAULT_NOTIFICATION_PREFS } from '../../../constants';
import { api } from '../../../backend/api';
import { uploadTaskAttachment } from '../../../services/localStorageService';
import { getTodayLocalDate } from '../../../utils/dateUtils';
import { notifyTaskCreated, notifyTaskStatusChanged, NotificationContext } from '../../../services/notificationService';
import { shouldSyncEditingTaskFromFresh } from '../../../utils/taskSyncUtils';
import { sendTelegramNotification } from '../../../services/telegramService';

export const useTaskLogic = (showNotification: (msg: string) => void, currentUser: User | null, users: User[], automationRules: AutomationRule[] = [], docs: Doc[] = [], onSaveDoc?: (docData: any, tableId?: string) => Doc | void, notificationPrefs?: NotificationPreferences) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [statuses, setStatuses] = useState<StatusOption[]>([]);
  const [priorities, setPriorities] = useState<PriorityOption[]>([]);
  
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Partial<Task> | null>(null); // Changed to Partial

  // Синхронизация карточки с массивом задач без JSON.stringify (O(n) по полям комментария)
  useEffect(() => {
      if (editingTask && isTaskModalOpen && editingTask.id) {
          const freshTask = tasks.find(t => t.id === editingTask.id);
          if (freshTask && shouldSyncEditingTaskFromFresh(freshTask, editingTask)) {
              setEditingTask(freshTask);
          }
      }
  }, [tasks, isTaskModalOpen, editingTask?.id]);

  const updateProjects = (p: Project[]) => { setProjects(p); void api.projects.updateAll(p).catch(() => showNotification('Ошибка сохранения проектов')); };
  const updateStatuses = (s: StatusOption[]) => { setStatuses(s); void api.statuses.updateAll(s).catch(() => showNotification('Ошибка сохранения статусов')); };
  const updatePriorities = (p: PriorityOption[]) => { setPriorities(p); void api.priorities.updateAll(p).catch(() => showNotification('Ошибка сохранения приоритетов')); };

  const quickCreateProject = (name: string) => {
      const newProject: Project = { id: `p-${Date.now()}`, name, isArchived: false };
      const updated = [...projects, newProject];
      updateProjects(updated);
      showNotification('Модуль создан');
  };

  const processAutomation = async (task: Task, trigger: 'task_status_changed' | 'task_created') => {
      const activeRules = automationRules.filter((r) => r.isActive && !r.isArchived && r.trigger === trigger);
      
      for (const rule of activeRules) {
          if (rule.conditions.moduleId && task.projectId !== rule.conditions.moduleId) continue;
          if (trigger === 'task_status_changed' && rule.conditions.statusTo && task.status !== rule.conditions.statusTo) continue;

          if (rule.action.type === 'telegram_message') {
              let msg = rule.action.template
                  .replace('{task_title}', task.title)
                  .replace('{status}', task.status)
                  .replace('{priority}', task.priority);
              
              let targetName = 'Все';
              if (rule.action.targetUser === 'assignee') {
                  const assignee = users.find(u => u.id === task.assigneeId || (task.assigneeIds && task.assigneeIds[0] === u.id));
                  if (assignee) targetName = assignee.name;
              } else if (rule.action.targetUser === 'admin') {
                  targetName = 'Админ';
              }

              msg = `🤖 <b>Автоматизация: ${rule.name}</b>\nДля: ${targetName}\n\n${msg}`;
              await sendTelegramNotification(msg, rule.action.buttons);
          }
      }
  };

  const saveTask = (taskData: Partial<Task>, activeTableId: string) => {
    let updatedTasks: Task[];
    // Используем переданные notificationPrefs или получаем из API (для обратной совместимости)
    const currentNotificationPrefs: NotificationPreferences = notificationPrefs ?? DEFAULT_NOTIFICATION_PREFS;

    if (taskData.id) {
        const oldTask = tasks.find(t => t.id === taskData.id);
        if (oldTask) {
            // Обновляем существующую задачу
            const oldStatus = oldTask.status;
            
            // Для задач (не идей) даты обязательны - если не указаны, используем дату создания или текущую дату
            const createdAtDate = oldTask.createdAt ? new Date(oldTask.createdAt).toISOString().split('T')[0] : getTodayLocalDate();
            const defaultStartDate = oldTask.startDate || createdAtDate;
            const defaultEndDate = oldTask.endDate || createdAtDate;
            
            // Определяем, является ли это задачей (не идеей)
            const isTask = (taskData.entityType || oldTask.entityType || 'task') !== 'idea';
            
            const newTask = { 
                ...oldTask, 
                ...taskData,
                // Для задач даты обязательны - если не указаны, используем старые значения или дату создания
                startDate: isTask ? (taskData.startDate || defaultStartDate) : taskData.startDate,
                endDate: isTask ? (taskData.endDate || defaultEndDate) : taskData.endDate,
                dealId: taskData.dealId !== undefined ? taskData.dealId : oldTask.dealId,
                source: taskData.source !== undefined ? taskData.source : oldTask.source,
                category: taskData.category !== undefined ? taskData.category : oldTask.category,
                updatedAt: new Date().toISOString() 
            } as Task;
            updatedTasks = tasks.map(t => t.id === taskData.id ? newTask : t);
            
            if (currentUser && taskData.status && oldStatus !== taskData.status) {
                const assigneeUser = newTask.assigneeId ? users.find(u => u.id === newTask.assigneeId) : null;
                const context: NotificationContext = {
                    currentUser,
                    allUsers: users,
                    notificationPrefs: currentNotificationPrefs
                };
                notifyTaskStatusChanged(newTask, oldStatus || '?', taskData.status, assigneeUser, { context }).catch(() => {});
                processAutomation(newTask, 'task_status_changed');
            }
        } else {
            // Задача с таким id не существует - создаем новую
            const isTask = (taskData.entityType || 'task') !== 'idea';
            const createdAtDate = taskData.createdAt ? new Date(taskData.createdAt).toISOString().split('T')[0] : getTodayLocalDate();
            
            const newTask: Task = {
                id: taskData.id,
                entityType: taskData.entityType || 'task',
                tableId: taskData.tableId || activeTableId,
                title: taskData.title || 'Новая задача',
                status: taskData.status || statuses[0]?.name || 'New',
                priority: taskData.priority || priorities[0]?.name || 'Low',
                assigneeId: taskData.assigneeId || null,
                assigneeIds: taskData.assigneeIds || (taskData.assigneeId ? [taskData.assigneeId] : []),
                projectId: taskData.projectId || null,
                // Для задач даты обязательны - используем переданные или дату создания
                startDate: isTask ? (taskData.startDate || createdAtDate) : taskData.startDate,
                endDate: isTask ? (taskData.endDate || createdAtDate) : taskData.endDate,
                isArchived: false,
                description: taskData.description,
                comments: taskData.comments || [],
                attachments: taskData.attachments || [],
                contentPostId: taskData.contentPostId,
                processId: taskData.processId,
                processInstanceId: taskData.processInstanceId,
                stepId: taskData.stepId,
                dealId: taskData.dealId,
                source: taskData.source || 'Задача',
                category: taskData.category,
                parentTaskId: taskData.parentTaskId !== undefined ? taskData.parentTaskId : undefined,
                createdAt: taskData.createdAt || new Date().toISOString(),
                createdByUserId: taskData.createdByUserId,
                linkedFeatureId: taskData.linkedFeatureId,
                linkedIdeaId: taskData.linkedIdeaId,
            };
            if (newTask.source && currentUser) {
              const systemMessage = `Создана задача из контент-плана "${newTask.source}"`;
              const systemComment: TaskComment = {
                id: `tc-system-${Date.now()}`,
                taskId: newTask.id,
                userId: currentUser.id,
                text: systemMessage,
                createdAt: new Date().toISOString(),
                isSystem: true,
              };
              newTask.comments = [systemComment, ...(newTask.comments || [])];
            }
            updatedTasks = [...tasks, newTask];

            if (currentUser) {
                const assigneeUser = users.find((u) => u.id === newTask.assigneeId) || null;
                const context: NotificationContext = {
                    currentUser,
                    allUsers: users,
                    notificationPrefs: currentNotificationPrefs
                };
                notifyTaskCreated(newTask, assigneeUser, { context }).catch(() => {});
                processAutomation(newTask, 'task_created');
            }
        }
    } else {
        // Создаем новую задачу без id
        const now = new Date().toISOString();
        const isTask = (taskData.entityType || 'task') !== 'idea';
        const createdAtDate = taskData.createdAt ? new Date(taskData.createdAt).toISOString().split('T')[0] : getTodayLocalDate();
        
        const newTask: Task = {
            id: `task-${Date.now()}`, 
            entityType: taskData.entityType || 'task',
            tableId: activeTableId || taskData.tableId || '', 
            title: taskData.title || 'Новая задача',
            status: taskData.status || statuses[0]?.name || 'New', 
            priority: taskData.priority || priorities[0]?.name || 'Low',
            assigneeId: taskData.assigneeId || null,
            assigneeIds: taskData.assigneeIds || (taskData.assigneeId ? [taskData.assigneeId] : []),
            projectId: taskData.projectId || null,
            // Для задач даты обязательны - используем переданные или дату создания (обе даты = дата создания)
            startDate: isTask ? (taskData.startDate || createdAtDate) : taskData.startDate,
            endDate: isTask ? (taskData.endDate || createdAtDate) : taskData.endDate,
            isArchived: false,
            description: taskData.description,
            comments: taskData.comments || [],
            attachments: taskData.attachments || [],
            contentPostId: taskData.contentPostId,
            processId: taskData.processId,
            processInstanceId: taskData.processInstanceId,
            stepId: taskData.stepId,
            dealId: taskData.dealId,
            source: taskData.source || 'Задача',
            category: taskData.category,
            parentTaskId: taskData.parentTaskId !== undefined ? taskData.parentTaskId : null,
            createdAt: taskData.createdAt || now,
            updatedAt: now,
            createdByUserId: taskData.createdByUserId || currentUser?.id, // Если не указан, используем текущего пользователя
            linkedFeatureId: taskData.linkedFeatureId,
            linkedIdeaId: taskData.linkedIdeaId,
        };

        // Если задача создана из контент-плана — системное сообщение в начало (не затирая комментарии к вложениям)
        if (newTask.source && currentUser) {
            const systemMessage = `Создана задача из контент-плана "${newTask.source}"`;
            const systemComment: TaskComment = {
                id: `tc-system-${Date.now()}`,
                taskId: newTask.id,
                userId: currentUser.id,
                text: systemMessage,
                createdAt: new Date().toISOString(),
                isSystem: true
            };
            newTask.comments = [systemComment, ...(newTask.comments || [])];
        }
        
        updatedTasks = [...tasks, newTask];
        
        if (currentUser) {
            const assigneeUser = users.find(u => u.id === newTask.assigneeId) || null;
            const context: NotificationContext = {
                currentUser,
                allUsers: users,
                notificationPrefs: currentNotificationPrefs
            };
            notifyTaskCreated(newTask, assigneeUser, { context }).catch(() => {});
            processAutomation(newTask, 'task_created');
        }
    }
    setTasks(updatedTasks);
    void api.tasks.updateAll(updatedTasks).catch(() => showNotification('Не удалось сохранить задачу. Проверьте подключение.'));
    setIsTaskModalOpen(false);
  };

  const addTaskComment = (taskId: string, text: string, isSystem: boolean = false) => {
      if (!currentUser) return;
      const comment: TaskComment = {
          id: `tc-${Date.now()}`,
          taskId,
          userId: currentUser.id,
          text,
          createdAt: new Date().toISOString(),
          isSystem
      };
      
      const updatedTasks = tasks.map(t => {
          if (t.id === taskId) {
              return { ...t, comments: [...(t.comments || []), comment] };
          }
          return t;
      });
      setTasks(updatedTasks);
      void api.tasks.updateAll(updatedTasks).catch(() => showNotification('Ошибка сохранения комментария'));
      if (editingTask && editingTask.id === taskId) {
          setEditingTask({ ...editingTask, comments: [...(editingTask.comments || []), comment] });
      }
  };

  const addTaskAttachment = async (taskId: string, file: File) => {
      try {
          showNotification('Загрузка файла...');
          
          const uploadResult = await uploadTaskAttachment(file, taskId);
          
          const attachmentId = `att-${Date.now()}`;
          
          let attachment: TaskAttachment = {
              id: attachmentId,
              taskId,
              name: file.name,
              url: uploadResult.url,
              type: file.type.split('/')[0] || 'file',
              uploadedAt: new Date().toISOString(),
              attachmentType: 'file',
              storagePath: uploadResult.path
          };

          if (onSaveDoc) {
              try {
                  const task = tasks.find((t) => t.id === taskId) || editingTask;
                  const docTitle = `${file.name} (из задачи: ${task?.title || 'Без названия'})`;
                  const newDoc = onSaveDoc({
                      title: docTitle,
                      url: uploadResult.url,
                      type: 'link',
                      tags: ['задача', taskId]
                  });
                  if (newDoc) {
                      attachment = { ...attachment, docId: newDoc.id };
                  }
              } catch (docError) {
                  console.error('Ошибка при создании документа:', docError);
              }
          }

          const comment: TaskComment = {
              id: `tc-${Date.now()}`,
              taskId,
              userId: currentUser?.id || '',
              text: `Прикрепил файл: ${file.name}`,
              createdAt: new Date().toISOString(),
              isSystem: true,
              attachmentId: attachmentId
          };

          const taskExists = tasks.some((t) => t.id === taskId);
          if (taskExists) {
            const tasksFinal = tasks.map((t) => {
              if (t.id !== taskId) return t;
              return {
                ...t,
                attachments: [...(t.attachments || []), attachment],
                comments: [...(t.comments || []), comment],
              };
            });
            setTasks(tasksFinal);
            void api.tasks.updateAll(tasksFinal).catch(() => showNotification('Ошибка сохранения задачи'));
          }

          setEditingTask((prev) => {
            if (!prev || prev.id !== taskId) return prev;
            return {
              ...prev,
              attachments: [...(prev.attachments || []), attachment],
              comments: [...(prev.comments || []), comment],
            };
          });

          showNotification('Файл загружен и добавлен в документы');
      } catch (error) {
          console.error('Ошибка при загрузке файла:', error);
          showNotification('Ошибка при загрузке файла: ' + (error instanceof Error ? error.message : 'Неизвестная ошибка'));
      }
  };

  const addTaskDocAttachment = (taskId: string, docId: string) => {
      const doc = docs.find(d => d.id === docId);
      if (!doc) return;
      
      const attachment: TaskAttachment = {
          id: `att-doc-${Date.now()}`,
          taskId,
          name: doc.title,
          url: doc.url || '#',
          type: 'document',
          uploadedAt: new Date().toISOString(),
          attachmentType: 'doc',
          docId: doc.id
      };

      const comment: TaskComment = {
          id: `tc-${Date.now()}`,
          taskId,
          userId: currentUser?.id || '',
          text: `Прикрепил документ: ${doc.title}`,
          createdAt: new Date().toISOString(),
          isSystem: true,
          attachmentId: attachment.id
      };

      const taskExists = tasks.some((t) => t.id === taskId);
      if (taskExists) {
        const tasksFinal = tasks.map((t) => {
          if (t.id !== taskId) return t;
          return {
            ...t,
            attachments: [...(t.attachments || []), attachment],
            comments: [...(t.comments || []), comment],
          };
        });
        setTasks(tasksFinal);
        void api.tasks.updateAll(tasksFinal).catch(() => showNotification('Ошибка сохранения задачи'));
      }

      setEditingTask((prev) => {
        if (!prev || prev.id !== taskId) return prev;
        return {
          ...prev,
          attachments: [...(prev.attachments || []), attachment],
          comments: [...(prev.comments || []), comment],
        };
      });
  };

  const removeTaskAttachment = (taskId: string, attachmentId: string) => {
    const strip = (att: TaskAttachment[] | undefined, com: TaskComment[] | undefined) => ({
      attachments: (att || []).filter((a) => a.id !== attachmentId),
      comments: (com || []).filter((c) => c.attachmentId !== attachmentId),
    });
    const taskExists = tasks.some((t) => t.id === taskId);
    if (taskExists) {
      const tasksFinal = tasks.map((t) => {
        if (t.id !== taskId) return t;
        const { attachments, comments } = strip(t.attachments, t.comments);
        return { ...t, attachments, comments };
      });
      setTasks(tasksFinal);
      void api.tasks.updateAll(tasksFinal).catch(() => showNotification('Ошибка сохранения задачи'));
    }
    setEditingTask((prev) => {
      if (!prev || prev.id !== taskId) return prev;
      const { attachments, comments } = strip(prev.attachments, prev.comments);
      return { ...prev, attachments, comments };
    });
  };

  const deleteTask = (taskId: string) => {
      const prev = tasks.find((t) => t.id === taskId);
      const body: Record<string, unknown> = { is_archived: true };
      if (prev?.version != null) body.version = prev.version;
      const updated = tasks.map(t => t.id === taskId ? { ...t, isArchived: true } : t);
      setTasks(updated);
      void api.tasks.patch(taskId, body).catch(() => showNotification('Ошибка архивирования задачи'));
      setIsTaskModalOpen(false);
      showNotification('Задача в архиве');
  };

  const restoreTask = (taskId: string) => {
      const prev = tasks.find((t) => t.id === taskId);
      const body: Record<string, unknown> = { is_archived: false };
      if (prev?.version != null) body.version = prev.version;
      const updated = tasks.map(t => t.id === taskId ? { ...t, isArchived: false } : t);
      setTasks(updated);
      void api.tasks.patch(taskId, body).catch(() => showNotification('Ошибка восстановления задачи'));
      showNotification('Задача восстановлена');
  };

  const permanentDeleteTask = (taskId: string) => {
      const updated = tasks.filter(t => t.id !== taskId);
      setTasks(updated);
      void api.tasks.remove(taskId).catch(() => showNotification('Ошибка удаления задачи'));
      showNotification('Задача удалена навсегда');
  };

  return {
    state: { tasks, projects, statuses, priorities, isTaskModalOpen, editingTask },
    setters: { setTasks, setProjects, setStatuses, setPriorities },
    actions: {
        updateProjects, updateStatuses, updatePriorities, quickCreateProject,
        saveTask, deleteTask, restoreTask, permanentDeleteTask,
        addTaskComment, addTaskAttachment, addTaskDocAttachment, removeTaskAttachment,
        openTaskModal: (task: Partial<Task> | null) => {
          if (task === null) {
            setEditingTask({ id: `task-${Date.now()}`, entityType: 'task' });
          } else if (!task.id) {
            setEditingTask({ ...task, id: `task-${Date.now()}` });
          } else {
            setEditingTask(task);
          }
          setIsTaskModalOpen(true);
        },
        closeTaskModal: () => setIsTaskModalOpen(false)
    }
  };
};

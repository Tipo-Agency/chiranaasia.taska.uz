
import { useState, useEffect } from 'react';
import { Task, Project, StatusOption, PriorityOption, User, TaskComment, TaskAttachment, AutomationRule, Doc } from '../../../types';
import { api } from '../../../backend/api';
import { uploadTaskAttachment } from '../../../services/localStorageService';
import { getTodayLocalDate, getDateDaysFromNow } from '../../../utils/dateUtils';
import { notifyTaskCreated, notifyTaskStatusChanged, NotificationContext } from '../../../services/notificationService';

export const useTaskLogic = (showNotification: (msg: string) => void, currentUser: User | null, users: User[], automationRules: AutomationRule[] = [], docs: Doc[] = [], onSaveDoc?: (docData: any, tableId?: string) => Doc | void, notificationPrefs?: NotificationPreferences) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [statuses, setStatuses] = useState<StatusOption[]>([]);
  const [priorities, setPriorities] = useState<PriorityOption[]>([]);
  
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Partial<Task> | null>(null); // Changed to Partial

  // Sync editingTask with latest data from tasks array (for realtime comments)
  useEffect(() => {
      if (editingTask && isTaskModalOpen && editingTask.id) {
          const freshTask = tasks.find(t => t.id === editingTask.id);
          if (freshTask) {
              // Проверяем изменения в комментариях, вложениях и других полях
              const commentsChanged = JSON.stringify(freshTask.comments || []) !== JSON.stringify(editingTask.comments || []);
              const attachmentsChanged = JSON.stringify(freshTask.attachments || []) !== JSON.stringify(editingTask.attachments || []);
              const statusChanged = freshTask.status !== editingTask.status;
              const priorityChanged = freshTask.priority !== editingTask.priority;
              
              // Обновляем editingTask при любых изменениях
              if (commentsChanged || attachmentsChanged || statusChanged || priorityChanged) {
                  setEditingTask(freshTask);
              }
          }
      }
  }, [tasks, isTaskModalOpen, editingTask?.id]);

  const updateProjects = (p: Project[]) => { setProjects(p); api.projects.updateAll(p).catch(() => showNotification('Ошибка сохранения проектов')); };
  const updateStatuses = (s: StatusOption[]) => { setStatuses(s); api.statuses.updateAll(s).catch(() => showNotification('Ошибка сохранения статусов')); };
  const updatePriorities = (p: PriorityOption[]) => { setPriorities(p); api.priorities.updateAll(p).catch(() => showNotification('Ошибка сохранения приоритетов')); };

  const quickCreateProject = (name: string) => {
      const newProject: Project = { id: `p-${Date.now()}`, name };
      const updated = [...projects, newProject];
      updateProjects(updated);
      showNotification('Модуль создан');
  };

  const processAutomation = async (task: Task, trigger: 'status_change' | 'new_task') => {
      const activeRules = automationRules.filter(r => r.isActive && r.trigger === trigger);
      
      for (const rule of activeRules) {
          if (rule.conditions.moduleId && task.projectId !== rule.conditions.moduleId) continue;
          if (trigger === 'status_change' && rule.conditions.statusTo && task.status !== rule.conditions.statusTo) continue;

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
    const currentNotificationPrefs = notificationPrefs || api.notificationPrefs.get();

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
                processAutomation(newTask, 'status_change');
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
                comments: [],
                attachments: [],
                contentPostId: taskData.contentPostId,
                processId: taskData.processId,
                processInstanceId: taskData.processInstanceId,
                stepId: taskData.stepId,
                dealId: taskData.dealId,
                source: taskData.source || 'Задача',
                category: taskData.category,
                parentTaskId: taskData.parentTaskId !== undefined ? taskData.parentTaskId : undefined,
                createdAt: taskData.createdAt || new Date().toISOString(),
                createdByUserId: taskData.createdByUserId
            };
            updatedTasks = [...tasks, newTask];
            
            if (currentUser) {
                const assigneeUser = users.find(u => u.id === newTask.assigneeId) || null;
                const context: NotificationContext = {
                    currentUser,
                    allUsers: users,
                    notificationPrefs: currentNotificationPrefs
                };
                notifyTaskCreated(newTask, assigneeUser, { context }).catch(() => {});
                processAutomation(newTask, 'new_task');
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
            comments: [],
            attachments: [],
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
            createdByUserId: taskData.createdByUserId || currentUser?.id // Если не указан, используем текущего пользователя
        };
        
        // Если задача создана из контент-плана, добавляем системное сообщение
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
            newTask.comments = [systemComment];
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
            processAutomation(newTask, 'new_task');
        }
    }
    setTasks(updatedTasks);
    api.tasks.updateAll(updatedTasks).catch(() => showNotification('Не удалось сохранить задачу. Проверьте подключение.'));
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
      api.tasks.updateAll(updatedTasks).catch(() => showNotification('Ошибка сохранения комментария'));
      if (editingTask && editingTask.id === taskId) {
          setEditingTask({ ...editingTask, comments: [...(editingTask.comments || []), comment] });
      }
  };

  const addTaskAttachment = async (taskId: string, file: File) => {
      try {
          showNotification('Загрузка файла...');
          
          const uploadResult = await uploadTaskAttachment(file, taskId);
          
          const attachmentId = `att-${Date.now()}`;
          
          const attachment: TaskAttachment = {
              id: attachmentId,
              taskId,
              name: file.name,
              url: uploadResult.url,
              type: file.type.split('/')[0] || 'file',
              uploadedAt: new Date().toISOString(),
              attachmentType: 'file',
              storagePath: uploadResult.path // Сохраняем путь в Storage для возможного удаления
          };

          // Обновляем задачу с вложением
          const updatedTasks = tasks.map(t => {
              if (t.id === taskId) {
                  return { ...t, attachments: [...(t.attachments || []), attachment] };
              }
              return t;
          });
          setTasks(updatedTasks);
          api.tasks.updateAll(updatedTasks).catch(() => showNotification('Ошибка сохранения задачи'));
          
          if (editingTask && editingTask.id === taskId) {
              setEditingTask({ ...editingTask, attachments: [...(editingTask.attachments || []), attachment] });
          }
          
          let finalTasks = updatedTasks;
          
          // Создаем документ в модуле документов
          if (onSaveDoc) {
              try {
                  const task = updatedTasks.find(t => t.id === taskId);
                  const docTitle = `${file.name} (из задачи: ${task?.title || 'Без названия'})`;
                  
                  const newDoc = onSaveDoc({
                      title: docTitle,
                      url: uploadResult.url,
                      type: 'link',
                      tags: ['задача', taskId]
                  });
                  
                  if (newDoc) {
                      // Связываем вложение с документом
                      const attachmentWithDoc: TaskAttachment = {
                          ...attachment,
                          docId: newDoc.id
                      };
                      
                      finalTasks = updatedTasks.map(t => {
                          if (t.id === taskId) {
                              const updatedAttachments = t.attachments?.map(a => 
                                  a.id === attachmentId ? attachmentWithDoc : a
                              ) || [attachmentWithDoc];
                              return { ...t, attachments: updatedAttachments };
                          }
                          return t;
                      });
                      setTasks(finalTasks);
                      api.tasks.updateAll(finalTasks).catch(() => showNotification('Ошибка сохранения задачи'));
                      
                      if (editingTask && editingTask.id === taskId) {
                          setEditingTask({ 
                              ...editingTask, 
                              attachments: editingTask.attachments?.map(a => 
                                  a.id === attachmentId ? attachmentWithDoc : a
                              ) || [attachmentWithDoc]
                          });
                      }
                  }
              } catch (docError) {
                  console.error('Ошибка при создании документа:', docError);
                  // Продолжаем работу даже если документ не создан
              }
          }
          
          // Создаем комментарий с ссылкой на вложение
          const comment: TaskComment = {
              id: `tc-${Date.now()}`,
              taskId,
              userId: currentUser?.id || '',
              text: `Прикрепил файл: ${file.name}`,
              createdAt: new Date().toISOString(),
              isSystem: true,
              attachmentId: attachmentId
          };
          
          const tasksWithComment = finalTasks.map(t => {
              if (t.id === taskId) {
                  return { ...t, comments: [...(t.comments || []), comment] };
              }
              return t;
          });
          setTasks(tasksWithComment);
          api.tasks.updateAll(tasksWithComment).catch(() => showNotification('Ошибка сохранения задачи'));
          
          if (editingTask && editingTask.id === taskId) {
              setEditingTask({ ...editingTask, comments: [...(editingTask.comments || []), comment] });
          }
          
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

      const updatedTasks = tasks.map(t => {
          if (t.id === taskId) {
              return { ...t, attachments: [...(t.attachments || []), attachment] };
          }
          return t;
      });
      setTasks(updatedTasks);
      api.tasks.updateAll(updatedTasks).catch(() => showNotification('Ошибка сохранения задачи'));
      
      if (editingTask && editingTask.id === taskId) {
          setEditingTask({ ...editingTask, attachments: [...(editingTask.attachments || []), attachment] });
      }
      
      // Создаем комментарий с ссылкой на документ
      const comment: TaskComment = {
          id: `tc-${Date.now()}`,
          taskId,
          userId: currentUser?.id || '',
          text: `Прикрепил документ: ${doc.title}`,
          createdAt: new Date().toISOString(),
          isSystem: true,
          attachmentId: attachment.id
      };
      
      const tasksWithComment = updatedTasks.map(t => {
          if (t.id === taskId) {
              return { ...t, comments: [...(t.comments || []), comment] };
          }
          return t;
      });
      setTasks(tasksWithComment);
      api.tasks.updateAll(tasksWithComment).catch(() => showNotification('Ошибка сохранения задачи'));
      
      if (editingTask && editingTask.id === taskId) {
          setEditingTask({ ...editingTask, comments: [...(editingTask.comments || []), comment] });
      }
  };

  const deleteTask = (taskId: string) => {
      const updated = tasks.map(t => t.id === taskId ? { ...t, isArchived: true } : t);
      setTasks(updated);
      api.tasks.updateAll(updated).catch(() => showNotification('Ошибка сохранения задачи'));
      setIsTaskModalOpen(false);
      showNotification('Задача в архиве');
  };

  const restoreTask = (taskId: string) => {
      const updated = tasks.map(t => t.id === taskId ? { ...t, isArchived: false } : t);
      setTasks(updated);
      api.tasks.updateAll(updated).catch(() => showNotification('Ошибка сохранения задачи'));
      showNotification('Задача восстановлена');
  };

  const permanentDeleteTask = (taskId: string) => {
      const updated = tasks.filter(t => t.id !== taskId);
      setTasks(updated);
      api.tasks.updateAll(updated).catch(() => showNotification('Ошибка сохранения задачи'));
      showNotification('Задача удалена навсегда');
  };

  return {
    state: { tasks, projects, statuses, priorities, isTaskModalOpen, editingTask },
    setters: { setTasks, setProjects, setStatuses, setPriorities },
    actions: {
        updateProjects, updateStatuses, updatePriorities, quickCreateProject,
        saveTask, deleteTask, restoreTask, permanentDeleteTask,
        addTaskComment, addTaskAttachment, addTaskDocAttachment,
        openTaskModal: (task: Partial<Task> | null) => { setEditingTask(task); setIsTaskModalOpen(true); },
        closeTaskModal: () => setIsTaskModalOpen(false)
    }
  };
};

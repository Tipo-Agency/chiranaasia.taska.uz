
import React, { useState, useEffect, useLayoutEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { computeAnchoredDropdownPosition } from '../utils/floatingDropdownPosition';
import { Project, Task, User, StatusOption, PriorityOption, TableCollection, TaskAttachment, Doc } from '../types';
import { X, Calendar as CalendarIcon, Users, Tag, Plus, CheckCircle2, Archive, AlignLeft, Paperclip, Send, File as FileIcon, Image as ImageIcon, MessageSquare, Download, Flag, Link as LinkIcon, Check, ChevronDown, Folder, ExternalLink, FileText, User as UserIcon, ListTree } from 'lucide-react';
import { DynamicIcon } from './AppIcons';
import { STANDARD_CATEGORIES } from './FunctionalityView';
import { TaskSelect } from './TaskSelect';
import { FilePreviewModal } from './FilePreviewModal';
import { getTodayLocalDate, getDateDaysFromNow, normalizeDateForInput } from '../utils/dateUtils';
import { DateRangeInput } from './ui/DateInput';
import { Button, SystemAlertDialog } from './ui';

interface TaskModalProps {
  users: User[];
  projects: Project[];
  statuses: StatusOption[];
  priorities: PriorityOption[];
  currentUser: User;
  tables?: TableCollection[]; // Добавляем для определения типа задачи
  docs?: Doc[]; // Документы для прикрепления
  onSave: (task: Partial<Task>) => void;
  onClose: () => void;
  onCreateProject: (name: string) => void;
  onDelete?: (taskId: string) => void;
  onAddComment?: (taskId: string, text: string) => void;
  onAddAttachment?: (taskId: string, file: File) => void;
  onAddDocAttachment?: (taskId: string, docId: string) => void; // Прикрепить документ
  task?: Partial<Task> | null; // Changed to Partial to accept pre-filled data
  /** Все задачи — для родительской задачи и подзадач */
  allTasks?: Task[];
}

const TaskModal: React.FC<TaskModalProps> = ({ 
    users, projects, statuses, priorities, currentUser, tables = [], docs = [],
    onSave, onClose, onCreateProject, onDelete, 
    onAddComment, onAddAttachment, onAddDocAttachment, task,
    allTasks = [],
}) => {
  // Определяем тип задачи (идея/функция/задача)
  const taskType = useMemo(() => {
    if (!task?.tableId) return 'task';
    const table = tables.find(t => t.id === task.tableId);
    if (table?.type === 'backlog') return 'idea';
    if (table?.type === 'functionality') return 'feature';
    return 'task';
  }, [task?.tableId, tables]);

  const taskTypeLabel = useMemo(() => {
    if (taskType === 'idea') return 'Идея';
    if (taskType === 'feature') return 'Функция';
    return 'Задача';
  }, [taskType]);

  const activeStatuses = useMemo(() => statuses.filter((s) => !s.isArchived), [statuses]);
  const activePriorities = useMemo(() => priorities.filter((p) => !p.isArchived), [priorities]);
  const activeProjects = useMemo(() => projects.filter((p) => !p.isArchived), [projects]);
  const activeUsers = useMemo(() => users.filter((u) => !u.isArchived), [users]);

  const hideChat = taskType === 'idea' || taskType === 'feature';
  // Fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<string>(activePriorities[0]?.name || '');
  const [projectId, setProjectId] = useState<string>(projects[0]?.id || '');
  const [assigneeId, setAssigneeId] = useState<string>('');
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [startDate, setStartDate] = useState(getTodayLocalDate());
  const [endDate, setEndDate] = useState(getTodayLocalDate());
  const [status, setStatus] = useState<string>(activeStatuses[0]?.name || '');
  const [contentPostId, setContentPostId] = useState<string | undefined>(undefined);
  const [category, setCategory] = useState<string>('');
  const [parentTaskId, setParentTaskId] = useState<string>('');
  
  // Comment Input
  const [commentText, setCommentText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [prevTaskId, setPrevTaskId] = useState<string | null>(null);
  const [isAssigneeDropdownOpen, setIsAssigneeDropdownOpen] = useState(false);
  const [isAttachmentModalOpen, setIsAttachmentModalOpen] = useState(false);
  const [showDocSelector, setShowDocSelector] = useState(false);
  const [systemAlert, setSystemAlert] = useState<{ open: boolean; title: string; message: string }>({
    open: false,
    title: '',
    message: '',
  });
  const [isCloseConfirmOpen, setIsCloseConfirmOpen] = useState(false);
  const [isParentTaskModalOpen, setIsParentTaskModalOpen] = useState(false);
  const [parentTaskSearch, setParentTaskSearch] = useState('');
  const assigneeTriggerRef = useRef<HTMLDivElement>(null);
  const assigneeMenuRef = useRef<HTMLDivElement>(null);
  const [currentTask, setCurrentTask] = useState<Partial<Task> | null>(task);
  const [previewFile, setPreviewFile] = useState<{ url: string; name: string; type: string } | null>(null);
  
  // Сохраняем исходные значения для отслеживания изменений
  const initialValuesRef = useRef<{
    title: string;
    description: string;
    priority: string;
    projectId: string;
    assigneeId: string;
    assigneeIds: string[];
    startDate: string;
    endDate: string;
    status: string;
    category: string;
    parentTaskId: string;
  } | null>(null);

  const parentTaskOptions = useMemo(() => {
    const sid = currentTask?.id;
    const rows = allTasks.filter(t =>
      !t.isArchived &&
      (t.entityType === 'task' || !t.entityType) &&
      t.id !== sid &&
      t.parentTaskId !== sid
    );
    return [
      { value: '', label: 'Нет (корневая)' },
      ...rows.map(t => ({ value: t.id, label: (t.title || 'Без названия').slice(0, 100) })),
    ];
  }, [allTasks, currentTask?.id]);

  const childTasks = useMemo(
    () => allTasks.filter(t => t.parentTaskId === currentTask?.id && !t.isArchived),
    [allTasks, currentTask?.id]
  );

  const parentTaskCandidates = useMemo(() => {
    const q = parentTaskSearch.trim().toLowerCase();
    return allTasks.filter((t) => {
      if (t.isArchived) return false;
      if (t.entityType && t.entityType !== 'task') return false;
      if (t.id === currentTask?.id) return false;
      if (t.parentTaskId === currentTask?.id) return false;
      if (!q) return true;
      return (t.title || '').toLowerCase().includes(q);
    });
  }, [allTasks, parentTaskSearch, currentTask?.id]);

  // Обновляем currentTask при изменении task пропа (для синхронизации комментариев)
  useEffect(() => {
    if (task) {
      setCurrentTask(task);
    } else {
      setCurrentTask(null);
    }
  }, [task]);

  useEffect(() => {
    // Determine if it's an existing task (has ID) or a new one
    if (currentTask && currentTask.id && currentTask.id !== prevTaskId) {
        const newTitle = currentTask.title || '';
        const newDescription = currentTask.description || '';
        const newPriority = currentTask.priority || activePriorities[0]?.name || '';
        const newProjectId = currentTask.projectId || '';
        const newAssigneeId = currentTask.assigneeId || '';
        const newAssigneeIds = currentTask.assigneeIds || (currentTask.assigneeId ? [currentTask.assigneeId] : []);
        const newStartDate = normalizeDateForInput(currentTask.startDate) || getTodayLocalDate();
        const newEndDate = normalizeDateForInput(currentTask.endDate) || getTodayLocalDate();
        const newStatus = currentTask.status || activeStatuses[0]?.name || '';
        const newCategory = currentTask.category || '';
        const newParent = currentTask.parentTaskId || '';
        
        setTitle(newTitle);
        setDescription(newDescription);
        setPriority(newPriority);
        setProjectId(newProjectId);
        setAssigneeId(newAssigneeId);
        setAssigneeIds(newAssigneeIds);
        setStartDate(newStartDate);
        setEndDate(newEndDate);
        setStatus(newStatus);
        setContentPostId(currentTask.contentPostId);
        setCategory(newCategory);
        setParentTaskId(newParent);
        setPrevTaskId(currentTask.id);
        
        // Сохраняем исходные значения
        initialValuesRef.current = {
          title: newTitle,
          description: newDescription,
          priority: newPriority,
          projectId: newProjectId,
          assigneeId: newAssigneeId,
          assigneeIds: newAssigneeIds,
          startDate: newStartDate,
          endDate: newEndDate,
          status: newStatus,
          category: newCategory,
          parentTaskId: newParent,
        };
    } else if (currentTask && !currentTask.id && prevTaskId !== 'new_prefilled') {
        // New task with pre-filled data (e.g. contentPostId, dealId)
        const newTitle = currentTask.title || '';
        const newDescription = currentTask.description || '';
        const newAssigneeId = currentTask.assigneeId || currentUser.id;
        const newAssigneeIds = currentTask.assigneeIds || (currentTask.assigneeId ? [currentTask.assigneeId] : [currentUser.id]);
        const newStatus = currentTask.status || activeStatuses[0]?.name || '';
        const newPriority = currentTask.priority || activePriorities[0]?.name || '';
        const newProjectId = currentTask.projectId || '';
        const newStartDate = normalizeDateForInput(currentTask.startDate) || getTodayLocalDate();
        const newEndDate = normalizeDateForInput(currentTask.endDate) || getTodayLocalDate();
        const newCategory = currentTask.category || '';
        const newParent = currentTask.parentTaskId || '';
        
        setTitle(newTitle);
        setDescription(newDescription);
        setAssigneeId(newAssigneeId);
        setAssigneeIds(newAssigneeIds);
        setStatus(newStatus);
        setPriority(newPriority);
        setProjectId(newProjectId);
        setStartDate(newStartDate);
        setEndDate(newEndDate);
        setContentPostId(currentTask.contentPostId);
        setCategory(newCategory);
        setParentTaskId(newParent);
        setPrevTaskId('new_prefilled');
        
        // Сохраняем исходные значения
        initialValuesRef.current = {
          title: newTitle,
          description: newDescription,
          priority: newPriority,
          projectId: newProjectId,
          assigneeId: newAssigneeId,
          assigneeIds: newAssigneeIds,
          startDate: newStartDate,
          endDate: newEndDate,
          status: newStatus,
          category: newCategory,
          parentTaskId: newParent,
        };
    } else if (!currentTask && prevTaskId !== 'new') {
        // Completely new task
        setTitle('');
        setDescription('');
        setAssigneeId(currentUser.id);
        setAssigneeIds([currentUser.id]);
        setStatus(activeStatuses[0]?.name || '');
        setContentPostId(undefined);
        setParentTaskId('');
        setPrevTaskId('new');
        
        // Сохраняем исходные значения (пустые для новой задачи)
        initialValuesRef.current = {
          title: '',
          description: '',
          priority: activePriorities[0]?.name || '',
          projectId: '',
          assigneeId: currentUser.id,
          assigneeIds: [currentUser.id],
          startDate: getTodayLocalDate(),
          endDate: getTodayLocalDate(),
          status: activeStatuses[0]?.name || '',
          category: '',
          parentTaskId: '',
        };
    }
  }, [currentTask, currentUser, prevTaskId, priorities, statuses, activePriorities, activeStatuses]);

  useEffect(() => {
    if (taskType !== 'idea' && !status && activeStatuses.length > 0) {
      setStatus(activeStatuses[0].name);
    }

    if (taskType !== 'idea' && taskType !== 'feature' && !priority && activePriorities.length > 0) {
      setPriority(activePriorities[0].name);
    }
  }, [taskType, status, priority, activeStatuses, activePriorities]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    // Определяем entityType
    let entityType: 'task' | 'idea' | 'feature' = 'task';
    if (taskType === 'idea') entityType = 'idea';
    else if (taskType === 'feature') entityType = 'feature';
    
    // Определяем source - если задача просто создана, то source = 'Задача'
    let source = currentTask?.source;
    if (!source && entityType === 'task' && !currentTask?.dealId && !currentTask?.processId && !currentTask?.contentPostId) {
      source = 'Задача';
    }
    
    // Для задач (не идей) даты обязательны - если не указаны, используем дату создания
    const createdAtDate = currentTask?.createdAt ? new Date(currentTask.createdAt).toISOString().split('T')[0] : getTodayLocalDate();
    const finalStartDate = taskType === 'idea' ? undefined : (startDate || createdAtDate);
    const finalEndDate = taskType === 'idea' ? undefined : (endDate || createdAtDate);
    
    onSave({
      id: currentTask?.id,
      entityType, // Добавляем entityType
      tableId: currentTask?.tableId || (taskType === 'idea' || taskType === 'feature' ? currentTask?.tableId : ''), // Для идей и функций обязательно
      title,
      description,
      projectId: projectId || null,
      assigneeId: assigneeIds[0] || null, 
      assigneeIds,
      // Для функций тоже сохраняем выбранный статус (не форсим "Не начато")
      status: taskType === 'idea' ? undefined : (status || (activeStatuses[0]?.name || 'Не начато')),
      startDate: finalStartDate,
      endDate: finalEndDate,
      priority: taskType === 'idea' ? undefined : priority,
      contentPostId,
      dealId: currentTask?.dealId, // Сохраняем dealId из исходной задачи
      source, // Используем определенный source
      category: taskType === 'feature' ? (category || undefined) : currentTask?.category, // Сохраняем category для функций
      parentTaskId: parentTaskId || null,
      createdAt: currentTask?.createdAt || new Date().toISOString(), // Добавляем createdAt
      createdByUserId: currentTask?.createdByUserId || currentUser?.id // Постановщик - текущий пользователь (или из задачи, если редактирование)
    });
    
    // Обновляем initialValuesRef после сохранения
    initialValuesRef.current = {
      title,
      description,
      priority,
      projectId,
      assigneeId: assigneeIds[0] || '',
      assigneeIds,
      startDate,
      endDate,
      status,
      category,
      parentTaskId,
    };
    
    // Закрываем модалку после сохранения
    onClose();
  };

  const handleSendComment = () => {
      if (!commentText.trim() || !currentTask?.id || !onAddComment) return;
      onAddComment(currentTask.id, commentText);
      setCommentText('');
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0] && currentTask?.id && onAddAttachment) {
          onAddAttachment(currentTask.id, e.target.files[0]);
      }
  };

  // Проверка наличия изменений
  const hasChanges = (): boolean => {
    if (!initialValuesRef.current) return false;
    
    const initial = initialValuesRef.current;
    const initialAssigneeIds = Array.isArray(initial.assigneeIds) 
      ? [...initial.assigneeIds].sort().join(',')
      : (initial.assigneeIds || '').split(',').filter(Boolean).sort().join(',');
    const currentAssigneeIds = [...assigneeIds].sort().join(',');
    
    // Для идей не проверяем статус, приоритет и сроки
    const baseChanges = (
      initial.title !== title ||
      initial.description !== description ||
      initial.projectId !== projectId ||
      initial.assigneeId !== assigneeId ||
      initialAssigneeIds !== currentAssigneeIds ||
      initial.category !== category ||
      (initial.parentTaskId || '') !== (parentTaskId || '')
    );
    
    if (taskType === 'idea') {
      return baseChanges;
    }
    
    return (
      baseChanges ||
      initial.priority !== priority ||
      initial.startDate !== startDate ||
      initial.endDate !== endDate ||
      initial.status !== status
    );
  };

  const handleClose = () => {
    if (hasChanges()) {
      setIsCloseConfirmOpen(true);
    } else {
      onClose();
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
          handleClose();
      }
  };

  const toggleAssignee = (uid: string) => {
      if (assigneeIds.includes(uid)) {
          setAssigneeIds(assigneeIds.filter(id => id !== uid));
      } else {
          setAssigneeIds([...assigneeIds, uid]);
      }
  };

  // Закрытие выпадающего списка при клике вне его
  const [assigneeMenuPos, setAssigneeMenuPos] = useState({ top: 0, left: 0, maxHeight: 256 });

  const updateAssigneeMenuPosition = () => {
      if (!assigneeTriggerRef.current) return;
      const rect = assigneeTriggerRef.current.getBoundingClientRect();
      const pos = computeAnchoredDropdownPosition(rect, { minWidth: Math.max(rect.width, 256) });
      setAssigneeMenuPos({ top: pos.top, left: pos.left, maxHeight: pos.maxHeight });
  };

  useLayoutEffect(() => {
      if (isAssigneeDropdownOpen) updateAssigneeMenuPosition();
  }, [isAssigneeDropdownOpen]);

  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          const t = event.target as Node;
          if (assigneeTriggerRef.current?.contains(t) || assigneeMenuRef.current?.contains(t)) return;
          setIsAssigneeDropdownOpen(false);
      };
      if (isAssigneeDropdownOpen) {
          document.addEventListener('mousedown', handleClickOutside, true);
      }
      return () => document.removeEventListener('mousedown', handleClickOutside, true);
  }, [isAssigneeDropdownOpen]);

  useEffect(() => {
      if (!isAssigneeDropdownOpen) return;
      const onScrollResize = () => updateAssigneeMenuPosition();
      window.addEventListener('scroll', onScrollResize, true);
      window.addEventListener('resize', onScrollResize);
      return () => {
          window.removeEventListener('scroll', onScrollResize, true);
          window.removeEventListener('resize', onScrollResize);
      };
  }, [isAssigneeDropdownOpen]);

  const ensureBadgeColor = (color: string | undefined) => {
    const fallback = 'bg-gray-100 dark:bg-[#333] text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-[#444]';
    if (!color || !color.trim()) return fallback;
    let cls = color.trim();
    if (!cls.includes('bg-')) cls = `${fallback} ${cls}`;
    if (!cls.includes('text-')) cls = `${cls} text-gray-800 dark:text-gray-200`;
    if (!cls.includes('border')) cls = `${cls} border border-transparent`;
    return cls;
  };

  const getStatusColor = (sName: string) => ensureBadgeColor(statuses.find(s => s.name === sName)?.color);
  const getPriorityColor = (pName: string) => ensureBadgeColor(priorities.find(p => p.name === pName)?.color);

  // Компонент для красивого выпадающего списка статусов и приоритетов
  const StatusPrioritySelect = ({ value, options, onChange, type, getColor }: { 
    value: string, 
    options: StatusOption[] | PriorityOption[], 
    onChange: (val: string) => void, 
    type: 'status' | 'priority',
    getColor: (name: string) => string
  }) => {
    const [isOpen, setIsOpen] = useState(false);
    const triggerRef = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const [menuPos, setMenuPos] = useState({ top: 0, left: 0, minWidth: 0, maxHeight: 256 });
    const colorClass = getColor(value);

    const updateMenuPos = () => {
        if (!triggerRef.current) return;
        const rect = triggerRef.current.getBoundingClientRect();
        const pos = computeAnchoredDropdownPosition(rect, { minWidth: rect.width });
        setMenuPos({ top: pos.top, left: pos.left, minWidth: pos.minWidth, maxHeight: pos.maxHeight });
    };

    useLayoutEffect(() => {
        if (isOpen) updateMenuPos();
    }, [isOpen]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const t = event.target as Node;
            if (triggerRef.current?.contains(t) || menuRef.current?.contains(t)) return;
            setIsOpen(false);
        };
        if (isOpen) document.addEventListener('mousedown', handleClickOutside, true);
        return () => document.removeEventListener('mousedown', handleClickOutside, true);
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        const onScrollResize = () => updateMenuPos();
        window.addEventListener('scroll', onScrollResize, true);
        window.addEventListener('resize', onScrollResize);
        return () => {
            window.removeEventListener('scroll', onScrollResize, true);
            window.removeEventListener('resize', onScrollResize);
        };
    }, [isOpen]);

    const menu = isOpen ? (
        <div
            ref={menuRef}
            className="fixed bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-lg shadow-xl z-[520] overflow-y-auto custom-scrollbar p-1"
            style={{
                top: menuPos.top,
                left: menuPos.left,
                minWidth: menuPos.minWidth,
                maxHeight: menuPos.maxHeight,
            }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.preventDefault()}
        >
            {options.map(opt => {
                const optColor = getColor(opt.name);
                return (
                    <div 
                        key={opt.id}
                        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                        onClick={() => {
                            onChange(opt.name);
                            setIsOpen(false);
                        }}
                        className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-gray-50 dark:hover:bg-[#303030] rounded-md cursor-pointer transition-colors whitespace-nowrap"
                    >
                        <span className={`text-xs font-medium ${optColor} px-1.5 py-0.5 rounded inline-block`}>{opt.name}</span>
                        {opt.name === value && <Check size={14} className="text-blue-500 dark:text-blue-400 flex-shrink-0 ml-auto"/>}
                    </div>
                );
            })}
        </div>
    ) : null;

    return (
        <div className="relative flex-1 min-w-0">
            <div 
                ref={triggerRef}
                onClick={() => setIsOpen(!isOpen)}
                className={`h-8 min-h-8 max-h-8 px-2.5 py-0 rounded-md text-xs font-medium cursor-pointer transition-all flex items-center justify-between ${colorClass}`}
            >
                <span className="truncate">{value || 'Не выбрано'}</span>
                <ChevronDown size={14} className={`ml-1.5 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </div>
            {typeof document !== 'undefined' && menu && createPortal(menu, document.body)}
        </div>
    );
  };

  // Компонент для выбора модуля
  const ModuleSelect = ({ value, options, onChange, onCreateProject }: {
    value: string,
    options: Project[],
    onChange: (val: string) => void,
    onCreateProject: (name: string) => void
  }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [newProjectName, setNewProjectName] = useState('');
    const moduleRowRef = useRef<HTMLDivElement>(null);
    const moduleTriggerRef = useRef<HTMLDivElement>(null);
    const moduleMenuRef = useRef<HTMLDivElement>(null);
    const [moduleMenuPos, setModuleMenuPos] = useState({ top: 0, left: 0, minWidth: 0, maxHeight: 256 });
    const selectedProject = options.find(p => p.id === value);

    // Функция для получения цвета модуля (как в TableView)
    const resolveProjectColor = (colorInput: string | undefined): string => {
        if (!colorInput) return 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700';
        if (colorInput.includes('bg-') && colorInput.includes('text-')) return colorInput;
        
        // Fallback для старых форматов
        let baseColor = 'gray';
        if (colorInput.includes('blue')) baseColor = 'blue';
        else if (colorInput.includes('green') || colorInput.includes('emerald')) baseColor = 'emerald';
        else if (colorInput.includes('red') || colorInput.includes('rose')) baseColor = 'rose';
        else if (colorInput.includes('yellow') || colorInput.includes('amber')) baseColor = 'amber';
        else if (colorInput.includes('orange')) baseColor = 'orange';
        else if (colorInput.includes('purple') || colorInput.includes('violet')) baseColor = 'violet';
        else if (colorInput.includes('pink')) baseColor = 'pink';
        else if (colorInput.includes('indigo')) baseColor = 'indigo';
        
        return `text-${baseColor}-600 dark:text-${baseColor}-400 bg-${baseColor}-50 dark:bg-${baseColor}-900/20 border border-${baseColor}-100 dark:border-${baseColor}-800`;
    };

    const updateModuleMenuPos = () => {
        if (!moduleTriggerRef.current) return;
        const rect = moduleTriggerRef.current.getBoundingClientRect();
        const pos = computeAnchoredDropdownPosition(rect, { minWidth: rect.width });
        setModuleMenuPos({ top: pos.top, left: pos.left, minWidth: pos.minWidth, maxHeight: pos.maxHeight });
    };

    useLayoutEffect(() => {
        if (isOpen) updateModuleMenuPos();
    }, [isOpen]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const t = event.target as Node;
            if (moduleRowRef.current?.contains(t) || moduleMenuRef.current?.contains(t)) return;
            setIsOpen(false);
        };
        if (isOpen) document.addEventListener('mousedown', handleClickOutside, true);
        return () => document.removeEventListener('mousedown', handleClickOutside, true);
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        const onScrollResize = () => updateModuleMenuPos();
        window.addEventListener('scroll', onScrollResize, true);
        window.addEventListener('resize', onScrollResize);
        return () => {
            window.removeEventListener('scroll', onScrollResize, true);
            window.removeEventListener('resize', onScrollResize);
        };
    }, [isOpen]);

    const handleCreateNew = () => {
        const name = newProjectName.trim();
        if (!name) return;
        onCreateProject(name);
        setIsCreateModalOpen(false);
        setNewProjectName('');
        setIsOpen(false);
        // Дожидаемся обновления списка модулей и выбираем только что созданный
        window.setTimeout(() => {
            const newProject = options.find((p) => p.name === name);
            if (newProject) onChange(newProject.id);
        }, 120);
    };

    const moduleMenu = isOpen ? (
        <div
            ref={moduleMenuRef}
            className="fixed bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-lg shadow-xl z-[520] overflow-y-auto custom-scrollbar p-1"
            style={{
                top: moduleMenuPos.top,
                left: moduleMenuPos.left,
                minWidth: moduleMenuPos.minWidth,
                maxHeight: moduleMenuPos.maxHeight,
            }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.preventDefault()}
        >
            <div 
                onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onClick={() => {
                    onChange('');
                    setIsOpen(false);
                }}
                className="px-2.5 py-1.5 hover:bg-gray-50 dark:hover:bg-[#303030] rounded-md cursor-pointer transition-colors text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap"
            >
                Без модуля
            </div>
            {options.map(project => {
                const projectColor = resolveProjectColor(project.color);
                return (
                    <div 
                        key={project.id}
                        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                        onClick={() => {
                            onChange(project.id);
                            setIsOpen(false);
                        }}
                        className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-gray-50 dark:hover:bg-[#303030] rounded-md cursor-pointer transition-colors whitespace-nowrap"
                    >
                        {project.icon && (
                            <DynamicIcon 
                                name={project.icon} 
                                className={project.color || 'text-gray-500'} 
                                size={14} 
                            />
                        )}
                        <span className={`text-xs font-medium ${projectColor} px-1.5 py-0.5 rounded inline-block flex-1`}>{project.name}</span>
                        {project.id === value && <Check size={14} className="text-blue-500 dark:text-blue-400 flex-shrink-0"/>}
                    </div>
                );
            })}
        </div>
    ) : null;

    return (
        <div className="relative flex-1 flex gap-2 min-w-0" ref={moduleRowRef}>
            <div 
                ref={moduleTriggerRef}
                onClick={() => setIsOpen(!isOpen)}
                className="flex-1 min-w-0 h-8 min-h-8 max-h-8 px-2.5 py-0 rounded-md text-xs font-medium cursor-pointer transition-all flex items-center gap-1.5 bg-gray-50 dark:bg-[#252525] border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-[#303030]"
            >
                {selectedProject ? (
                    <>
                        {selectedProject.icon && (
                            <DynamicIcon 
                                name={selectedProject.icon} 
                                className={selectedProject.color || 'text-gray-500'} 
                                size={14} 
                            />
                        )}
                        <span className={`truncate flex-1 ${resolveProjectColor(selectedProject.color)} px-1.5 py-0.5 rounded text-xs`}>
                            {selectedProject.name}
                        </span>
                    </>
                ) : (
                    <span className="truncate text-gray-500 dark:text-gray-400">Без модуля</span>
                )}
                <ChevronDown size={14} className={`ml-auto shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </div>
            <button 
                type="button" 
                onClick={() => {
                    setIsOpen(false);
                    setIsCreateModalOpen(true);
                }}
                className="h-8 w-8 shrink-0 flex items-center justify-center text-gray-400 hover:text-blue-500 hover:bg-gray-100 dark:hover:bg-[#303030] rounded-md transition-colors"
                title="Создать модуль"
            >
                <Plus size={16}/>
            </button>
            
            {typeof document !== 'undefined' && moduleMenu && createPortal(moduleMenu, document.body)}

            {isCreateModalOpen && (
                <div
                    className="fixed inset-0 z-[280] bg-black/35 flex items-center justify-center p-4"
                    onClick={() => {
                        setIsCreateModalOpen(false);
                        setNewProjectName('');
                    }}
                >
                    <div
                        className="w-full max-w-sm rounded-xl border border-gray-200 dark:border-[#444] bg-white dark:bg-[#252525] shadow-2xl p-4"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Новый модуль</h4>
                        <input
                            autoFocus
                            value={newProjectName}
                            onChange={(e) => setNewProjectName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleCreateNew();
                                }
                            }}
                            placeholder="Название модуля"
                            className="w-full rounded-lg border border-gray-300 dark:border-[#555] bg-white dark:bg-[#1f1f1f] px-3 py-2 text-sm text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-blue-500/40"
                        />
                        <div className="mt-3 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsCreateModalOpen(false);
                                    setNewProjectName('');
                                }}
                                className="px-3 py-2 rounded-lg border border-gray-300 dark:border-[#555] text-sm text-gray-700 dark:text-gray-200"
                            >
                                Отмена
                            </button>
                            <button
                                type="button"
                                onClick={handleCreateNew}
                                disabled={!newProjectName.trim()}
                                className={`px-3 py-2 rounded-lg text-sm text-white ${newProjectName.trim() ? 'bg-[#3337AD] hover:bg-[#2d3199]' : 'bg-[#3337AD]/50 cursor-not-allowed'}`}
                            >
                                Создать
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center z-[260] animate-in fade-in duration-200 p-0 md:p-4" onClick={handleBackdropClick} style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="bg-white dark:bg-[#1e1e1e] w-full h-full md:h-[min(680px,92vh)] md:max-h-[min(680px,92vh)] md:max-w-5xl md:rounded-xl shadow-2xl flex flex-col md:flex-row overflow-hidden border-0 md:border border-gray-200 dark:border-gray-800 rounded-t-2xl md:rounded-xl" onClick={e => e.stopPropagation()}>
        
        {/* LEFT COLUMN: DETAILS */}
        <div className="flex-1 flex flex-col min-w-0 border-b md:border-b-0 md:border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1e1e1e] min-h-0 h-full overflow-hidden">
            {/* Header */}
            <div className="p-3 md:p-3 border-b border-gray-100 dark:border-gray-800 flex justify-between items-start shrink-0">
                <div className="flex-1 mr-2 md:mr-3 min-w-0">
                    <label className="block text-[10px] uppercase font-bold text-gray-400 mb-1 ml-0.5">{taskTypeLabel}</label>
                    <input 
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        className="w-full text-sm font-semibold bg-white dark:bg-[#252525] border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500/20 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-600"
                        placeholder={`Введите название ${taskTypeLabel.toLowerCase()}...`}
                    />
                </div>
                <div className="flex gap-1 md:gap-2 mt-5 shrink-0">
                    {contentPostId && (
                        <div className="hidden sm:flex items-center gap-1 text-xs text-blue-500 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded" title="Привязано к посту">
                            <LinkIcon size={14} /> Пост
                        </div>
                    )}
                    {currentTask?.id && onDelete && (
                        <button type="button" onClick={() => onDelete(currentTask.id!)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors" title="В архив">
                            <Archive size={18} />
                        </button>
                    )}
                    <button onClick={handleClose} className="p-2 text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors">
                        <X size={20} />
                    </button>
                </div>
            </div>

            {/* Свойства (скролл при переполнении) + описание (растягивается) + вложения + сохранить */}
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="shrink-0 overflow-y-auto max-h-[min(40vh,300px)] md:max-h-[min(44vh,340px)] px-3 md:px-4 pt-2 pb-2 space-y-2 custom-scrollbar border-b border-gray-100 dark:border-gray-800">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 md:gap-x-8 gap-y-2.5 md:gap-y-2">
                    {/* Status - скрыт для идей */}
                    {taskType !== 'idea' && (
                        <div className="flex items-center gap-3 md:gap-4 min-h-8">
                            <div className="w-28 min-w-[7rem] shrink-0 pr-2 text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase flex items-center gap-2"><CheckCircle2 size={14} className="shrink-0 text-gray-400" strokeWidth={2} /> Статус</div>
                            <StatusPrioritySelect
                                value={status}
                                options={activeStatuses}
                                onChange={setStatus}
                                type="status"
                                getColor={getStatusColor}
                            />
                        </div>
                    )}

                    {/* Priority - скрыт для идей и функций */}
                    {taskType !== 'idea' && taskType !== 'feature' && (
                        <div className="flex items-center gap-3 md:gap-4 min-h-8">
                            <div className="w-28 min-w-[7rem] shrink-0 pr-2 text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase flex items-center gap-2"><Flag size={14} className="shrink-0 text-gray-400" strokeWidth={2} /> Приоритет</div>
                            <StatusPrioritySelect
                                value={priority}
                                options={activePriorities}
                                onChange={setPriority}
                                type="priority"
                                getColor={getPriorityColor}
                            />
                        </div>
                    )}

                    {/* Assignee Multiple */}
                    <div className="flex items-center gap-3 md:gap-4 min-h-8">
                        <div className="w-28 min-w-[7rem] shrink-0 pr-2 text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase flex items-center gap-2"><Users size={14} className="shrink-0 text-gray-400" strokeWidth={2} /> Исполнители</div>
                        <div className="flex-1 min-w-0">
                            <div 
                                ref={assigneeTriggerRef}
                                onClick={() => setIsAssigneeDropdownOpen(!isAssigneeDropdownOpen)}
                                className="flex items-center gap-1.5 cursor-pointer bg-gray-50 dark:bg-[#252525] border border-gray-200 dark:border-gray-700 rounded-md px-2.5 py-0 h-8 min-h-8 max-h-8 hover:bg-gray-100 dark:hover:bg-[#303030] transition-colors"
                            >
                                {assigneeIds.length > 0 ? (
                                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                        <div className="flex -space-x-1.5 shrink-0">
                                            {assigneeIds.map(uid => {
                                                const u = users.find(us => us.id === uid);
                                                return u ? <img key={uid} src={u.avatar} className="w-6 h-6 rounded-full border-2 border-white dark:border-[#252525] object-cover object-center" title={u.name} /> : null;
                                            })}
                                        </div>
                                        {assigneeIds.length === 1 && (() => {
                                            const singleUser = users.find(u => u.id === assigneeIds[0]);
                                            return singleUser ? (
                                                <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{singleUser.name}</span>
                                            ) : null;
                                        })()}
                                    </div>
                                ) : <span className="text-xs text-gray-400">Не назначено</span>}
                                <Plus size={14} className="text-gray-400 ml-auto shrink-0" />
                            </div>
                            
                            {typeof document !== 'undefined' && isAssigneeDropdownOpen && createPortal(
                                <div
                                    ref={assigneeMenuRef}
                                    className="fixed w-64 min-w-[16rem] bg-white dark:bg-[#252525] border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-[520] p-2 overflow-y-auto custom-scrollbar"
                                    style={{
                                        top: assigneeMenuPos.top,
                                        left: assigneeMenuPos.left,
                                        maxHeight: assigneeMenuPos.maxHeight,
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    onMouseDown={(e) => e.preventDefault()}
                                >
                                    {activeUsers.map(u => (
                                        <div 
                                            key={u.id} 
                                            onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                            onClick={() => {
                                                toggleAssignee(u.id);
                                            }} 
                                            className="flex items-center gap-3 p-2.5 hover:bg-gray-100 dark:hover:bg-[#333] rounded-lg cursor-pointer transition-colors"
                                        >
                                            <div className={`w-5 h-5 border-2 rounded flex items-center justify-center transition-colors ${assigneeIds.includes(u.id) ? 'bg-blue-600 border-blue-600' : 'border-gray-300 dark:border-gray-500 bg-white dark:bg-[#252525]'}`}>
                                                {assigneeIds.includes(u.id) && <CheckCircle2 size={12} className="text-white" />}
                                            </div>
                                            <img src={u.avatar} className="w-8 h-8 rounded-full border border-gray-200 dark:border-gray-600 object-cover object-center" alt="" />
                                            <span className="text-sm font-medium text-gray-800 dark:text-gray-200 flex-1 truncate">{u.name}</span>
                                        </div>
                                    ))}
                                </div>,
                                document.body
                            )}
                        </div>
                    </div>

                    {/* Module — сразу после исполнителей */}
                    <div className="flex items-center gap-3 md:gap-4 min-h-8">
                        <div className="w-28 min-w-[7rem] shrink-0 pr-2 text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase flex items-center gap-2"><Tag size={14} className="shrink-0 text-gray-400" strokeWidth={2} /> Модуль</div>
                        <ModuleSelect
                            value={projectId}
                            options={activeProjects}
                            onChange={setProjectId}
                            onCreateProject={onCreateProject}
                        />
                    </div>

                    {/* Постановщик - только для существующих задач */}
                    {currentTask?.id && currentTask?.createdByUserId && (() => {
                        const creator = users.find(u => u.id === currentTask.createdByUserId);
                        return creator ? (
                            <div className="flex items-center gap-3 md:gap-4 min-h-8">
                                <div className="w-28 min-w-[7rem] shrink-0 pr-2 text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase flex items-center gap-2"><UserIcon size={14} className="shrink-0 text-gray-400" strokeWidth={2} /> Постановщик</div>
                                <div className="flex-1 flex items-center gap-1.5 bg-gray-50 dark:bg-[#252525] border border-gray-200 dark:border-gray-700 rounded-md px-2.5 h-8 min-h-8 max-h-8">
                                    <img src={creator.avatar} className="w-6 h-6 rounded-full border border-gray-200 dark:border-gray-600 object-cover object-center shrink-0" />
                                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate leading-none">{creator.name}</span>
                                </div>
                            </div>
                        ) : null;
                    })()}

                    {/* Category - только для функций */}
                    {taskType === 'feature' && (
                        <div className="flex items-center gap-3 md:gap-4 min-h-8">
                            <div className="w-28 min-w-[7rem] shrink-0 pr-2 text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase flex items-center gap-2"><Folder size={14} className="shrink-0 text-gray-400" strokeWidth={2} /> Категория</div>
                            <div className="flex-1 min-w-0">
                              <TaskSelect
                                value={category || ''}
                                onChange={setCategory}
                                options={[
                                  { value: '', label: 'Не выбрана' },
                                  ...STANDARD_CATEGORIES.map((cat) => ({ value: cat.id, label: cat.name })),
                                ]}
                              />
                            </div>
                        </div>
                    )}

                    {/* Dates - скрыты для идей */}
                    {taskType !== 'idea' && (
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 col-span-1 md:col-span-2 min-h-8">
                            <div className="w-full sm:w-28 sm:min-w-[7rem] sm:pr-2 text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase flex items-center gap-2 shrink-0"><CalendarIcon size={14} className="shrink-0 text-gray-400" strokeWidth={2} /> Сроки</div>
                            <DateRangeInput
                              startDate={startDate}
                              endDate={endDate}
                              onChange={(s, e) => {
                                setStartDate(s);
                                setEndDate(e);
                              }}
                              className="flex-1 w-full sm:w-auto"
                              size="compact"
                            />
                        </div>
                    )}

                    {taskType === 'task' && (
                      <>
                        <div className="flex items-center gap-3 md:gap-4 min-h-8 col-span-1 md:col-span-2">
                          <div className="w-28 min-w-[7rem] shrink-0 pr-2 text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase flex items-center gap-2">
                            <ListTree size={14} className="shrink-0 text-gray-400" strokeWidth={2} /> Родитель
                          </div>
                          <div className="flex-1 min-w-0">
                            <button
                              type="button"
                              onClick={() => setIsParentTaskModalOpen(true)}
                              className="w-full h-8 min-h-8 px-2.5 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-[#252525] text-left text-sm text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#303030] transition-colors flex items-center justify-between"
                            >
                              <span className="truncate">
                                {parentTaskOptions.find((o) => o.value === parentTaskId)?.label || 'Нет (корневая)'}
                              </span>
                              <ChevronDown size={14} className="ml-2 shrink-0 text-gray-400" />
                            </button>
                          </div>
                        </div>
                        {currentTask?.id && childTasks.length > 0 && (
                          <div className="col-span-1 md:col-span-2 md:pl-32">
                            <div className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">Подзадачи ({childTasks.length})</div>
                            <ul className="space-y-0.5 max-h-24 overflow-y-auto custom-scrollbar text-sm text-gray-700 dark:text-gray-300">
                              {childTasks.map(ch => (
                                <li key={ch.id} className="truncate pl-1 border-l-2 border-[#3337AD]/40">· {ch.title || 'Без названия'}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </>
                    )}
                </div>
            </div>

                {/* Description — заполняет свободную высоту модалки */}
                <div className="flex-1 flex flex-col min-h-0 px-3 md:px-4 pt-3">
                    <label className="shrink-0 block text-[10px] font-bold text-gray-500 dark:text-gray-400 mb-1.5 uppercase flex items-center gap-2">
                        <AlignLeft size={16} className="text-gray-400" strokeWidth={2} /> Описание
                    </label>
                    <textarea 
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        className="w-full flex-1 min-h-[100px] bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-gray-700 rounded-lg p-2.5 text-sm text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-blue-500/20 outline-none resize-none placeholder-gray-400 dark:placeholder-gray-600"
                        placeholder="Добавьте описание задачи..."
                    />
                </div>

                {/* Attachments */}
                <div className="shrink-0 px-3 md:px-4 pt-3 mt-auto">
                    <div className="flex items-center justify-between mb-2">
                        <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase flex items-center gap-2">
                            <Paperclip size={16} className="text-gray-400" strokeWidth={2} /> Вложения
                        </label>
                        <button 
                            type="button" 
                            onClick={() => setIsAttachmentModalOpen(true)}
                            className="text-xs text-[#3337AD] dark:text-[#8b8ee0] font-medium flex items-center gap-1 px-2 py-1 hover:bg-[#3337AD]/10 dark:hover:bg-[#3337AD]/20 rounded transition-colors"
                        >
                            <Plus size={14}/> Добавить
                        </button>
                        <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileSelect} />
                    </div>
                    
                    {task?.attachments && task.attachments.length > 0 ? (
                        <div className="grid grid-cols-2 gap-3">
                            {task.attachments.map(att => (
                                <div 
                                    key={att.id} 
                                    className="flex items-center gap-3 p-2 bg-gray-50 dark:bg-[#252525] rounded-lg border border-gray-100 dark:border-gray-700 group cursor-pointer hover:bg-gray-100 dark:hover:bg-[#303030] transition-colors"
                                    onClick={() => setPreviewFile({ url: att.url, name: att.name, type: att.type })}
                                >
                                    <div className="w-8 h-8 rounded bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                                        {att.docId ? <FileText size={16}/> : att.type.includes('image') ? <ImageIcon size={16}/> : <FileIcon size={16}/>}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{att.name}</div>
                                        <div className="text-[10px] text-gray-500 dark:text-gray-400">{new Date(att.uploadedAt).toLocaleDateString()}</div>
                                    </div>
                                    <a 
                                        href={att.url} 
                                        download 
                                        onClick={(e) => e.stopPropagation()}
                                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors md:opacity-0 md:group-hover:opacity-100"
                                    >
                                        <Download size={14}/>
                                    </a>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-sm text-gray-400 italic">Нет вложений</div>
                    )}
                </div>
                
                {/* Footer Save */}
                <div className="shrink-0 px-3 md:px-4 mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 flex justify-end pb-8 md:pb-3">
                    <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        className="w-full md:w-auto"
                        onClick={() => handleSubmit()}
                    >
                        {currentTask?.id ? 'Сохранить' : `Создать ${taskTypeLabel.toLowerCase()}`}
                    </Button>
                </div>
            </div>
        </div>

        {/* RIGHT COLUMN: COMMENTS (Bottom on Mobile) */}
        {currentTask?.id && !hideChat && (
            <div className="w-full md:w-80 bg-gray-50 dark:bg-[#121212] border-t md:border-t-0 md:border-l border-gray-200 dark:border-gray-800 flex flex-col shrink-0 h-auto md:h-full md:min-h-0 min-h-[300px]">
                <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center gap-2 bg-gray-50 dark:bg-[#121212]">
                    <MessageSquare size={18} className="text-gray-500"/>
                    <h3 className="font-bold text-gray-700 dark:text-gray-200 text-sm">Комментарии</h3>
                    <span className="bg-gray-200 dark:bg-[#303030] text-gray-600 dark:text-gray-300 text-xs px-2 py-0.5 rounded-full font-medium">{currentTask.comments?.length || 0}</span>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-gray-50 dark:bg-[#121212]">
                    {currentTask.comments && currentTask.comments.length > 0 ? currentTask.comments.map(comment => {
                        const author = users.find(u => u.id === comment.userId);
                        const isMyComment = comment.userId === currentUser?.id;
                        
                        return (
                            <div key={comment.id} className={`flex gap-3 ${comment.isSystem ? 'opacity-70 justify-center' : isMyComment ? 'justify-end' : 'justify-start'}`}>
                                {comment.isSystem ? (
                                    <div className="text-xs text-gray-500 italic py-2 border-y border-gray-200 dark:border-gray-800 my-2 w-full text-center">
                                        {comment.text}
                                        {comment.attachmentId && currentTask?.attachments && (() => {
                                            const attachment = currentTask.attachments.find(a => a.id === comment.attachmentId);
                                            if (attachment) {
                                                const isImage = attachment.type === 'image' || (attachment.url && /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(attachment.url));
                                                return (
                                                    <div className="mt-2 flex items-center justify-center">
                                                        {isImage ? (
                                                            <div 
                                                                className="cursor-pointer rounded-lg overflow-hidden border border-gray-200 dark:border-[#333] hover:shadow-md transition-all max-w-[200px]"
                                                                onClick={() => setPreviewFile({ url: attachment.url, name: attachment.name, type: attachment.type || 'image' })}
                                                            >
                                                                <img 
                                                                    src={attachment.url} 
                                                                    alt={attachment.name}
                                                                    className="w-full h-auto max-h-[120px] object-cover"
                                                                />
                                                            </div>
                                                        ) : (
                                                            <div 
                                                                className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors text-xs font-medium cursor-pointer"
                                                                onClick={() => setPreviewFile({ url: attachment.url, name: attachment.name, type: attachment.type || 'file' })}
                                                            >
                                                                <FileIcon size={14} />
                                                                <span>{attachment.name}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            }
                                            return null;
                                        })()}
                                    </div>
                                ) : (
                                    <>
                                        {!isMyComment && (
                                            <div className="flex-shrink-0">
                                                <img src={author?.avatar} className="w-8 h-8 rounded-full border border-gray-200 dark:border-gray-700 object-cover object-center" alt={author?.name || ''} />
                                            </div>
                                        )}
                                        <div className={`flex flex-col ${isMyComment ? 'items-end' : 'items-start'} max-w-[80%]`}>
                                            <div className={`flex items-center gap-2 mb-1 ${isMyComment ? 'flex-row-reverse' : ''}`}>
                                                <span className="text-xs font-bold text-gray-800 dark:text-gray-300">{author?.name}</span>
                                                <span className="text-[10px] text-gray-400">{new Date(comment.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                            </div>
                                            <div className={`text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-[#1e1e1e] border border-gray-200 dark:border-gray-700 p-2.5 rounded-lg shadow-sm ${
                                                isMyComment ? 'rounded-tr-none' : 'rounded-tl-none'
                                            }`}>
                                                {comment.text}
                                            </div>
                                        </div>
                                        {isMyComment && (
                                            <div className="flex-shrink-0">
                                                <img src={author?.avatar} className="w-8 h-8 rounded-full border border-gray-200 dark:border-gray-700 object-cover object-center" alt={author?.name || ''} />
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        )
                    }) : (
                        <div className="text-center text-gray-400 text-xs mt-10">
                            Нет комментариев. Напишите что-нибудь!
                        </div>
                    )}
                </div>

                <div className="p-3 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#121212]">
                    <div className="relative">
                        <textarea 
                            value={commentText}
                            onChange={e => setCommentText(e.target.value)}
                            placeholder="Написать комментарий..."
                            className="w-full bg-white dark:bg-[#1e1e1e] text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-lg pl-3 pr-10 py-2 text-sm focus:ring-2 focus:ring-blue-500/50 resize-none min-h-[40px] max-h-[100px]"
                            onKeyDown={e => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendComment(); } }}
                        />
                        <button 
                            onClick={handleSendComment}
                            disabled={!commentText.trim()}
                            className="absolute right-2 bottom-1.5 p-1.5 text-blue-600 hover:bg-blue-100 dark:text-blue-400 dark:hover:bg-blue-900/30 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Send size={16} />
                        </button>
                    </div>
                    <div className="text-[10px] text-gray-400 mt-1 text-right pr-1">Enter - отправить</div>
                </div>
            </div>
        )}

        {isParentTaskModalOpen && (
          <div
            className="fixed inset-0 z-[280] bg-black/35 flex items-center justify-center p-4"
            onClick={() => {
              setIsParentTaskModalOpen(false);
              setParentTaskSearch('');
            }}
          >
            <div
              className="w-full max-w-2xl rounded-xl border border-gray-200 dark:border-[#444] bg-white dark:bg-[#252525] shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-4 py-3 border-b border-gray-100 dark:border-[#333] flex items-center justify-between gap-3">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Выбор родительской задачи</h4>
                <button
                  type="button"
                  onClick={() => {
                    setIsParentTaskModalOpen(false);
                    setParentTaskSearch('');
                  }}
                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-[#333] text-gray-500"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="p-4">
                <input
                  autoFocus
                  value={parentTaskSearch}
                  onChange={(e) => setParentTaskSearch(e.target.value)}
                  placeholder="Поиск задачи..."
                  className="w-full rounded-lg border border-gray-300 dark:border-[#555] bg-white dark:bg-[#1f1f1f] px-3 py-2 text-sm text-gray-900 dark:text-gray-100 outline-none focus:ring-2 focus:ring-blue-500/40"
                />
                <div className="mt-3 max-h-[420px] overflow-y-auto custom-scrollbar border border-gray-200 dark:border-[#333] rounded-lg">
                  <button
                    type="button"
                    onClick={() => {
                      setParentTaskId('');
                      setIsParentTaskModalOpen(false);
                      setParentTaskSearch('');
                    }}
                    className={`w-full text-left px-3 py-2 text-sm border-b border-gray-100 dark:border-[#333] ${
                      !parentTaskId ? 'bg-[#3337AD]/10 text-[#3337AD] dark:text-[#a8abf0]' : 'hover:bg-gray-50 dark:hover:bg-[#2a2a2a]'
                    }`}
                  >
                    Нет (корневая)
                  </button>
                  {parentTaskCandidates.length === 0 ? (
                    <div className="px-3 py-6 text-center text-sm text-gray-500">Ничего не найдено</div>
                  ) : (
                    parentTaskCandidates.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          setParentTaskId(t.id);
                          setIsParentTaskModalOpen(false);
                          setParentTaskSearch('');
                        }}
                        className={`w-full text-left px-3 py-2 text-sm border-b last:border-b-0 border-gray-100 dark:border-[#333] ${
                          parentTaskId === t.id ? 'bg-[#3337AD]/10 text-[#3337AD] dark:text-[#a8abf0]' : 'hover:bg-gray-50 dark:hover:bg-[#2a2a2a]'
                        }`}
                      >
                        <div className="truncate font-medium">{t.title || 'Без названия'}</div>
                        <div className="text-xs text-gray-500 truncate">{t.status || 'Без статуса'}</div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {isCloseConfirmOpen && (
          <div
            className="fixed inset-0 z-[285] bg-black/35 flex items-center justify-center p-4"
            onClick={() => setIsCloseConfirmOpen(false)}
          >
            <div
              className="w-full max-w-md rounded-xl border border-gray-200 dark:border-[#444] bg-white dark:bg-[#252525] shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-4 py-3 border-b border-gray-100 dark:border-[#333]">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Сохранить изменения?</h4>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Есть несохраненные изменения в задаче.
                </p>
              </div>
              <div className="px-4 py-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsCloseConfirmOpen(false);
                    onClose();
                  }}
                  className="px-3 py-2 rounded-lg border border-gray-200 dark:border-[#444] text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#2f2f2f]"
                >
                  Не сохранять
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsCloseConfirmOpen(false);
                    handleSubmit();
                  }}
                  className="px-3 py-2 rounded-lg text-sm text-white bg-[#3337AD] hover:bg-[#2d3199]"
                >
                  Сохранить
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Attachment Type Modal */}
        {isAttachmentModalOpen && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[290] animate-in fade-in duration-200" onClick={() => setIsAttachmentModalOpen(false)}>
            <div className="bg-white dark:bg-[#252525] rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-200 dark:border-[#333]" onClick={e => e.stopPropagation()}>
              <div className="p-4 border-b border-gray-100 dark:border-[#333] flex justify-between items-center">
                <h3 className="font-bold text-gray-800 dark:text-white">Добавить вложение</h3>
                <button onClick={() => setIsAttachmentModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-[#333]">
                  <X size={18} />
                </button>
              </div>
              <div className="p-6 space-y-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsAttachmentModalOpen(false);
                    fileInputRef.current?.click();
                  }}
                  className="w-full p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all flex flex-col items-center gap-2"
                >
                  <FileIcon size={24} className="text-gray-400" />
                  <span className="font-medium text-gray-700 dark:text-gray-300">Загрузить файл</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">PDF, изображение, документ</span>
                </button>
                {onAddDocAttachment && (
                  <button
                    type="button"
                    onClick={() => {
                      if (!currentTask?.id) {
                        setSystemAlert({
                          open: true,
                          title: 'Сначала сохраните задачу',
                          message: 'Сначала сохраните задачу, затем прикрепите документ.',
                        });
                        setIsAttachmentModalOpen(false);
                        return;
                      }
                      if (!docs || docs.length === 0) {
                        setSystemAlert({
                          open: true,
                          title: 'Документы не найдены',
                          message: 'Нет доступных документов в модуле документов.',
                        });
                        setIsAttachmentModalOpen(false);
                        return;
                      }
                      setIsAttachmentModalOpen(false);
                      setShowDocSelector(true);
                    }}
                    className="w-full p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all flex flex-col items-center gap-2"
                  >
                    <LinkIcon size={24} className="text-gray-400" />
                    <span className="font-medium text-gray-700 dark:text-gray-300">Прикрепить документ из модуля</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {docs && docs.length > 0 
                        ? 'Выбрать из существующих документов' 
                        : 'Нет доступных документов'}
                    </span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Document Selector Modal */}
        {showDocSelector && onAddDocAttachment && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[290] animate-in fade-in duration-200" onClick={() => setShowDocSelector(false)}>
            <div className="bg-white dark:bg-[#252525] rounded-xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-200 dark:border-[#333]" onClick={e => e.stopPropagation()}>
              <div className="p-4 border-b border-gray-100 dark:border-[#333] flex justify-between items-center">
                <h3 className="font-bold text-gray-800 dark:text-white">Выберите документ</h3>
                <button onClick={() => setShowDocSelector(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-[#333]">
                  <X size={18} />
                </button>
              </div>
              <div className="p-4 max-h-[400px] overflow-y-auto">
                {docs && docs.length > 0 ? (
                  <div className="space-y-2">
                    {docs.map(doc => (
                      <button
                        key={doc.id}
                        type="button"
                        onClick={() => {
                          if (currentTask?.id) {
                            onAddDocAttachment(currentTask.id, doc.id);
                            setShowDocSelector(false);
                          } else {
                            setSystemAlert({
                              open: true,
                              title: 'Сначала сохраните задачу',
                              message: 'Сначала сохраните задачу, затем прикрепите документ.',
                            });
                            setShowDocSelector(false);
                          }
                        }}
                        className="w-full p-3 text-left border border-gray-200 dark:border-[#333] rounded-lg hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all"
                      >
                        <div className="font-medium text-gray-800 dark:text-gray-200">{doc.title}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{doc.type === 'internal' ? 'Статья' : 'Ссылка'}</div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <p className="text-sm">Нет доступных документов в модуле документов</p>
                    <p className="text-xs mt-2">Создайте документы в модуле "Документы"</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      {previewFile && (
        <FilePreviewModal
          url={previewFile.url}
          name={previewFile.name}
          type={previewFile.type}
          onClose={() => setPreviewFile(null)}
        />
      )}
      <SystemAlertDialog
        open={systemAlert.open}
        title={systemAlert.title}
        message={systemAlert.message}
        onClose={() => setSystemAlert({ open: false, title: '', message: '' })}
      />
    </div>
  );
};

export default TaskModal;

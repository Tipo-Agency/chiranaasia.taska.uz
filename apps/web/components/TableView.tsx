
import React, { useRef, useState, useEffect, useLayoutEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { computeAnchoredDropdownPosition } from '../utils/floatingDropdownPosition';
import { Project, Task, User, StatusOption, PriorityOption, TableCollection, BusinessProcess } from '../types';
import { hasPermission } from '../utils/permissions';
import { Trash2, Layout, AlertCircle, ChevronDown, Check, Network, TrendingUp, FileText, Archive, Layers, Plus, CheckCircle2 as CheckIcon } from 'lucide-react';
import { normalizeDateForInput, isOverdue } from '../utils/dateUtils';
import { UserAvatar } from './features/common/UserAvatar';
import { DateInput } from './ui/DateInput';
import { TaskBadgeInline } from './ui/TaskBadgeInline';
import { isProjectLegacyFullTailwindClass, moduleProjectPillStyle } from '../utils/moduleProjectColor';

interface TableViewProps {
  tasks: Task[];
  users: User[];
  projects: Project[];
  statuses: StatusOption[];
  priorities: PriorityOption[];
  tables?: TableCollection[];
  isAggregator?: boolean;
  currentUser: User;
  businessProcesses?: BusinessProcess[];
  onUpdateTask: (taskId: string, updates: Partial<Task>) => void;
  onDeleteTask: (taskId: string) => void;
  onOpenTask: (task: Task) => void;
}

// Helper to convert loose color names/classes to full badges
const resolveColorClass = (colorInput: string, type: 'status' | 'priority' | 'project'): string => {
    if (!colorInput) {
        if (type === 'status') return 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700';
        if (type === 'priority') return 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700';
        return 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-[#333]';
    }
    
    if (colorInput.includes('bg-') && colorInput.includes('text-')) {
        return colorInput;
    }

    let baseColor = 'gray';
    if (colorInput.includes('blue')) baseColor = 'blue';
    else if (colorInput.includes('green') || colorInput.includes('emerald')) baseColor = 'emerald';
    else if (colorInput.includes('red') || colorInput.includes('rose')) baseColor = 'rose';
    else if (colorInput.includes('yellow') || colorInput.includes('amber')) baseColor = 'amber';
    else if (colorInput.includes('orange')) baseColor = 'orange';
    else if (colorInput.includes('purple') || colorInput.includes('violet')) baseColor = 'violet';
    else if (colorInput.includes('pink')) baseColor = 'pink';
    else if (colorInput.includes('indigo')) baseColor = 'indigo';

    if (type === 'project') {
        return `text-${baseColor}-600 dark:text-${baseColor}-400 bg-${baseColor}-50 dark:bg-${baseColor}-900/20 border border-${baseColor}-100 dark:border-${baseColor}-800`;
    }
    
    if (type === 'status') {
        return `bg-${baseColor}-100 dark:bg-${baseColor}-900/35 text-${baseColor}-800 dark:text-${baseColor}-200 border border-${baseColor}-200 dark:border-${baseColor}-800/60`;
    }
    
    if (type === 'priority') {
        return `bg-${baseColor}-100 dark:bg-${baseColor}-900/40 text-${baseColor}-700 dark:text-${baseColor}-300 border border-${baseColor}-300 dark:border-${baseColor}-700`;
    }
    
    return `bg-${baseColor}-100 text-${baseColor}-800 dark:bg-${baseColor}-900/30 dark:text-${baseColor}-300`;
};

const CustomSelect = ({ value, options, onChange, type }: { value: string, options: any[], onChange: (val: string) => void, type: 'status' | 'priority' | 'project' }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const [dropdownStyle, setDropdownStyle] = useState<{ top: number; left: number; minWidth: number; maxHeight: number }>({
        top: 0,
        left: 0,
        minWidth: 0,
        maxHeight: 256,
    });

    const selectedOption = options.find(o => (type === 'project' ? o.id : o.name) === value);
    const label = selectedOption ? selectedOption.name : (type === 'project' ? 'Без модуля' : value);
    const colorClass = selectedOption ? resolveColorClass(selectedOption.color, type) : 'text-gray-500 bg-gray-50 dark:bg-[#333]';
    const projectPillStyle = type === 'project' && selectedOption ? moduleProjectPillStyle(selectedOption.color) : null;
    const projectLegacyClass =
      type === 'project' && selectedOption && isProjectLegacyFullTailwindClass(selectedOption.color)
        ? selectedOption.color
        : null;

    const updatePosition = () => {
        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const pos = computeAnchoredDropdownPosition(rect, { minWidth: rect.width });
            setDropdownStyle({
                top: pos.top,
                left: pos.left,
                minWidth: pos.minWidth,
                maxHeight: pos.maxHeight,
            });
        }
    };

    useLayoutEffect(() => {
        if (isOpen) updatePosition();
    }, [isOpen]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            if (containerRef.current?.contains(target) || dropdownRef.current?.contains(target)) return;
            setIsOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside, true);
        return () => document.removeEventListener('mousedown', handleClickOutside, true);
    }, []);

    useEffect(() => {
        if (!isOpen) return;
        const handleScrollOrResize = () => {
            updatePosition();
        };
        window.addEventListener('scroll', handleScrollOrResize, true);
        window.addEventListener('resize', handleScrollOrResize);
        return () => {
            window.removeEventListener('scroll', handleScrollOrResize, true);
            window.removeEventListener('resize', handleScrollOrResize);
        };
    }, [isOpen]);

    const dropdownContent = isOpen ? (
        <div
            ref={dropdownRef}
            className="fixed bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-lg shadow-xl z-[9999] overflow-y-auto custom-scrollbar p-1.5"
            style={{
                top: dropdownStyle.top,
                left: dropdownStyle.left,
                minWidth: dropdownStyle.minWidth,
                maxHeight: dropdownStyle.maxHeight,
            }}
            onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}
            onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
        >
            {type === 'project' && (
                 <div 
                    onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    onClick={(e) => { 
                        e.preventDefault();
                        e.stopPropagation(); 
                        onChange(''); 
                        setIsOpen(false); 
                    }}
                    className="px-2 py-2 hover:bg-gray-50 dark:hover:bg-[#303030] rounded-lg cursor-pointer text-xs text-gray-500 dark:text-gray-400 mb-1 transition-colors whitespace-nowrap"
                >
                    Без модуля
                </div>
            )}
            {options.map(opt => {
                const val = type === 'project' ? opt.id : opt.name;
                const optColor = resolveColorClass(opt.color, type);
                const optProjectStyle = type === 'project' ? moduleProjectPillStyle(opt.color) : null;
                const optProjectLegacy =
                  type === 'project' && isProjectLegacyFullTailwindClass(opt.color) ? opt.color : null;
                return (
                    <div 
                        key={opt.id}
                        onMouseDown={(e) => { 
                            e.preventDefault(); 
                            e.stopPropagation(); 
                            if (type === 'status') {
                                onChange(val);
                                setIsOpen(false);
                            }
                        }}
                        onClick={(e) => { 
                            e.preventDefault();
                            e.stopPropagation(); 
                            onChange(val); 
                            setIsOpen(false); 
                        }}
                        className="flex items-center gap-2 px-2 py-2.5 hover:bg-gray-50 dark:hover:bg-[#303030] rounded-lg cursor-pointer transition-colors whitespace-nowrap"
                    >
                        {type === 'status' || type === 'priority' ? (
                          <TaskBadgeInline color={opt.color} className="text-xs px-2 py-0.5">
                            {opt.name}
                          </TaskBadgeInline>
                        ) : optProjectStyle ? (
                          <span
                            style={optProjectStyle}
                            className="text-xs font-medium px-2 py-0.5 rounded inline-block border border-solid"
                          >
                            {opt.name}
                          </span>
                        ) : optProjectLegacy ? (
                          <span className={`text-xs font-medium ${optProjectLegacy} px-2 py-0.5 rounded inline-block`}>
                            {opt.name}
                          </span>
                        ) : (
                          <span className={`text-xs font-medium ${optColor} px-2 py-0.5 rounded inline-block`}>
                            {opt.name}
                          </span>
                        )}
                        {val === value && <Check size={14} className="text-slate-600 dark:text-slate-300 flex-shrink-0 ml-auto"/>}
                    </div>
                );
            })}
        </div>
    ) : null;

    return (
        <div 
            className="relative w-full" 
            ref={containerRef} 
            onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}
            onMouseDown={(e) => { e.stopPropagation(); }}
        >
            <div 
                onClick={(e) => { 
                    e.stopPropagation(); 
                    e.preventDefault();
                    setIsOpen(!isOpen); 
                }}
                onMouseDown={(e) => { 
                    e.stopPropagation(); 
                    e.preventDefault();
                }}
                className={`px-2 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors w-full text-center flex items-center justify-center gap-1.5 hover:bg-black/5 dark:hover:bg-white/5 ${
                  type === 'status' || type === 'priority'
                    ? 'border border-transparent'
                    : type === 'project' && projectPillStyle
                      ? 'border border-solid'
                      : type === 'project' && projectLegacyClass
                        ? projectLegacyClass
                        : type === 'project'
                          ? 'text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-[#333] border border-gray-200 dark:border-gray-700'
                          : colorClass
                }`}
                style={type === 'project' && projectPillStyle ? projectPillStyle : undefined}
            >
                {type === 'status' || type === 'priority' ? (
                  selectedOption ? (
                    <TaskBadgeInline color={selectedOption.color} className="px-2 py-0.5 text-xs max-w-[calc(100%-1rem)]">
                      <span className="truncate">{label}</span>
                    </TaskBadgeInline>
                  ) : (
                    <span className="truncate text-gray-500">{label}</span>
                  )
                ) : (
                  <span
                    className={
                      projectPillStyle || projectLegacyClass ? 'truncate' : `truncate ${colorClass}`
                    }
                  >
                    {label}
                  </span>
                )}
                <ChevronDown size={12} className={`transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
            </div>
            {typeof document !== 'undefined' && dropdownContent && createPortal(dropdownContent, document.body)}
        </div>
    );
};

// Компонент для выбора ответственных в таблице (dropdown через portal — поверх таблицы)
const AssigneeCell: React.FC<{ task: Task, users: User[], onUpdate: (assigneeIds: string[]) => void }> = ({ task, users, onUpdate }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const [dropdownStyle, setDropdownStyle] = useState<{ top: number; left: number; maxHeight: number }>({
        top: 0,
        left: 0,
        maxHeight: 256,
    });
    const activeUsers = useMemo(() => users.filter((u) => !u.isArchived), [users]);

    const assignees = task.assigneeIds && task.assigneeIds.length > 0 
        ? task.assigneeIds.map(uid => users.find(u => u.id === uid)).filter(Boolean) as User[]
        : task.assigneeId 
            ? [users.find(u => u.id === task.assigneeId)].filter(Boolean) as User[]
            : [];
    
    const toggleAssignee = (userId: string) => {
        const currentIds = task.assigneeIds && task.assigneeIds.length > 0 
            ? [...task.assigneeIds]
            : task.assigneeId 
                ? [task.assigneeId]
                : [];
        
        if (currentIds.includes(userId)) {
            onUpdate(currentIds.filter(id => id !== userId));
        } else {
            onUpdate([...currentIds, userId]);
        }
    };

    const updatePosition = () => {
        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const pos = computeAnchoredDropdownPosition(rect, { minWidth: Math.max(rect.width, 256) });
            setDropdownStyle({ top: pos.top, left: pos.left, maxHeight: pos.maxHeight });
        }
    };

    useLayoutEffect(() => {
        if (isOpen) updatePosition();
    }, [isOpen]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            if (containerRef.current?.contains(target) || dropdownRef.current?.contains(target)) return;
            setIsOpen(false);
        };
        if (isOpen) document.addEventListener('mousedown', handleClickOutside, true);
        return () => document.removeEventListener('mousedown', handleClickOutside, true);
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        const handleScrollOrResize = () => updatePosition();
        window.addEventListener('scroll', handleScrollOrResize, true);
        window.addEventListener('resize', handleScrollOrResize);
        return () => {
            window.removeEventListener('scroll', handleScrollOrResize, true);
            window.removeEventListener('resize', handleScrollOrResize);
        };
    }, [isOpen]);

    const dropdownContent = isOpen ? (
        <div
            ref={dropdownRef}
            className="fixed w-64 min-w-[16rem] bg-white dark:bg-[#252525] border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-[9999] p-2 overflow-y-auto custom-scrollbar"
            style={{ top: dropdownStyle.top, left: dropdownStyle.left, maxHeight: dropdownStyle.maxHeight }}
        >
            {activeUsers.map(u => {
                const currentIds = task.assigneeIds && task.assigneeIds.length > 0 
                    ? task.assigneeIds
                    : task.assigneeId 
                        ? [task.assigneeId]
                        : [];
                const isSelected = currentIds.includes(u.id);
                return (
                    <div 
                        key={u.id} 
                        onClick={() => toggleAssignee(u.id)} 
                        className="flex items-center gap-3 p-2.5 hover:bg-gray-100 dark:hover:bg-[#333] rounded-lg cursor-pointer transition-colors"
                    >
                        <div className={`w-5 h-5 border-2 rounded flex items-center justify-center transition-colors ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300 dark:border-gray-500 bg-white dark:bg-[#252525]'}`}>
                            {isSelected && <CheckIcon size={12} className="text-white" />}
                        </div>
                        <UserAvatar user={u} size="md" />
                        <span className="text-sm font-medium text-gray-800 dark:text-gray-200 flex-1 truncate">{u.name}</span>
                    </div>
                );
            })}
        </div>
    ) : null;
    
    return (
        <div className="relative" ref={containerRef} onClick={(e) => e.stopPropagation()}>
            <div 
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 cursor-pointer hover:opacity-80 whitespace-nowrap"
            >
                {assignees.length === 0 ? (
                    <>
                        <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-[#333] border-2 border-white dark:border-[#252525] shrink-0"></div>
                        <span className="text-xs text-gray-500 dark:text-gray-400">Не назначено</span>
                    </>
                ) : assignees.length === 1 ? (
                    <>
                        <UserAvatar user={assignees[0]} size="sm" className="shrink-0" />
                        <span className="text-xs text-gray-700 dark:text-gray-300 truncate max-w-[100px] font-medium">{assignees[0].name}</span>
                    </>
                ) : (
                    <div className="flex -space-x-1.5 shrink-0">
                        {assignees.slice(0, 3).map((user) => (
                            <UserAvatar key={user.id} user={user} size="sm" className="border-2 border-white dark:border-[#252525]" />
                        ))}
                        {assignees.length > 3 && (
                            <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-[#333] border-2 border-white dark:border-[#252525] flex items-center justify-center text-[10px] font-bold text-gray-600 dark:text-gray-400">
                                +{assignees.length - 3}
                            </div>
                        )}
                    </div>
                )}
                <Plus size={12} className="text-gray-400 ml-auto shrink-0" />
            </div>
            {typeof document !== 'undefined' && dropdownContent && createPortal(dropdownContent, document.body)}
        </div>
    );
};

const DatePickerCell: React.FC<{ date: string, onChange: (val: string) => void }> = ({ date, onChange }) => {
    const normalizedDate = normalizeDateForInput(date);
    const dateIsOverdue = normalizedDate ? isOverdue(normalizedDate) : false;

    return (
        <div className={`w-full ${dateIsOverdue ? '[&>div>button]:border-red-300 [&>div>button]:bg-red-50 [&>div>button]:text-red-600 dark:[&>div>button]:border-red-800 dark:[&>div>button]:bg-red-900/20 dark:[&>div>button]:text-red-300' : ''}`}>
            <DateInput
                value={normalizedDate || ''}
                onChange={onChange}
                size="compact"
                className="w-full"
            />
        </div>
    );
};

const TableView: React.FC<TableViewProps> = ({ 
  tasks, 
  users, 
  projects, 
  statuses, 
  priorities, 
  tables = [],
  isAggregator = false,
  currentUser,
  businessProcesses = [],
  onUpdateTask,
  onDeleteTask,
  onOpenTask
}) => {

  const getSourcePageName = (tableId: string) => {
      const t = tables.find(tb => tb.id === tableId);
      return t ? t.name : '';
  };

  const getProcessName = (task: Task) => {
      if (!task.processId) return null;
      return businessProcesses.find(p => p.id === task.processId)?.title || null;
  };

  const activeStatuses = useMemo(() => statuses.filter((s) => !s.isArchived), [statuses]);
  const activePriorities = useMemo(() => priorities.filter((p) => !p.isArchived), [priorities]);
  const activeProjects = useMemo(() => projects.filter((p) => !p.isArchived), [projects]);

  const getTaskSource = (task: Task) => {
      // Используем entityType для определения источника
      if (task.entityType === 'idea') {
          return { name: 'Идеи', isProcess: false, isBacklog: true };
      }
      if (task.entityType === 'feature') {
          return { name: 'Функционал', isProcess: false, isFunctionality: true };
      }
      if (task.entityType === 'purchase_request') {
          return { name: 'Заявка', isProcess: false, isRequest: true };
      }
      // Для обычных задач определяем по связям и source
      if (task.dealId) {
          return { name: 'Сделка', isProcess: false, isDeal: true };
      }
      if (task.processId) {
          const processName = getProcessName(task);
          return { name: processName || 'Процесс', isProcess: true };
      }
      if (task.source) {
          if (task.source === 'Идеи' || task.source === 'Беклог') {
              return { name: 'Идеи', isProcess: false, isBacklog: true };
          }
          if (task.source === 'Функционал') {
              return { name: 'Функционал', isProcess: false, isFunctionality: true };
          }
          // Для других источников (контент-планы и т.д.)
          return { name: task.source, isProcess: false, isContent: true };
      }
      return { name: 'Задача', isProcess: false, isTask: true };
  };

  return (
    <div className="h-full flex flex-col">
      <div className="bg-white dark:bg-[#323232] border border-gray-200 dark:border-[#3f3f3f] rounded-xl shadow-sm overflow-hidden flex-1 flex flex-col min-h-0">
        <div className="flex-1 overflow-auto custom-scrollbar min-h-0">
          <table className="min-w-full text-left text-sm border-collapse">
            <thead className="sticky top-0 bg-gray-50 dark:bg-[#2c2c2c] z-10 border-b border-gray-200 dark:border-[#3f3f3f]">
              <tr>
                <th className="py-3 px-4 font-semibold text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap" style={{ width: '200px', minWidth: '200px' }}>Задача</th>
                {isAggregator && <th className="py-3 px-4 font-semibold text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap" style={{ width: '96px', minWidth: '96px' }}>Источник</th>}
                <th className="py-3 px-4 font-semibold text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap" style={{ width: '120px', minWidth: '120px' }}>Статус</th>
                <th className="py-3 px-4 font-semibold text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap" style={{ width: '144px', minWidth: '144px' }}>Ответственный</th>
                <th className="py-3 px-4 font-semibold text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap" style={{ width: '104px', minWidth: '104px' }}>Приоритет</th>
                <th className="py-3 px-4 font-semibold text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap" style={{ width: '120px', minWidth: '120px' }}>Модуль</th>
                <th className="py-3 px-4 font-semibold text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap" style={{ width: '60px', minWidth: '60px' }}>Срок</th>
                {hasPermission(currentUser, 'settings.general') && <th className="py-3 px-4 w-10"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-[#3f3f3f] bg-white dark:bg-[#323232]">
              {tasks.map(task => {
                  const source = isAggregator ? getTaskSource(task) : null;
                  return (
                      <tr key={task.id} className="hover:bg-gray-50 dark:hover:bg-[#3a3a3a] group transition-colors">
                          {/* Задача */}
                          <td className="py-3 px-4 align-middle">
                              <div className="font-medium text-gray-800 dark:text-gray-200 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 truncate transition-colors max-w-[180px]" onClick={() => onOpenTask(task)}>
                                  {task.title}
                              </div>
                          </td>
                          
                          {/* Источник */}
                          {isAggregator && source && (
                              <td className="py-3 px-4 align-middle">
                                  <div className="flex items-center gap-1.5 text-xs whitespace-nowrap">
                                      {source.isProcess ? (
                                          <>
                                              <Network size={12} className="text-indigo-500 flex-shrink-0" />
                                              <span className="truncate max-w-[70px] text-indigo-600 dark:text-indigo-400 font-medium">{source.name}</span>
                                          </>
                                      ) : (source as any).isDeal ? (
                                          <>
                                              <TrendingUp size={12} className="text-blue-500 flex-shrink-0" />
                                              <span className="truncate max-w-[70px] text-blue-600 dark:text-blue-400 font-medium">{source.name}</span>
                                          </>
                                      ) : (source as any).isContent ? (
                                          <>
                                              <FileText size={12} className="text-pink-500 flex-shrink-0" />
                                              <span className="truncate max-w-[70px] text-pink-600 dark:text-pink-400 font-medium">{source.name}</span>
                                          </>
                                      ) : (source as any).isBacklog ? (
                                          <>
                                              <Archive size={12} className="text-orange-500 flex-shrink-0" />
                                              <span className="truncate max-w-[70px] text-orange-600 dark:text-orange-400 font-medium">{source.name}</span>
                                          </>
                                      ) : (source as any).isFunctionality ? (
                                          <>
                                              <Layers size={12} className="text-purple-500 flex-shrink-0" />
                                              <span className="truncate max-w-[70px] text-purple-600 dark:text-purple-400 font-medium">{source.name}</span>
                                          </>
                                      ) : (source as any).isTask ? (
                                          <>
                                              <Layout size={12} className="text-gray-500 dark:text-gray-400 flex-shrink-0" />
                                              <span className="truncate max-w-[70px] text-gray-500 dark:text-gray-400">{source.name}</span>
                                          </>
                                      ) : (
                                          <>
                                              <Layout size={12} className="text-gray-500 dark:text-gray-400 flex-shrink-0" />
                                              <span className="truncate max-w-[70px] text-gray-500 dark:text-gray-400">{source.name}</span>
                                          </>
                                      )}
                                  </div>
                              </td>
                          )}

                          {/* Статус */}
                          <td 
                              className="py-3 px-4 align-middle" 
                              onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}
                              onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
                          >
                              <CustomSelect 
                                  value={task.status} 
                                  options={activeStatuses} 
                                  type="status" 
                                  onChange={(val) => {
                                      onUpdateTask(task.id, { status: val });
                                  }} 
                              />
                          </td>

                          {/* Ответственный - с выпадающим списком */}
                          <td className="py-3 px-4 align-middle" onClick={(e) => e.stopPropagation()}>
                              <AssigneeCell 
                                  task={task} 
                                  users={users} 
                                  onUpdate={(assigneeIds) => onUpdateTask(task.id, { assigneeIds, assigneeId: assigneeIds[0] || null })} 
                              />
                          </td>

                          {/* Приоритет */}
                          <td className="py-3 px-4 align-middle" onClick={(e) => e.stopPropagation()}>
                              <CustomSelect 
                                  value={task.priority} 
                                  options={activePriorities} 
                                  type="priority" 
                                  onChange={(val) => onUpdateTask(task.id, { priority: val })} 
                              />
                          </td>

                          {/* Модуль */}
                          <td className="py-3 px-4 align-middle" onClick={(e) => e.stopPropagation()}>
                              <CustomSelect 
                                  value={task.projectId || ''} 
                                  options={activeProjects} 
                                  type="project" 
                                  onChange={(val) => onUpdateTask(task.id, { projectId: val || null })} 
                              />
                          </td>

                          {/* Срок */}
                          <td className="py-3 px-4 align-middle" onClick={(e) => e.stopPropagation()}>
                              <DatePickerCell date={task.endDate} onChange={(val) => onUpdateTask(task.id, { endDate: val })} />
                          </td>
                          
                          {/* Удаление */}
                          {hasPermission(currentUser, 'settings.general') && (
                              <td className="py-3 px-4 align-middle text-right">
                                  <button 
                                      onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          onDeleteTask(task.id);
                                      }}
                                      className="text-gray-400 hover:text-red-500 md:opacity-0 md:group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/30"
                                      title="В архив"
                                  >
                                      <Trash2 size={14} />
                                  </button>
                              </td>
                          )}
                      </tr>
                  );
              })}
              {tasks.length === 0 && (
                  <tr>
                      <td colSpan={isAggregator ? 8 : 7} className="text-center py-12 text-gray-500 dark:text-gray-400">
                          <div className="flex flex-col items-center gap-2">
                              <AlertCircle size={24} className="opacity-30 text-gray-400 dark:text-gray-500"/>
                              <span className="text-sm">Задач нет</span>
                          </div>
                      </td>
                  </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default TableView;

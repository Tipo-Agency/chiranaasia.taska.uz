
import React, { useRef, useState, useEffect } from 'react';
import { Project, Role, Task, User, StatusOption, PriorityOption, TableCollection, BusinessProcess } from '../types';
import { Trash2, Calendar, Layout, AlertCircle, ChevronDown, Check, Network, TrendingUp, FileText, Archive, Layers, Plus, CheckCircle2 as CheckIcon } from 'lucide-react';
import { formatDate, normalizeDateForInput, isOverdue } from '../utils/dateUtils';
import { UserAvatar } from './features/common/UserAvatar';

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
        return `bg-${baseColor}-500 dark:bg-${baseColor}-600 text-white border border-${baseColor}-600 dark:border-${baseColor}-500`;
    }
    
    if (type === 'priority') {
        return `bg-${baseColor}-100 dark:bg-${baseColor}-900/40 text-${baseColor}-700 dark:text-${baseColor}-300 border border-${baseColor}-300 dark:border-${baseColor}-700`;
    }
    
    return `bg-${baseColor}-100 text-${baseColor}-800 dark:bg-${baseColor}-900/30 dark:text-${baseColor}-300`;
};

const CustomSelect = ({ value, options, onChange, type }: { value: string, options: any[], onChange: (val: string) => void, type: 'status' | 'priority' | 'project' }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const selectedOption = options.find(o => (type === 'project' ? o.id : o.name) === value);
    const label = selectedOption ? selectedOption.name : (type === 'project' ? 'Без модуля' : value);
    const colorClass = selectedOption ? resolveColorClass(selectedOption.color, type) : 'text-gray-500 bg-gray-50 dark:bg-[#333]';

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        // Используем capture phase для более раннего перехвата
        document.addEventListener('mousedown', handleClickOutside, true);
        return () => document.removeEventListener('mousedown', handleClickOutside, true);
    }, []);

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
                className={`px-2 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all w-full text-center flex items-center justify-center gap-1.5 hover:scale-105 active:scale-95 shadow-sm ${colorClass}`}
            >
                <span className="truncate">{label}</span>
                <ChevronDown size={12} className={`transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
            </div>
            
            {isOpen && (
                <div 
                    className="absolute top-full left-0 mt-1 w-auto min-w-full bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-lg shadow-xl z-50 max-h-64 overflow-y-auto custom-scrollbar p-1.5" 
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
                        return (
                            <div 
                                key={opt.id}
                                onMouseDown={(e) => { 
                                    e.preventDefault(); 
                                    e.stopPropagation(); 
                                    // Вызываем onChange сразу на mousedown для более быстрой реакции
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
                                <span className={`text-xs font-medium ${optColor} px-2 py-0.5 rounded inline-block`}>{opt.name}</span>
                                {val === value && <Check size={14} className="text-blue-500 dark:text-blue-400 flex-shrink-0 ml-auto"/>}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

// Компонент для выбора ответственных в таблице
const AssigneeCell: React.FC<{ task: Task, users: User[], onUpdate: (assigneeIds: string[]) => void }> = ({ task, users, onUpdate }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    
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
    
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);
    
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
            
            {isOpen && (
                <div className="absolute top-full left-0 mt-1 w-64 bg-white dark:bg-[#252525] border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50 p-2 max-h-64 overflow-y-auto custom-scrollbar">
                    {users.map(u => {
                        const currentIds = task.assigneeIds && task.assigneeIds.length > 0 
                            ? task.assigneeIds
                            : task.assigneeId 
                                ? [task.assigneeId]
                                : [];
                        const isSelected = currentIds.includes(u.id);
                        return (
                            <div 
                                key={u.id} 
                                onClick={() => {
                                    toggleAssignee(u.id);
                                }} 
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
            )}
        </div>
    );
};

const DatePickerCell: React.FC<{ date: string, onChange: (val: string) => void }> = ({ date, onChange }) => {
    const inputRef = useRef<HTMLInputElement>(null);
    
    const normalizedDate = normalizeDateForInput(date);
    const displayDate = formatDate(normalizedDate || date);
    const dateIsOverdue = normalizedDate ? isOverdue(normalizedDate) : false;

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        try { if (inputRef.current) inputRef.current.showPicker(); } 
        catch (err) { inputRef.current?.focus(); }
    };

    return (
        <div className="relative group/date w-full cursor-pointer" onClick={handleClick}>
            <div className={`flex items-center gap-2 rounded px-2 py-1 transition-colors min-h-[24px] whitespace-nowrap ${dateIsOverdue ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400' : 'hover:bg-gray-100 dark:hover:bg-[#333] text-gray-600 dark:text-gray-400'}`}>
                <span className="text-xs pointer-events-none font-medium">{displayDate}</span>
                <Calendar size={12} className={`md:opacity-0 md:group-hover/date:opacity-100 pointer-events-none ${dateIsOverdue ? 'text-red-400' : 'text-gray-400'}`} />
            </div>
            <input 
                ref={inputRef} 
                type="date" 
                value={normalizedDate} 
                onChange={(e) => onChange(e.target.value)}
                className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
                onClick={(e) => e.stopPropagation()}
                style={{
                    colorScheme: 'dark'
                }}
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

  const getTaskSource = (task: Task) => {
      // Используем entityType для определения источника
      if (task.entityType === 'idea') {
          return { name: 'Беклог', isProcess: false, isBacklog: true };
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
          if (task.source === 'Беклог') {
              return { name: 'Беклог', isProcess: false, isBacklog: true };
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
      <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-xl shadow-sm overflow-hidden flex-1 flex flex-col min-h-0">
        <div className="flex-1 overflow-auto custom-scrollbar min-h-0">
          <table className="min-w-full text-left text-sm border-collapse">
            <thead className="sticky top-0 bg-gray-50 dark:bg-[#202020] z-10 border-b border-gray-200 dark:border-[#333]">
              <tr>
                <th className="py-3 px-4 font-semibold text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap" style={{ width: '200px', minWidth: '200px' }}>Задача</th>
                {isAggregator && <th className="py-3 px-4 font-semibold text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap" style={{ width: '96px', minWidth: '96px' }}>Источник</th>}
                <th className="py-3 px-4 font-semibold text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap" style={{ width: '120px', minWidth: '120px' }}>Статус</th>
                <th className="py-3 px-4 font-semibold text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap" style={{ width: '144px', minWidth: '144px' }}>Ответственный</th>
                <th className="py-3 px-4 font-semibold text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap" style={{ width: '104px', minWidth: '104px' }}>Приоритет</th>
                <th className="py-3 px-4 font-semibold text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap" style={{ width: '120px', minWidth: '120px' }}>Модуль</th>
                <th className="py-3 px-4 font-semibold text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap" style={{ width: '60px', minWidth: '60px' }}>Срок</th>
                {currentUser.role === Role.ADMIN && <th className="py-3 px-4 w-10"></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-[#333] bg-white dark:bg-[#252525]">
              {tasks.map(task => {
                  const source = isAggregator ? getTaskSource(task) : null;
                  return (
                      <tr key={task.id} className="hover:bg-gray-50 dark:hover:bg-[#2a2a2a] group transition-colors">
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
                                  options={statuses} 
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
                                  options={priorities} 
                                  type="priority" 
                                  onChange={(val) => onUpdateTask(task.id, { priority: val })} 
                              />
                          </td>

                          {/* Модуль */}
                          <td className="py-3 px-4 align-middle" onClick={(e) => e.stopPropagation()}>
                              <CustomSelect 
                                  value={task.projectId || ''} 
                                  options={projects} 
                                  type="project" 
                                  onChange={(val) => onUpdateTask(task.id, { projectId: val || null })} 
                              />
                          </td>

                          {/* Срок */}
                          <td className="py-3 px-4 align-middle" onClick={(e) => e.stopPropagation()}>
                              <DatePickerCell date={task.endDate} onChange={(val) => onUpdateTask(task.id, { endDate: val })} />
                          </td>
                          
                          {/* Удаление */}
                          {currentUser.role === Role.ADMIN && (
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

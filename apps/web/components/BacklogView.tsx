import React, { useState } from 'react';
import { Task, User, StatusOption, TableCollection } from '../types';
import { Archive, Plus, Trash2, Edit2, Search, Play } from 'lucide-react';

interface BacklogViewProps {
  backlogTasks: Task[]; // Задачи из беклога
  users: User[];
  statuses: StatusOption[];
  tables: TableCollection[];
  onUpdateTask: (id: string, updates: Partial<Task>) => void;
  onDeleteTask: (id: string) => void;
  onOpenTask: (task: Task) => void;
  onCreateTask: () => void;
  onTakeToWork: (task: Task) => void; // Функция для переноса задачи в работу
}

const BacklogView: React.FC<BacklogViewProps> = ({ 
    backlogTasks, 
    users, 
    statuses,
    onUpdateTask, 
    onDeleteTask, 
    onOpenTask,
    onCreateTask,
    onTakeToWork
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTasks = backlogTasks.filter(t => t.title.toLowerCase().includes(searchQuery.toLowerCase()));

  const getStatusBadge = (statusName: string) => {
      const s = statuses.find(st => st.name === statusName);
      const color = s?.color || 'bg-gray-100 text-gray-600';
      
      return (
          <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase border border-transparent ${color}`}>
              {statusName}
          </span>
      );
  };

  return (
    <div className="pt-6 px-6 pb-20 h-full flex flex-col">
        {/* Header */}
        <div className="mb-8 bg-white dark:bg-[#252525] p-6 rounded-xl border border-gray-200 dark:border-[#333] shadow-sm">
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Бэклог</h1>
                    <p className="hidden sm:block text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Идеи для реализации
                    </p>
                </div>
                <div className="text-right">
                    <div className="text-3xl font-bold text-orange-600 dark:text-orange-400">{filteredTasks.length}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 uppercase font-semibold">Идей в беклоге</div>
                </div>
            </div>
        </div>

        {/* Toolbar */}
        <div className="flex justify-between items-center mb-4">
            <div className="relative max-w-xs w-full">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                <input 
                    type="text" 
                    placeholder="Найти идею..." 
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none text-gray-800 dark:text-gray-200"
                />
            </div>
            <button 
                onClick={onCreateTask}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2 shadow-sm"
            >
                <Plus size={18} />
                <span className="hidden sm:inline">Создать</span>
            </button>
        </div>

        {/* Ideas List - Card View */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
            {filteredTasks.length > 0 ? (
                <div className="grid grid-cols-1 gap-4">
                    {filteredTasks.map(task => {
                        const assignee = users.find(u => u.id === task.assigneeId);
                        const status = statuses.find(s => s.name === task.status);
                        const statusColor = status?.color || 'bg-gray-100 text-gray-600';
                        
                        return (
                            <div 
                                key={task.id} 
                                className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-xl p-5 hover:shadow-md transition-all group"
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                        <div 
                                            onClick={() => onOpenTask(task)}
                                            className="font-semibold text-lg text-gray-800 dark:text-gray-200 cursor-pointer hover:text-orange-600 dark:hover:text-orange-400 transition-colors mb-2"
                                        >
                                            {task.title}
                                        </div>
                                        {task.description && (
                                            <div className="text-sm text-gray-500 dark:text-gray-400 mb-4 line-clamp-2">
                                                {task.description}
                                            </div>
                                        )}
                                        
                                        <div className="flex items-center gap-4 flex-wrap">
                                            <div className="flex items-center gap-2">
                                                <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase border ${statusColor}`}>
                                                    {task.status}
                                                </span>
                                            </div>
                                            
                                            {assignee ? (
                                                <div className="flex items-center gap-2">
                                                    <img src={assignee.avatar} className="w-5 h-5 rounded-full object-cover object-center" alt=""/>
                                                    <span className="text-xs text-gray-600 dark:text-gray-400">{assignee.name}</span>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-gray-400 italic">Не назначено</span>
                                            )}
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-2 shrink-0">
                                        <button
                                            onClick={() => onTakeToWork(task)}
                                            className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 flex items-center gap-2 shadow-sm transition-colors"
                                        >
                                            <Play size={16} /> Взять в работу
                                        </button>
                                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button 
                                                onClick={() => onOpenTask(task)} 
                                                className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                                                title="Редактировать"
                                            >
                                                <Edit2 size={18}/>
                                            </button>
                                            <button 
                                                onClick={() => onDeleteTask(task.id)} 
                                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                                title="Удалить"
                                            >
                                                <Trash2 size={18}/>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-xl p-12 text-center">
                    <Archive size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                    <p className="text-gray-400 dark:text-gray-500 text-lg mb-2">Бэклог пуст</p>
                    <p className="text-sm text-gray-400 dark:text-gray-500 mb-4">Добавьте первую идею для будущей реализации</p>
                    <button 
                        onClick={onCreateTask}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2 shadow-sm mx-auto"
                    >
                        <Plus size={18} /> Добавить идею
                    </button>
                </div>
            )}
        </div>
    </div>
  );
};

export default BacklogView;



import React, { useState } from 'react';
import { Project, Task, User, StatusOption, TableCollection, BusinessProcess } from '../types';
import { Plus, Network, TrendingUp, FileText, Archive, Layers, Layout } from 'lucide-react';

interface KanbanBoardProps {
  tasks: Task[];
  users: User[];
  projects: Project[];
  statuses: StatusOption[];
  tables?: TableCollection[];
  isAggregator?: boolean;
  currentUser: User;
  businessProcesses?: BusinessProcess[];
  onUpdateStatus: (taskId: string, newStatus: string) => void;
  onOpenTask: (task: Task) => void;
}

const KanbanBoard: React.FC<KanbanBoardProps> = ({ 
  tasks, 
  users, 
  projects, 
  statuses,
  tables = [],
  isAggregator = false,
  currentUser,
  businessProcesses = [],
  onUpdateStatus,
  onOpenTask
}) => {
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const getTasksByStatus = (statusName: string) => {
    return tasks.filter(t => t.status === statusName);
  };

  const getStatusColor = (statusName: string) => {
      const s = statuses.find(st => st.name === statusName);
      if (!s?.color) return 'bg-gray-400 dark:bg-gray-600';
      
      const bgMatch = s.color.match(/bg-(\w+)-(\d+)/);
      if (bgMatch) {
          const colorName = bgMatch[1];
          const colorNum = bgMatch[2];
          return `bg-${colorName}-${colorNum} dark:bg-${colorName}-${Math.min(parseInt(colorNum) + 100, 900)}`;
      }
      
      if(s?.color.includes('green') || s?.color.includes('emerald')) return 'bg-emerald-500 dark:bg-emerald-600';
      if(s?.color.includes('blue')) return 'bg-blue-500 dark:bg-blue-600';
      if(s?.color.includes('yellow') || s?.color.includes('amber')) return 'bg-amber-500 dark:bg-amber-600';
      if(s?.color.includes('red') || s?.color.includes('rose')) return 'bg-rose-500 dark:bg-rose-600';
      return 'bg-gray-400 dark:bg-gray-600';
  };

  const getTableName = (tableId: string) => {
      return tables.find(t => t.id === tableId)?.name || '';
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
          return { name: task.source, isProcess: false, isContent: true };
      }
      return { name: 'Задача', isProcess: false, isTask: true };
  };

  const onDragStart = (e: React.DragEvent, taskId: string) => {
      setDraggedTaskId(taskId);
      setIsDragging(true);
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', taskId);
      // Делаем элемент полупрозрачным при перетаскивании
      if (e.currentTarget instanceof HTMLElement) {
          e.currentTarget.style.opacity = '0.5';
      }
  };

  const onDragEnd = (e: React.DragEvent) => {
      // Восстанавливаем прозрачность
      if (e.currentTarget instanceof HTMLElement) {
          e.currentTarget.style.opacity = '1';
      }
      // Небольшая задержка, чтобы onClick не сработал после drag
      setTimeout(() => {
          setIsDragging(false);
          setDraggedTaskId(null);
      }, 100);
  };

  const onDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      // Добавляем визуальную обратную связь
      if (e.currentTarget instanceof HTMLElement) {
          e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
      }
  };

  const onDragLeave = (e: React.DragEvent) => {
      // Убираем визуальную обратную связь
      if (e.currentTarget instanceof HTMLElement) {
          e.currentTarget.style.backgroundColor = '';
      }
  };

  const onDrop = (e: React.DragEvent, newStatus: string) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Убираем визуальную обратную связь
      if (e.currentTarget instanceof HTMLElement) {
          e.currentTarget.style.backgroundColor = '';
      }
      
      const taskId = draggedTaskId || e.dataTransfer.getData('text/plain');
      if (taskId) {
          const task = tasks.find(t => t.id === taskId);
          if (task && task.status !== newStatus) {
              onUpdateStatus(taskId, newStatus);
          }
          setDraggedTaskId(null);
      }
  };

  if (!statuses || !Array.isArray(statuses) || statuses.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
        Нет статусов для отображения
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-xl shadow-sm overflow-hidden flex-1 flex flex-col min-h-0">
        <div className="flex-1 overflow-x-auto custom-scrollbar min-h-0">
          <div className="flex gap-4 p-4 h-full min-w-max">
            {statuses.map(status => {
                const statusTasks = getTasksByStatus(status.name);
                return (
                  <div 
                      key={status.id} 
                      className="flex-shrink-0 w-80 flex flex-col rounded-lg p-2 bg-gray-100/80 dark:bg-[#1e1e1e] border border-gray-200 dark:border-[#333] transition-colors max-h-full"
                      onDragOver={onDragOver}
                      onDragLeave={onDragLeave}
                      onDrop={(e) => onDrop(e, status.name)}
                  >
                    <div className="flex items-center justify-between mb-3 px-2 pt-1 shrink-0">
                      <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${getStatusColor(status.name)}`}></span>
                          <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{status.name}</span>
                          <span className="text-xs text-gray-500 dark:text-gray-400 bg-white dark:bg-[#333] px-1.5 py-0.5 rounded shadow-sm border border-gray-100 dark:border-[#444]">{statusTasks.length}</span>
                      </div>
                      <div className="flex gap-1">
                          <button 
                              onClick={() => onOpenTask({ status: status.name } as Task)}
                              className="text-gray-400 hover:bg-white dark:hover:bg-[#333] hover:text-gray-700 dark:hover:text-gray-200 p-1 rounded transition-colors"
                              title={`Создать задачу со статусом "${status.name}"`}
                          >
                              <Plus size={14} />
                          </button>
                      </div>
                    </div>

                    <div className="flex-1 space-y-2.5 overflow-y-auto custom-scrollbar min-h-[100px] px-0.5">
                      {statusTasks.map(task => {
                          const project = (projects || []).find(p => p && p.id === task.projectId);
                          const source = isAggregator ? getTaskSource(task) : null;

                          return (
                              <div 
                                  key={task.id} 
                                  draggable={true}
                                  onDragStart={(e) => onDragStart(e, task.id)}
                                  onDragEnd={onDragEnd}
                                  onMouseDown={(e) => {
                                      // Запоминаем начальную позицию мыши
                                      const startX = e.clientX;
                                      const startY = e.clientY;
                                      
                                      const handleMouseUp = (upEvent: MouseEvent) => {
                                          const endX = upEvent.clientX;
                                          const endY = upEvent.clientY;
                                          const distance = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
                                          
                                          // Если мышь переместилась меньше чем на 5px, считаем это кликом
                                          if (distance < 5 && !isDragging) {
                                              onOpenTask(task);
                                          }
                                          
                                          document.removeEventListener('mouseup', handleMouseUp);
                                      };
                                      
                                      document.addEventListener('mouseup', handleMouseUp);
                                  }}
                                  className="bg-white dark:bg-[#2b2b2b] p-3 rounded-md shadow-sm border border-gray-200 dark:border-[#3a3a3a] hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700 transition-all group relative cursor-grab active:cursor-grabbing select-none"
                              >
                                  {/* Source Badge */}
                                  {source && (
                                      <div className={`text-[9px] mb-1.5 uppercase tracking-wide font-bold flex items-center gap-1 ${
                                          source.isProcess 
                                              ? 'text-indigo-600 dark:text-indigo-400' 
                                              : (source as any).isDeal
                                              ? 'text-blue-600 dark:text-blue-400'
                                              : (source as any).isContent
                                              ? 'text-pink-600 dark:text-pink-400'
                                              : (source as any).isBacklog
                                              ? 'text-orange-600 dark:text-orange-400'
                                              : (source as any).isFunctionality
                                              ? 'text-purple-600 dark:text-purple-400'
                                              : 'text-gray-400 dark:text-gray-500'
                                      }`}>
                                          {source.isProcess && <Network size={8} className="inline" />}
                                          {(source as any).isDeal && <TrendingUp size={8} className="inline" />}
                                          {(source as any).isContent && <FileText size={8} className="inline" />}
                                          {(source as any).isBacklog && <Archive size={8} className="inline" />}
                                          {(source as any).isFunctionality && <Layers size={8} className="inline" />}
                                          {source.name}
                                      </div>
                                  )}

                                  <div className="text-sm font-medium mb-3 text-gray-800 dark:text-gray-100 leading-snug">{task.title}</div>
                                  
                                  <div className="flex items-center justify-between mt-2">
                                      <div className="flex items-center gap-2">
                                          <div className="flex -space-x-1.5">
                                              {task.assigneeIds && task.assigneeIds.length > 0 ? (
                                                  task.assigneeIds.map(uid => {
                                                      const u = users.find(us => us.id === uid);
                                                      if(!u) return null;
                                                      return <img key={uid} src={u.avatar} className="w-5 h-5 rounded-full border border-white dark:border-[#2b2b2b] object-cover object-center" alt="" />;
                                                  })
                                              ) : task.assigneeId && users.find(u => u.id === task.assigneeId) ? (
                                                  <img src={users.find(u => u.id === task.assigneeId)?.avatar} className="w-5 h-5 rounded-full border border-white dark:border-[#2b2b2b] object-cover object-center" alt="" />
                                              ) : null}
                                          </div>
                                          {project && (
                                              <span className="text-[10px] bg-purple-50 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300 px-1.5 py-0.5 rounded border border-purple-100 dark:border-purple-800 font-medium truncate max-w-[80px]">
                                                  {project.name}
                                              </span>
                                          )}
                                      </div>
                                      <div className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">{task.endDate ? new Date(task.endDate).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '.') : ''}</div>
                                  </div>
                              </div>
                          );
                      })}
                    </div>
                  </div>
                );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default KanbanBoard;

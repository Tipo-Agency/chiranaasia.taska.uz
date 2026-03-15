
import React, { useMemo } from 'react';
import { Task, Project } from '../types';

interface GanttViewProps {
  tasks: Task[];
  projects: Project[];
  onOpenTask: (task: Task) => void;
}

const GanttView: React.FC<GanttViewProps> = ({ tasks, projects, onOpenTask }) => {
  const { startDate, endDate, totalDays, months } = useMemo(() => {
      if (tasks.length === 0) {
          const now = new Date();
          const start = new Date(now.getFullYear(), now.getMonth(), 1);
          const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
          return { 
              startDate: start, 
              endDate: end, 
              totalDays: 30, 
              months: [{ name: now.toLocaleString('ru-RU', { month: 'short' }), year: now.getFullYear() }] 
          };
      }

      const startTimestamps = tasks
          .map(t => t.startDate ? new Date(t.startDate).getTime() : null)
          .filter(t => t !== null && !isNaN(t!)) as number[];
      const endTimestamps = tasks
          .map(t => t.endDate ? new Date(t.endDate).getTime() : null)
          .filter(t => t !== null && !isNaN(t!)) as number[];
      
      if (startTimestamps.length === 0 || endTimestamps.length === 0) {
          const now = new Date();
          const start = new Date(now.getFullYear(), now.getMonth(), 1);
          const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
          return { 
              startDate: start, 
              endDate: end, 
              totalDays: 30, 
              months: [{ name: now.toLocaleString('ru-RU', { month: 'short' }), year: now.getFullYear() }] 
          };
      }
      
      let minTime = Math.min(...startTimestamps);
      let maxTime = Math.max(...endTimestamps);

      minTime -= 7 * 24 * 60 * 60 * 1000;
      maxTime += 7 * 24 * 60 * 60 * 1000;

      const start = new Date(minTime);
      const end = new Date(maxTime);
      const diff = (end.getTime() - start.getTime()) / (1000 * 3600 * 24);

      const ms = [];
      const curr = new Date(start);
      curr.setDate(1);
      while (curr < end) {
          ms.push({ name: curr.toLocaleString('ru-RU', { month: 'short' }), year: curr.getFullYear() });
          curr.setMonth(curr.getMonth() + 1);
      }

      return { startDate: start, endDate: end, totalDays: diff, months: ms };
  }, [tasks]);

  const getPosition = (dateStr: string) => {
    if (!dateStr) return 0;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 0;
    const diff = (d.getTime() - startDate.getTime()) / (1000 * 3600 * 24);
    const pos = (diff / totalDays) * 100;
    return Math.max(0, Math.min(100, pos));
  };

  const getWidth = (start: string, end: string) => {
    if (!start || !end) return 0.5;
    const s = new Date(start);
    const e = new Date(end);
    if (isNaN(s.getTime()) || isNaN(e.getTime())) return 0.5;
    const diff = (e.getTime() - s.getTime()) / (1000 * 3600 * 24);
    const w = (diff / totalDays) * 100;
    return Math.max(0.5, w);
  };

  const groupedTasks = useMemo(() => {
      if (!projects || !Array.isArray(projects)) {
          return [];
      }
      
      const groups = projects
          .map(p => ({
              project: p,
              tasks: (tasks || []).filter(t => t && t.projectId === p.id && t.startDate && t.endDate)
          }))
          .filter(g => g.tasks.length > 0);
      
      const noProjectTasks = (tasks || []).filter(t => t && !t.projectId && t.startDate && t.endDate);
      if (noProjectTasks.length > 0) {
          groups.push({ project: { id: 'none', name: 'Без модуля' }, tasks: noProjectTasks });
      }
      
      return groups;
  }, [tasks, projects]);

  return (
    <div className="h-full flex flex-col">
      <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-xl shadow-sm overflow-hidden flex-1 flex flex-col min-h-0">
        {/* Timeline Header */}
        <div className="flex border-b border-gray-200 dark:border-[#333] h-10 bg-gray-50 dark:bg-[#202020] shrink-0">
          <div className="w-64 border-r border-gray-200 dark:border-[#333] shrink-0 p-3 text-xs font-semibold text-gray-500 dark:text-gray-400 flex items-center bg-gray-50 dark:bg-[#202020] z-20">
            Проект / Задача
          </div>
          <div className="flex-1 flex relative overflow-hidden">
            {months.map((m, i) => (
              <div key={`${m.name}-${m.year}-${i}`} className="flex-1 border-l border-gray-200 dark:border-[#333] text-xs text-gray-500 dark:text-gray-400 p-2 font-medium bg-gray-50 dark:bg-[#202020] text-center">
                {m.name} {m.year}
              </div>
            ))}
          </div>
        </div>

        {/* Timeline Body */}
        <div className="flex-1 overflow-auto custom-scrollbar min-h-0">
          {/* Background Grid - убраны пунктирные линии */}

          {groupedTasks.map(group => (
            <div key={group.project.id} className="mb-0 relative">
              <div className="bg-gray-50/90 dark:bg-[#202020]/95 backdrop-blur px-3 py-1.5 text-[10px] uppercase font-bold text-gray-600 dark:text-gray-300 sticky top-0 border-b border-gray-100 dark:border-[#333] z-10">
                {group.project.name}
              </div>
              {group.tasks.map(task => {
                  const left = getPosition(task.startDate);
                  const width = getWidth(task.startDate, task.endDate);
                  // Ограничиваем, чтобы полоска не выходила за границы
                  const constrainedLeft = Math.max(0, Math.min(left, 100));
                  const constrainedWidth = Math.min(width, 100 - constrainedLeft);
                  
                  return (
                    <div key={task.id} className="flex h-8 hover:bg-blue-50/30 dark:hover:bg-[#2a2a2a] border-b border-gray-50 dark:border-[#2a2a2a] group relative">
                      <div 
                        className="w-64 border-r border-gray-200 dark:border-[#333] shrink-0 px-3 text-xs truncate text-gray-800 dark:text-gray-300 flex items-center cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 bg-white dark:bg-[#252525] z-10" 
                        onClick={() => onOpenTask(task)}
                      >
                        {task.title}
                      </div>
                      <div className="flex-1 relative flex items-center my-1 pr-4 overflow-hidden">
                        <div 
                          onClick={() => onOpenTask(task)}
                          className="absolute h-4 rounded-full bg-blue-500/80 border border-blue-600 dark:border-blue-400 hover:bg-blue-600 cursor-pointer transition-all shadow-sm flex items-center z-0"
                          style={{
                            left: `${constrainedLeft}%`,
                            width: `${constrainedWidth}%`,
                            maxWidth: `${100 - constrainedLeft}%`
                          }}
                          title={`${task.title}: ${task.startDate} - ${task.endDate}`}
                        >
                          <span className="text-[9px] text-white px-1.5 truncate w-full font-medium drop-shadow-sm select-none">
                            {constrainedWidth > 10 ? task.title : ''}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
              })}
            </div>
          ))}
          {tasks.filter(t => t.startDate && t.endDate).length === 0 && (
            <div className="p-8 text-center text-gray-400 dark:text-gray-500 text-sm">Нет задач с датами для отображения</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GanttView;

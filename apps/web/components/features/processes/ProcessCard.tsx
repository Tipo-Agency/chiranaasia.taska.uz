/**
 * ProcessCard - карточка бизнес-процесса для отображения в списках
 * Левое выравнивание, акцентная полоса, метаданные в «чипах», футер с действием.
 */
import React from 'react';
import { BusinessProcess, ProcessInstance } from '../../../types';
import { FileText, Clock, CheckCircle2, ChevronRight, Edit2, Network } from 'lucide-react';
import { formatDate } from '../../../utils/dateUtils';

interface ProcessCardProps {
  process: BusinessProcess;
  instances?: ProcessInstance[];
  onClick?: () => void;
  onEdit?: (e: React.MouseEvent) => void;
  className?: string;
}

export const ProcessCard: React.FC<ProcessCardProps> = ({
  process,
  instances = [],
  onClick,
  onEdit,
  className = '',
}) => {
  const activeCount = instances.filter(i => i.status === 'active').length;
  const completedCount = instances.filter(i => i.status === 'completed').length;

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={onClick}
        className="w-full text-left rounded-xl border border-gray-200 dark:border-[#333] bg-white dark:bg-[#252525] overflow-hidden shadow-sm hover:shadow-md hover:border-indigo-300/80 dark:hover:border-indigo-600/50 transition-all group focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40"
      >
        <div className="flex border-l-4 border-indigo-500">
          <div className="flex gap-3 p-4 min-w-0 flex-1">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
              <Network size={22} strokeWidth={2} />
            </div>
            <div className="min-w-0 flex-1 pr-10">
              <h3 className="font-semibold text-gray-900 dark:text-white text-base leading-snug group-hover:text-indigo-700 dark:group-hover:text-indigo-300 transition-colors">
                {process.title}
              </h3>
              {process.description ? (
                <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mt-1.5 leading-relaxed">
                  {process.description}
                </p>
              ) : (
                <p className="text-xs text-gray-400 dark:text-gray-500 italic mt-1">Без описания</p>
              )}

              <div className="flex flex-wrap gap-1.5 mt-3">
                <span className="inline-flex items-center gap-1 rounded-md bg-gray-100 dark:bg-[#2a2a2a] px-2 py-0.5 text-[11px] font-medium text-gray-600 dark:text-gray-300">
                  <FileText size={12} className="opacity-70" />
                  {`${process.steps.length} шагов`}
                </span>
                <span className="inline-flex items-center rounded-md bg-gray-100 dark:bg-[#2a2a2a] px-2 py-0.5 text-[11px] font-medium text-gray-500 dark:text-gray-400">
                  v{process.version || 1}
                </span>
                {activeCount > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 text-[11px] font-medium text-blue-700 dark:text-blue-300">
                    <Clock size={12} />
                    {activeCount} активн.
                  </span>
                )}
                {completedCount > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 size={12} />
                    {completedCount} заверш.
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-gray-100 dark:border-[#333] bg-gray-50/90 dark:bg-[#1e1e1e] px-4 py-2.5">
          <span className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
            {process.updatedAt ? <>Обновлено {formatDate(process.updatedAt)}</> : '—'}
          </span>
          <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
            Открыть
            <ChevronRight size={14} className="transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </button>

      {onEdit && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEdit(e);
          }}
          className="absolute top-3 right-3 p-2 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 opacity-80 hover:opacity-100 rounded-lg hover:bg-gray-100 dark:hover:bg-[#333] z-10"
          aria-label="Редактировать шаблон"
        >
          <Edit2 size={16} />
        </button>
      )}
    </div>
  );
};

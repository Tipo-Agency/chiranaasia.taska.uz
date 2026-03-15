/**
 * ProcessCard - карточка бизнес-процесса для отображения в списках
 * 
 * Зачем отдельно:
 * - Переиспользуется в BusinessProcessesView
 * - Единый стиль отображения процессов
 * - Изолированная логика отображения
 */
import React from 'react';
import { BusinessProcess, ProcessInstance } from '../../../types';
import { Card } from '../../ui/Card';
import { FileText, Clock, CheckCircle2, ChevronRight, Edit2 } from 'lucide-react';
import { formatDate } from '../../../utils/dateUtils';
import { Touchable } from '../../ui/Touchable';

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
    <Touchable
      onClick={onClick}
      className={className}
    >
      <Card className="p-5 hover:shadow-md transition-all group">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-gray-900 dark:text-white text-lg mb-1 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
              {process.title}
            </h3>
            {process.description && (
              <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                {process.description}
              </p>
            )}
          </div>
          {onEdit && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(e);
              }}
              className="p-1.5 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg hover:bg-gray-100 dark:hover:bg-[#333] min-h-[44px] min-w-[44px] flex items-center justify-center"
              aria-label="Редактировать процесс"
            >
              <Edit2 size={16} />
            </button>
          )}
        </div>
        
        <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400 mb-3">
          <div className="flex items-center gap-1">
            <FileText size={14} />
            <span>{process.steps.length} шагов</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-gray-400">v{process.version || 1}</span>
          </div>
          {activeCount > 0 && (
            <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
              <Clock size={14} />
              <span>{activeCount} активных</span>
            </div>
          )}
          {completedCount > 0 && (
            <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
              <CheckCircle2 size={14} />
              <span>{completedCount} завершённых</span>
            </div>
          )}
        </div>
        
        {process.updatedAt && (
          <div className="text-[10px] text-gray-400 dark:text-gray-500 mb-2">
            Обновлено: {formatDate(process.updatedAt)}
          </div>
        )}
        
        <div className="flex items-center gap-2 text-xs text-indigo-600 dark:text-indigo-400 font-medium">
          <span>Открыть</span>
          <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
        </div>
      </Card>
    </Touchable>
  );
};

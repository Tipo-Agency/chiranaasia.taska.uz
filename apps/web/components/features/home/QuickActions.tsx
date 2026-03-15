/**
 * QuickActions - быстрые действия на главной странице
 * 
 * Зачем отдельно:
 * - Переиспользуемый блок быстрых действий
 * - Единый стиль кнопок
 */
import React from 'react';
import { Button } from '../../ui/Button';
import { Plus, Briefcase, Network } from 'lucide-react';

interface QuickActionsProps {
  onQuickCreateTask: () => void;
  onQuickCreateDeal: () => void;
  onQuickCreateProcess: () => void;
}

export const QuickActions: React.FC<QuickActionsProps> = ({
  onQuickCreateTask,
  onQuickCreateDeal,
  onQuickCreateProcess,
}) => {
  return (
    <div className="mb-6">
      <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase">
        Быстрые действия
      </h2>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          size="sm"
          icon={Plus}
          onClick={onQuickCreateTask}
          className="flex-1 min-w-[120px]"
        >
          Задача
        </Button>
        <Button
          variant="secondary"
          size="sm"
          icon={Briefcase}
          onClick={onQuickCreateDeal}
          className="flex-1 min-w-[120px]"
        >
          Сделка
        </Button>
        <Button
          variant="secondary"
          size="sm"
          icon={Network}
          onClick={onQuickCreateProcess}
          className="flex-1 min-w-[120px]"
        >
          Процесс
        </Button>
      </div>
    </div>
  );
};

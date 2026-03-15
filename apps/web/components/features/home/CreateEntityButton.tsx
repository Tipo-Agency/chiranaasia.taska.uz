/**
 * CreateEntityButton - объединенная кнопка создания сущностей
 */
import React, { useState, useRef, useEffect } from 'react';
import { Button } from '../../ui/Button';
import { Plus, CheckSquare, Briefcase, Network } from 'lucide-react';
import { Card } from '../../ui/Card';

interface CreateEntityButtonProps {
  onQuickCreateTask: () => void;
  onQuickCreateDeal: () => void;
  onQuickCreateProcess: () => void;
}

export const CreateEntityButton: React.FC<CreateEntityButtonProps> = ({
  onQuickCreateTask,
  onQuickCreateDeal,
  onQuickCreateProcess,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
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

  const handleSelect = (action: () => void) => {
    action();
    setIsOpen(false);
  };

  return (
    <div className="mb-6 relative" ref={dropdownRef}>
      <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase">
        Быстрые действия
      </h2>
      <Button
        variant="primary"
        size="md"
        icon={Plus}
        onClick={() => setIsOpen(!isOpen)}
        className="w-full sm:w-auto min-w-[200px]"
      >
        Создать
      </Button>

      {isOpen && (
        <Card className="absolute top-full left-0 mt-2 w-64 z-50 shadow-xl p-2">
          <div className="space-y-1">
            <button
              onClick={() => handleSelect(onQuickCreateTask)}
              className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-[#333] transition-colors text-left"
            >
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
                <CheckSquare size={18} />
              </div>
              <div className="flex-1">
                <div className="font-medium text-sm text-gray-900 dark:text-white">Задача</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Создать новую задачу</div>
              </div>
            </button>

            <button
              onClick={() => handleSelect(onQuickCreateDeal)}
              className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-[#333] transition-colors text-left"
            >
              <div className="p-2 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg">
                <Briefcase size={18} />
              </div>
              <div className="flex-1">
                <div className="font-medium text-sm text-gray-900 dark:text-white">Сделка</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Создать новую сделку</div>
              </div>
            </button>

            <button
              onClick={() => handleSelect(onQuickCreateProcess)}
              className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-[#333] transition-colors text-left"
            >
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg">
                <Network size={18} />
              </div>
              <div className="flex-1">
                <div className="font-medium text-sm text-gray-900 dark:text-white">Процесс</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Создать бизнес-процесс</div>
              </div>
            </button>
          </div>
        </Card>
      )}
    </div>
  );
};

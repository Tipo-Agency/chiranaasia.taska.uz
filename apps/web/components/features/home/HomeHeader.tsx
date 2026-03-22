/**
 * HomeHeader - заголовок главной страницы + быстрые действия справа на одном уровне
 */
import React from 'react';
import { User } from '../../../types';
import { CheckCircle2, Briefcase, Network, Plus, ShoppingCart, ChevronDown } from 'lucide-react';
import { Button } from '../../ui/Button';

interface HomeHeaderProps {
  user: User;
  onQuickCreateTask: () => void;
  onQuickCreateDeal: () => void;
  onQuickCreateProcess: () => void;
  // Опционально: отдельное создание заявки на приобретение
  onQuickCreatePurchaseRequest?: () => void;
}

export const HomeHeader: React.FC<HomeHeaderProps> = ({
  user,
  onQuickCreateTask,
  onQuickCreateDeal,
  onQuickCreateProcess,
  onQuickCreatePurchaseRequest,
}) => {
  const hour = new Date().getHours();
  let greeting: string;
  if (hour >= 6 && hour < 12) greeting = 'Доброе утро';
  else if (hour >= 12 && hour < 18) greeting = 'Добрый день';
  else if (hour >= 18 && hour < 23) greeting = 'Добрый вечер';
  else greeting = 'Доброй ночи';

  const today = new Date();
  const dayOfWeek = today.toLocaleDateString('ru-RU', { weekday: 'long' });
  const dayOfMonth = today.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  const formattedDate = `${dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1)}, ${dayOfMonth}`;

  const [menuOpen, setMenuOpen] = React.useState(false);

  const handleCreateTask = () => {
    onQuickCreateTask();
    setMenuOpen(false);
  };

  const handleCreateDeal = () => {
    onQuickCreateDeal();
    setMenuOpen(false);
  };

  const handleCreateProcess = () => {
    onQuickCreateProcess();
    setMenuOpen(false);
  };

  const handleCreatePurchaseRequest = () => {
    if (onQuickCreatePurchaseRequest) {
      onQuickCreatePurchaseRequest();
    } else {
      // По умолчанию открываем создание задачи — потом можно будет заменить
      onQuickCreateTask();
    }
    setMenuOpen(false);
  };

  return (
    <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-1">
          {greeting}, {user.name}!
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">{formattedDate}</p>
      </div>
      <div className="relative">
        <Button
          variant="primary"
          size="sm"
          onClick={() => setMenuOpen((prev) => !prev)}
          className="flex items-center gap-2 px-4"
        >
          <Plus size={16} />
          Создать
          <ChevronDown size={14} />
        </Button>

        {menuOpen && (
          <>
            <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-xl shadow-xl py-1 z-20">
              <button
                type="button"
                onClick={handleCreateTask}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-800 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-[#333]"
              >
                <CheckCircle2 size={16} className="text-[#3337AD]" />
                <span>Задача</span>
              </button>
              <button
                type="button"
                onClick={handleCreateDeal}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-800 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-[#333]"
              >
                <Briefcase size={16} className="text-[#3337AD]" />
                <span>Сделка</span>
              </button>
              <button
                type="button"
                onClick={handleCreateProcess}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-800 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-[#333]"
              >
                <Network size={16} className="text-[#3337AD]" />
                <span>Процесс</span>
              </button>
              <button
                type="button"
                onClick={handleCreatePurchaseRequest}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-800 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-[#333]"
              >
                <ShoppingCart size={16} className="text-[#3337AD]" />
                <span>Заявка на приобретение</span>
              </button>
            </div>
            <button
              type="button"
              className="fixed inset-0 z-10 cursor-default"
              onClick={() => setMenuOpen(false)}
              aria-hidden="true"
            />
          </>
        )}
      </div>
    </div>
  );
};

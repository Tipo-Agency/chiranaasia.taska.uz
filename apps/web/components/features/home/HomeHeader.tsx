/**
 * HomeHeader - заголовок главной страницы + быстрые действия справа на одном уровне
 */
import React from 'react';
import { User } from '../../../types';
import { CheckCircle2, Briefcase, Network, ShoppingCart } from 'lucide-react';
import { ModuleCreateDropdown } from '../../ui/ModuleCreateDropdown';

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

  return (
    <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-1">
          {greeting}, {user.name}!
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">{formattedDate}</p>
      </div>
      <ModuleCreateDropdown
        buttonClassName="bg-[#3337AD] hover:bg-[#292b8a] text-white"
        items={[
          {
            id: 'task',
            label: 'Задача',
            icon: CheckCircle2,
            onClick: onQuickCreateTask,
            iconClassName: 'text-[#3337AD] dark:text-[#8b8ee0]',
          },
          {
            id: 'deal',
            label: 'Сделка',
            icon: Briefcase,
            onClick: onQuickCreateDeal,
            iconClassName: 'text-[#3337AD] dark:text-[#8b8ee0]',
          },
          {
            id: 'process',
            label: 'Процесс',
            icon: Network,
            onClick: onQuickCreateProcess,
            iconClassName: 'text-[#3337AD] dark:text-[#8b8ee0]',
          },
          {
            id: 'purchase',
            label: 'Заявка на приобретение',
            icon: ShoppingCart,
            onClick: () => {
              if (onQuickCreatePurchaseRequest) onQuickCreatePurchaseRequest();
              else onQuickCreateTask();
            },
            iconClassName: 'text-[#3337AD] dark:text-[#8b8ee0]',
          },
        ]}
      />
    </div>
  );
};

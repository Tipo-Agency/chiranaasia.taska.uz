/**
 * HomeHeader - заголовок главной страницы + быстрые действия справа на одном уровне
 */
import React from 'react';
import { User } from '../../../types';
import { CheckCircle2, Briefcase, Network, ShoppingCart, LayoutGrid } from 'lucide-react';
import { ModuleCreateDropdown } from '../../ui/ModuleCreateDropdown';
import { ModulePageHeader } from '../../ui/ModulePageHeader';

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
    <div className="mb-6">
      <ModulePageHeader
        icon={<LayoutGrid size={24} strokeWidth={2} />}
        title={`${greeting}, ${user.name}!`}
        description={`${formattedDate} · Командный центр`}
        accent="indigo"
        actions={
          <ModuleCreateDropdown
            accent="indigo"
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
        }
      />
    </div>
  );
};

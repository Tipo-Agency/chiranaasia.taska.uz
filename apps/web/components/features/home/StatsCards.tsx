/**
 * StatsCards - статистические карточки на главной странице
 */
import React from 'react';
import { Card } from '../../ui/Card';
import { Wallet, TrendingUp, Briefcase, CheckCircle2 } from 'lucide-react';
import { Deal, FinancePlan, Task, User } from '../../../types';

interface StatsCardsProps {
  deals: Deal[];
  financePlan?: FinancePlan | null;
  tasks: Task[];
  currentUser: User;
  accountsReceivable?: { amount: number }[];
}

export const StatsCards: React.FC<StatsCardsProps> = ({
  deals,
  financePlan,
  tasks,
  currentUser,
  accountsReceivable = [],
}) => {
  const totalRevenue = (deals || []).filter(d => d && d.stage === 'won').reduce((sum, d) => sum + d.amount, 0);
  const totalReceivable = (accountsReceivable || []).reduce((sum, r) => sum + (r?.amount || 0), 0);
  const planPercent = financePlan && financePlan.salesPlan > 0
    ? Math.round((totalRevenue / financePlan.salesPlan) * 100)
    : 0;
  const myDeals = deals.filter(d => d && d.assigneeId === currentUser?.id && d.stage !== 'won' && d.stage !== 'lost');
  const myTasks = tasks.filter(t =>
    t &&
    t.entityType !== 'idea' &&
    t.entityType !== 'feature' &&
    !t.isArchived &&
    !['Выполнено', 'Done', 'Завершено'].includes(t.status) &&
    (t.assigneeId === currentUser?.id || t.assigneeIds?.includes(currentUser?.id))
  );

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Мои задачи</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">{myTasks.length}</p>
          </div>
          <CheckCircle2 size={20} className="text-blue-500" />
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Мои сделки</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">{myDeals.length}</p>
          </div>
          <Briefcase size={20} className="text-green-500" />
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Выручка</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">
              {totalRevenue.toLocaleString()} UZS
            </p>
          </div>
          <Wallet size={20} className="text-yellow-500" />
        </div>
      </Card>

      {financePlan && (
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">План продаж</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">{planPercent}%</p>
            </div>
            <TrendingUp size={20} className="text-purple-500" />
          </div>
        </Card>
      )}

      {totalReceivable > 0 && (
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Задолженности</p>
              <p className="text-lg font-bold text-amber-700 dark:text-amber-300">{totalReceivable.toLocaleString()} UZS</p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

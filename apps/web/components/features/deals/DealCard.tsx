/**
 * DealCard - карточка сделки для отображения в списках
 * 
 * Зачем отдельно:
 * - Переиспользуется в CRMModule, HomeView, Search
 * - Единый стиль отображения сделок
 * - Изолированная логика отображения
 */
import React from 'react';
import { Deal, User, SalesFunnel } from '../../../types';
import { Card } from '../../ui/Card';
import { Badge } from '../../ui/Badge';
import { UserAvatar } from '../common/UserAvatar';
import { Calendar, DollarSign, TrendingUp } from 'lucide-react';
import { formatDate } from '../../../utils/dateUtils';

interface DealCardProps {
  deal: Deal;
  users: User[];
  salesFunnels?: SalesFunnel[];
  onClick?: () => void;
  className?: string;
}

export const DealCard: React.FC<DealCardProps> = ({
  deal,
  users,
  salesFunnels,
  onClick,
  className = '',
}) => {
  const assignee = users.find(u => u.id === deal.assigneeId);
  const funnel = salesFunnels?.find(f => f.id === deal.funnelId);
  const stage = funnel?.stages.find(s => s.id === deal.stage);

  const getStageColor = (stageName: string) => {
    if (stageName?.toLowerCase().includes('выигран') || stageName?.toLowerCase().includes('won')) {
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
    }
    if (stageName?.toLowerCase().includes('проигран') || stageName?.toLowerCase().includes('lost')) {
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
    }
    return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
  };

  return (
    <Card
      className={`p-4 cursor-pointer hover:shadow-md transition-shadow ${className}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Заголовок */}
          <h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-2 truncate">
            {deal.title}
          </h3>

          {/* Стадия */}
          {stage && (
            <div className="mb-2">
              <Badge className={`${getStageColor(stage.name)} text-xs px-2 py-0.5`}>
                {stage.name}
              </Badge>
            </div>
          )}

          {/* Метаданные */}
          <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
            {deal.amount > 0 && (
              <div className="flex items-center gap-1">
                <DollarSign size={12} />
                <span>{deal.amount.toLocaleString()} {deal.currency || 'UZS'}</span>
              </div>
            )}

            {deal.contactName && (
              <div className="truncate max-w-[150px]">
                {deal.contactName}
              </div>
            )}

            {assignee && (
              <div className="flex items-center gap-1">
                <UserAvatar user={assignee} size="sm" />
                <span className="truncate max-w-[100px]">{assignee.name}</span>
              </div>
            )}

            {deal.createdAt && (
              <div className="flex items-center gap-1">
                <Calendar size={12} />
                <span>{formatDate(deal.createdAt)}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
};

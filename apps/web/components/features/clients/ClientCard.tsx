/**
 * ClientCard - карточка клиента для отображения в списках
 * 
 * Зачем отдельно:
 * - Переиспользуется в CRMModule, ClientsView
 * - Единый стиль отображения клиентов
 */
import React from 'react';
import { Client, Deal } from '../../../types';
import { Card } from '../../ui/Card';
import { Badge } from '../../ui/Badge';
import { Phone, Mail, Briefcase } from 'lucide-react';

interface ClientCardProps {
  client: Client;
  deals?: Deal[];
  onClick?: () => void;
  className?: string;
}

export const ClientCard: React.FC<ClientCardProps> = ({
  client,
  deals = [],
  onClick,
  className = '',
}) => {
  const clientDeals = deals.filter(d => d.clientId === client.id);
  const totalAmount = clientDeals.reduce((sum, deal) => sum + (deal.amount || 0), 0);

  return (
    <Card
      className={`p-4 cursor-pointer hover:shadow-md active:scale-[0.98] transition-all min-h-[80px] md:min-h-[auto] ${className}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Название */}
          <h3 className="font-semibold text-gray-900 dark:text-white text-sm mb-2 truncate">
            {client.name}
          </h3>

          {/* Контакты */}
          <div className="flex flex-col gap-1.5 text-xs text-gray-500 dark:text-gray-400 mb-2">
            {client.phone && (
              <div className="flex items-center gap-1.5">
                <Phone size={12} />
                <span>{client.phone}</span>
              </div>
            )}
            {client.email && (
              <div className="flex items-center gap-1.5">
                <Mail size={12} />
                <span className="truncate">{client.email}</span>
              </div>
            )}
          </div>

          {/* Статистика */}
          {clientDeals.length > 0 && (
            <div className="flex items-center gap-2 mt-2">
              <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 text-xs px-2 py-0.5">
                <Briefcase size={10} className="mr-1" />
                {clientDeals.length} {clientDeals.length === 1 ? 'сделка' : 'сделок'}
              </Badge>
              {totalAmount > 0 && (
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  {totalAmount.toLocaleString()} UZS
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};

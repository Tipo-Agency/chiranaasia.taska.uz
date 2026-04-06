import React from 'react';
import { Client, Contract, OneTimeDeal, User } from '../../types';
import { Edit2, Phone, Plus } from 'lucide-react';

interface ClientsTabProps {
  clients: Client[];
  users?: User[];
  contracts: Contract[];
  onEditClient: (client: Client) => void;
  onCreateContract: (clientId: string) => void;
}

export const ClientsTab: React.FC<ClientsTabProps> = ({
  clients,
  users = [],
  contracts,
  onEditClient,
  onCreateContract,
}) => {
  if (!clients || !Array.isArray(clients)) {
    return (
      <div className="p-10 text-center text-gray-500 dark:text-gray-400">
        Нет клиентов
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-[#252525] border border-gray-200 dark:border-[#333] rounded-xl shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm min-w-[720px]">
          <thead className="bg-gray-50 dark:bg-[#202020] border-b border-gray-200 dark:border-[#333]">
            <tr>
              <th className="px-4 py-3 text-gray-600 dark:text-gray-400 font-semibold">Клиент</th>
              <th className="px-4 py-3 text-gray-600 dark:text-gray-400 font-semibold">Контакт</th>
              <th className="px-4 py-3 text-gray-600 dark:text-gray-400 font-semibold">Телефон</th>
              <th className="px-4 py-3 text-gray-600 dark:text-gray-400 font-semibold">Ответственный</th>
              <th className="px-4 py-3 text-gray-600 dark:text-gray-400 font-semibold">Договоры</th>
              <th className="px-4 py-3 text-right text-gray-600 dark:text-gray-400 font-semibold w-28">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-[#333]">
            {clients.map((client) => {
              if (!client) return null;
              const clientContracts = (contracts || []).filter(
                (c) => c && !c.isArchived && c.clientId === client.id
              );
              const responsible = users.find((u) => u.id === client.responsibleUserId);
              const contractsTotal = clientContracts.reduce((s, c) => s + (c.amount || 0), 0);
              return (
                <tr
                  key={client.id}
                  className="hover:bg-gray-50 dark:hover:bg-[#2a2a2a] transition-colors cursor-pointer"
                  onClick={() => onEditClient(client)}
                >
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100 align-top">
                    {client.name}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400 align-top max-w-[200px]">
                    {client.contactPerson || '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400 align-top whitespace-nowrap">
                    {client.phone ? (
                      <span className="inline-flex items-center gap-1">
                        <Phone size={12} className="opacity-60 shrink-0" />
                        {client.phone}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400 align-top">
                    {responsible?.name || '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300 align-top">
                    <div className="text-xs">
                      <span className="font-semibold tabular-nums">{clientContracts.length}</span>
                      <span className="text-gray-500 dark:text-gray-500"> шт.</span>
                      {contractsTotal > 0 && (
                        <div className="text-[11px] text-green-700 dark:text-green-400 mt-0.5 tabular-nums">
                          {contractsTotal.toLocaleString('ru-RU')} UZS
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right align-top">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditClient(client);
                        }}
                        className="p-2 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                        aria-label="Редактировать"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onCreateContract(client.id);
                        }}
                        className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium border border-dashed border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:text-blue-600 hover:border-blue-400 dark:hover:border-blue-500"
                      >
                        <Plus size={14} />
                        Договор
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

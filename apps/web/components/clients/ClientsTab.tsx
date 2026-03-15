import React from 'react';
import { Client, Contract, OneTimeDeal } from '../../types';
import { Card } from '../ui';
import { Edit2, Phone, Plus } from 'lucide-react';

interface ClientsTabProps {
  clients: Client[];
  contracts: Contract[];
  onEditClient: (client: Client) => void;
  onCreateContract: (clientId: string) => void;
}

export const ClientsTab: React.FC<ClientsTabProps> = ({
  clients,
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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {clients.map(client => {
        if (!client) return null;
        const clientContracts = (contracts || []).filter(c => c && !c.isArchived && c.clientId === client.id);
        return (
          <Card key={client.id} padding="lg" hover onClick={() => onEditClient(client)} className="relative flex flex-col h-full">
            <div className="flex justify-between items-start mb-4">
              <div className="pr-8">
                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 leading-tight mb-1">{client.name}</h3>
                {client.contactPerson && <div className="text-sm text-gray-500 dark:text-gray-400">{client.contactPerson}</div>}
              </div>
              <button onClick={(e) => { e.stopPropagation(); onEditClient(client); }} className="text-gray-300 hover:text-blue-600 p-1">
                <Edit2 size={16}/>
              </button>
            </div>
            
            <div className="space-y-2 mb-4 flex-1">
              {client.phone && <div className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-2"><Phone size={12}/> {client.phone}</div>}
              {clientContracts.length > 0 ? (
                <div className="mt-3 bg-gray-50 dark:bg-[#303030] rounded p-2">
                  <div className="text-[10px] font-bold text-gray-400 uppercase mb-1">Договоры ({clientContracts.length})</div>
                  {clientContracts.map(c => (
                    <div key={c.id} className="flex justify-between items-center text-xs py-0.5 border-b border-gray-100 dark:border-gray-700 last:border-0 text-gray-700 dark:text-gray-300">
                      <span className="truncate max-w-[120px]">{c.description}</span>
                      <span className="font-medium text-green-700 dark:text-green-400">{c.amount.toLocaleString()} UZS</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-3 text-xs text-gray-400 italic">Нет активных договоров</div>
              )}
            </div>
            
            <button 
              onClick={(e) => { e.stopPropagation(); onCreateContract(client.id); }} 
              className="w-full py-2 border border-dashed border-gray-200 dark:border-gray-600 rounded text-xs text-gray-500 dark:text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors flex items-center justify-center gap-1"
            >
              <Plus size={14}/> Договор
            </button>
          </Card>
        );
      })}
    </div>
  );
};

